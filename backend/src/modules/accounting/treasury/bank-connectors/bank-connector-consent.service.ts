import type { Request } from 'express'
import type { BankConnector, BankConnectorConsent } from '@prisma/client'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import {
  encryptConsentToken,
  generateConsentState,
  isFieldEncryptionConfigured,
} from './bank-connector-crypto.js'
import * as consentRepo from './bank-connector-consent.repository.js'
import {
  BankConnectorNotFoundError,
  BankConnectorValidationError,
} from './bank-connector.errors.js'
import * as repo from './bank-connector.repository.js'
import type {
  BankConnectorConsentCallbackInput,
  RevokeBankConnectorConsentInput,
  StartBankConnectorConsentInput,
} from './bank-connector.schemas.js'
import type { BankConnectorConfigJson, BankConnectorConsentDto } from './bank-connector.types.js'
import { toBankConnectorConsentDto, toBankConnectorDto } from './bank-connector.types.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

function readConfig(row: { configJson: unknown }): BankConnectorConfigJson | null {
  if (row.configJson && typeof row.configJson === 'object' && !Array.isArray(row.configJson)) {
    return row.configJson as BankConnectorConfigJson
  }
  return null
}

async function assertOpenBankingConnector(tenantId: string, id: string): Promise<BankConnector> {
  const row = await repo.getConnector(tenantId, id)
  if (row.provider !== 'OPEN_BANKING') {
    throw new BankConnectorValidationError('Consent APIs are only available for OPEN_BANKING connectors', [
      { field: 'provider', message: 'Must be OPEN_BANKING' },
    ])
  }
  return row
}

export async function getLatestConsentDto(
  tenantId: string,
  connectorId: string,
): Promise<BankConnectorConsentDto | null> {
  const row = await consentRepo.findLatestConsent(tenantId, connectorId)
  return row ? toBankConnectorConsentDto(row) : null
}

export async function startConsent(
  req: Request,
  tenantId: string,
  connectorId: string,
  input: StartBankConnectorConsentInput,
) {
  const connector = await assertOpenBankingConnector(tenantId, connectorId)
  const config = readConfig(connector)
  const state = generateConsentState()
  const authorizeBase =
    (typeof config?.authorizeUrl === 'string' && config.authorizeUrl.trim()) ||
    connector.baseUrl ||
    'https://openbanking.example/authorize'
  const url = new URL(authorizeBase.includes('://') ? authorizeBase : `https://${authorizeBase}`)
  url.searchParams.set('state', state)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', 'fos-erp-scaffold')

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  const consent = await consentRepo.createConsent({
    tenantId,
    connectorId,
    status: 'PENDING',
    authorizationUrl: url.toString(),
    state,
    redirectUri: input.redirectUri,
    expiresAt,
    tokenCiphertext: null,
    createdBy: req.context?.userId ?? null,
  })

  await createAuditLog({
    ...auditMeta(req),
    module: 'finance',
    entity: 'bank_connector_consent',
    entityId: consent.id,
    action: 'CONSENT_START',
    newValues: { connectorId, status: consent.status },
  })

  return {
    connector: toBankConnectorDto(connector, toBankConnectorConsentDto(consent)),
    consent: toBankConnectorConsentDto(consent),
    authorizationUrl: consent.authorizationUrl,
  }
}

export async function consentCallback(
  req: Request,
  tenantId: string,
  connectorId: string,
  input: BankConnectorConsentCallbackInput,
) {
  await assertOpenBankingConnector(tenantId, connectorId)
  const consent = await consentRepo.findConsentByState(tenantId, input.state)
  if (!consent || consent.connectorId !== connectorId) {
    throw new BankConnectorNotFoundError('Consent not found for state')
  }
  if (consent.status !== 'PENDING') {
    throw new BankConnectorValidationError('Consent is not pending authorization', [
      { field: 'state', message: `Current status is ${consent.status}` },
    ])
  }
  if (consent.expiresAt && consent.expiresAt.getTime() < Date.now()) {
    await consentRepo.updateConsent(tenantId, consent.id, {
      status: 'EXPIRED',
      updatedBy: req.context?.userId ?? null,
    })
    throw new BankConnectorValidationError('Consent authorization window expired', [
      { field: 'state', message: 'Start a new consent' },
    ])
  }

  if (input.error) {
    const updated = await consentRepo.updateConsent(tenantId, consent.id, {
      status: 'REVOKED',
      revokedAt: new Date(),
      updatedBy: req.context?.userId ?? null,
    })
    return { consent: toBankConnectorConsentDto(updated) }
  }

  const tokenPlain = input.accessToken ?? (input.code ? `scaffold-code:${input.code}` : null)
  if (!tokenPlain) {
    throw new BankConnectorValidationError('code or accessToken is required on successful callback', [
      { field: 'code', message: 'Provide OAuth code or scaffold accessToken' },
    ])
  }
  if (!isFieldEncryptionConfigured()) {
    throw new BankConnectorValidationError(
      'FIELD_ENCRYPTION_KEY is required to store Open Banking consent tokens',
      [{ field: 'accessToken', message: 'Configure FIELD_ENCRYPTION_KEY' }],
    )
  }

  const expiresAt = input.expiresInSeconds
    ? new Date(Date.now() + input.expiresInSeconds * 1000)
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  const updated = await consentRepo.updateConsent(tenantId, consent.id, {
    status: 'AUTHORIZED',
    tokenCiphertext: encryptConsentToken(tokenPlain),
    expiresAt,
    updatedBy: req.context?.userId ?? null,
  })

  await createAuditLog({
    ...auditMeta(req),
    module: 'finance',
    entity: 'bank_connector_consent',
    entityId: updated.id,
    action: 'CONSENT_AUTHORIZED',
    newValues: { connectorId, status: updated.status, hasToken: true },
  })

  return { consent: toBankConnectorConsentDto(updated) }
}

export async function revokeConsent(
  req: Request,
  tenantId: string,
  connectorId: string,
  _input: RevokeBankConnectorConsentInput,
) {
  await assertOpenBankingConnector(tenantId, connectorId)
  const latest = await consentRepo.findLatestConsent(tenantId, connectorId)
  if (!latest) {
    throw new BankConnectorNotFoundError('No consent to revoke')
  }
  if (latest.status === 'REVOKED') {
    return { consent: toBankConnectorConsentDto(latest) }
  }

  const updated = await consentRepo.updateConsent(tenantId, latest.id, {
    status: 'REVOKED',
    tokenCiphertext: null,
    revokedAt: new Date(),
    updatedBy: req.context?.userId ?? null,
  })

  await createAuditLog({
    ...auditMeta(req),
    module: 'finance',
    entity: 'bank_connector_consent',
    entityId: updated.id,
    action: 'CONSENT_REVOKE',
    newValues: { connectorId, status: updated.status },
  })

  return { consent: toBankConnectorConsentDto(updated) }
}

export function attachConsentDto(
  consent: BankConnectorConsent | null | undefined,
): BankConnectorConsentDto | null {
  return consent ? toBankConnectorConsentDto(consent) : null
}
