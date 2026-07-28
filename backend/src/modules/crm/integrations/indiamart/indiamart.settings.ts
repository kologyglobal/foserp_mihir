import type { Prisma } from '@prisma/client'
import { createAuditLog } from '../../../../services/audit.service.js'
import { assertFieldEncryptionConfigured } from '../../../../utils/fieldEncryption.js'
import { getIndiaMartProviderAdapter } from './indiamart.adapter.js'
import {
  buildConnectionConfig,
  encryptCredentials,
  mapConnectionSettingsDto,
} from './indiamart.credentials.js'
import { IndiaMartError } from './indiamart.errors.js'
import { maskEmail, maskMobile } from './indiamart.normalizer.js'
import * as repo from './indiamart.repository.js'
import { assertSafeIndiaMartUrl } from './indiamart.ssrf.js'
import type { IndiaMartConfigurationJson } from './indiamart.types.js'
import {
  DEFAULT_INDIAMART_API_BASE_URL,
  DEFAULT_INDIAMART_LEAD_FETCH_ENDPOINT,
} from './indiamart.types.js'
import type { UpdateIndiaMartSettingsInput } from './indiamart.validation.js'

export async function getSettings(tenantId: string) {
  const connection = await repo.findConnectionByTenant(tenantId)
  return mapConnectionSettingsDto(connection)
}

export async function updateSettings(
  tenantId: string,
  userId: string,
  input: UpdateIndiaMartSettingsInput,
) {
  const existing = await repo.findConnectionByTenant(tenantId)
  const apiBaseUrl = input.apiBaseUrl ?? existing?.apiBaseUrl ?? DEFAULT_INDIAMART_API_BASE_URL
  assertSafeIndiaMartUrl(apiBaseUrl)

  let encryptedCredentials = existing?.encryptedCredentials ?? ''
  let credentialsChanged = false
  if (input.apiKey) {
    try {
      assertFieldEncryptionConfigured()
    } catch {
      throw new IndiaMartError(
        'NOT_CONFIGURED',
        'FIELD_ENCRYPTION_KEY is not configured on the server. Set it in backend/.env and restart the API before saving the Pull key.',
        503,
      )
    }
    encryptedCredentials = encryptCredentials({
      apiKey: input.apiKey,
      registeredMobile: input.registeredMobile ?? undefined,
      registeredEmail: input.registeredEmail || undefined,
    })
    credentialsChanged = true
  } else if (input.registeredMobile != null || input.registeredEmail != null) {
    // Update masked identity without rotating key when key not provided
  }

  if (!encryptedCredentials && !existing) {
    // Allow saving connection shell without key — status NOT_CONFIGURED
    encryptedCredentials = ''
  }

  const cfg = {
    ...((existing?.configurationJson as IndiaMartConfigurationJson) ?? {}),
    ...(input.configurationJson as IndiaMartConfigurationJson | undefined),
  }

  const interval = input.syncIntervalMinutes ?? existing?.syncIntervalMinutes ?? 15
  const syncEnabled = input.syncEnabled ?? existing?.syncEnabled ?? false

  const connection = await repo.upsertConnection(tenantId, userId, {
    accountName: input.accountName ?? existing?.accountName,
    registeredMobileMasked: input.registeredMobile
      ? maskMobile(input.registeredMobile)
      : existing?.registeredMobileMasked,
    registeredEmailMasked: input.registeredEmail
      ? maskEmail(input.registeredEmail)
      : existing?.registeredEmailMasked,
    apiBaseUrl,
    leadFetchEndpoint:
      input.leadFetchEndpoint ?? existing?.leadFetchEndpoint ?? DEFAULT_INDIAMART_LEAD_FETCH_ENDPOINT,
    authenticationType: input.authenticationType ?? existing?.authenticationType ?? 'QUERY_PARAMETER',
    encryptedCredentials: encryptedCredentials || existing?.encryptedCredentials || '',
    configurationJson: cfg as Prisma.InputJsonValue,
    status: encryptedCredentials || existing?.encryptedCredentials
      ? existing?.status === 'CONNECTED'
        ? 'CONNECTED'
        : existing?.status === 'NOT_CONFIGURED' || !existing
          ? 'NOT_CONFIGURED'
          : existing.status
      : 'NOT_CONFIGURED',
    syncEnabled,
    autoCreateLead: input.autoCreateLead ?? existing?.autoCreateLead ?? true,
    defaultLeadOwnerId: input.defaultLeadOwnerId !== undefined ? input.defaultLeadOwnerId : existing?.defaultLeadOwnerId,
    defaultTerritoryId: input.defaultTerritoryId !== undefined ? input.defaultTerritoryId : existing?.defaultTerritoryId,
    defaultPriority: input.defaultPriority ?? existing?.defaultPriority ?? 'high',
    defaultIndustryId: input.defaultIndustryId !== undefined ? input.defaultIndustryId : existing?.defaultIndustryId,
    duplicateBehaviour: input.duplicateBehaviour ?? existing?.duplicateBehaviour,
    assignmentMode: input.assignmentMode ?? existing?.assignmentMode,
    syncIntervalMinutes: interval,
    initialLookbackDays: input.initialLookbackDays ?? existing?.initialLookbackDays ?? 7,
    maxRecordsPerRun: input.maxRecordsPerRun ?? existing?.maxRecordsPerRun ?? 500,
    nextScheduledSyncAt: syncEnabled
      ? new Date(Date.now() + Math.max(5, interval) * 60_000)
      : null,
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'indiamart_connection',
    entityId: connection.id,
    action: credentialsChanged ? 'CREDENTIALS_CHANGED' : 'UPDATE',
    newValues: {
      syncEnabled: connection.syncEnabled,
      autoCreateLead: connection.autoCreateLead,
      credentialsChanged,
    },
  })

  return mapConnectionSettingsDto(connection)
}

export async function testConnection(tenantId: string, userId: string) {
  const connection = await repo.findConnectionByTenant(tenantId)
  if (!connection) throw new IndiaMartError('NOT_CONFIGURED', 'Save connection settings first')

  const adapter = getIndiaMartProviderAdapter()
  const config = buildConnectionConfig(connection)
  const result = await adapter.testConnection(config)

  await repo.upsertConnection(tenantId, userId, {
    status: result.ok ? 'CONNECTED' : result.errorCode === 'AUTHENTICATION' ? 'EXPIRED' : 'CONNECTION_FAILED',
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'indiamart_connection',
    entityId: connection.id,
    action: 'TEST_CONNECTION',
    newValues: { ok: result.ok, message: result.message, errorCode: result.errorCode },
  })

  return result
}
