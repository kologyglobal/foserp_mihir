import type { BankConnectorConsent, BankConnectorConsentStatus } from '@prisma/client'
import { prisma } from '../../../../config/database.js'

export type ConsentCreateData = {
  tenantId: string
  connectorId: string
  status: BankConnectorConsentStatus
  authorizationUrl: string | null
  state: string | null
  redirectUri: string | null
  expiresAt: Date | null
  tokenCiphertext: string | null
  createdBy: string | null
}

export async function createConsent(data: ConsentCreateData): Promise<BankConnectorConsent> {
  return prisma.bankConnectorConsent.create({
    data: {
      tenantId: data.tenantId,
      connectorId: data.connectorId,
      status: data.status,
      authorizationUrl: data.authorizationUrl,
      state: data.state,
      redirectUri: data.redirectUri,
      expiresAt: data.expiresAt,
      tokenCiphertext: data.tokenCiphertext,
      createdBy: data.createdBy,
      updatedBy: data.createdBy,
    },
  })
}

export async function findLatestConsent(
  tenantId: string,
  connectorId: string,
): Promise<BankConnectorConsent | null> {
  return prisma.bankConnectorConsent.findFirst({
    where: { tenantId, connectorId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findConsentByState(
  tenantId: string,
  state: string,
): Promise<BankConnectorConsent | null> {
  return prisma.bankConnectorConsent.findFirst({
    where: { tenantId, state },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateConsent(
  tenantId: string,
  id: string,
  data: {
    status?: BankConnectorConsentStatus
    tokenCiphertext?: string | null
    expiresAt?: Date | null
    revokedAt?: Date | null
    authorizationUrl?: string | null
    updatedBy?: string | null
  },
): Promise<BankConnectorConsent> {
  return prisma.bankConnectorConsent.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.tokenCiphertext !== undefined ? { tokenCiphertext: data.tokenCiphertext } : {}),
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      ...(data.revokedAt !== undefined ? { revokedAt: data.revokedAt } : {}),
      ...(data.authorizationUrl !== undefined ? { authorizationUrl: data.authorizationUrl } : {}),
      ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
    },
  }).then(async (row) => {
    if (row.tenantId !== tenantId) {
      throw new Error('Consent tenant mismatch')
    }
    return row
  })
}

export async function findLatestConsentsForConnectors(
  tenantId: string,
  connectorIds: string[],
): Promise<Map<string, BankConnectorConsent>> {
  const map = new Map<string, BankConnectorConsent>()
  if (connectorIds.length === 0) return map
  const rows = await prisma.bankConnectorConsent.findMany({
    where: { tenantId, connectorId: { in: connectorIds } },
    orderBy: { createdAt: 'desc' },
  })
  for (const row of rows) {
    if (!map.has(row.connectorId)) map.set(row.connectorId, row)
  }
  return map
}
