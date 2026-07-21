import { prisma } from '../../../../config/database.js'
import type { TreasuryTransferAccountResolution, TreasuryAccountSnapshot } from './treasury-transfer.types.js'
import { TreasuryTransferAccountNotFoundError, TreasuryTransferClearingAccountMissingError } from './treasury-transfer.errors.js'

/** Loads a treasury account and maps it to the snapshot shape stored on the transfer header. */
export async function loadTreasuryAccountSnapshot(tenantId: string, treasuryAccountId: string): Promise<TreasuryAccountSnapshot> {
  const account = await prisma.treasuryAccount.findFirst({
    where: { id: treasuryAccountId, tenantId },
    include: { bankProfile: true, cashProfile: true },
  })
  if (!account) throw new TreasuryTransferAccountNotFoundError()
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    accountType: account.accountType,
    currencyCode: account.currencyCode,
    glAccountId: account.glAccountId,
    status: account.status,
    legalEntityId: account.legalEntityId,
    branchId: account.branchId,
    maskedNumber: account.bankProfile?.accountNumberMasked ?? null,
  }
}

/**
 * Clearing account resolve order (Phase 5B1):
 *   1. `DefaultAccountMapping` key `INTERNAL_TRANSFER_CLEARING` for the legal entity.
 *   2. Else the GL account of an active `CLEARING` `TreasuryAccount` for this legal entity + currency.
 *   3. Else `TREASURY_TRANSFER_CLEARING_ACCOUNT_MISSING`.
 */
export async function resolveInTransitClearingGlAccountId(
  tenantId: string,
  legalEntityId: string,
  currencyCode: string,
): Promise<{ glAccountId: string; source: 'DEFAULT_MAPPING' | 'CLEARING_TREASURY_ACCOUNT' }> {
  const mapping = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId, legalEntityId, mappingKey: 'INTERNAL_TRANSFER_CLEARING' },
  })
  if (mapping) {
    return { glAccountId: mapping.accountId, source: 'DEFAULT_MAPPING' }
  }

  const clearingAccount = await prisma.treasuryAccount.findFirst({
    where: { tenantId, legalEntityId, accountType: 'CLEARING', status: 'ACTIVE', currencyCode },
    orderBy: { createdAt: 'asc' },
  })
  if (clearingAccount) {
    return { glAccountId: clearingAccount.glAccountId, source: 'CLEARING_TREASURY_ACCOUNT' }
  }

  throw new TreasuryTransferClearingAccountMissingError()
}

export interface ResolveTreasuryTransferAccountsParams {
  tenantId: string
  legalEntityId: string
  currencyCode: string
  source: TreasuryAccountSnapshot
  destination: TreasuryAccountSnapshot
  requiresInTransit: boolean
}

export async function resolveTreasuryTransferAccounts(
  params: ResolveTreasuryTransferAccountsParams,
): Promise<TreasuryTransferAccountResolution> {
  if (!params.requiresInTransit) {
    return {
      sourceGlAccountId: params.source.glAccountId,
      destinationGlAccountId: params.destination.glAccountId,
      inTransitGlAccountId: null,
      inTransitSource: 'NOT_REQUIRED',
    }
  }

  const clearing = await resolveInTransitClearingGlAccountId(params.tenantId, params.legalEntityId, params.currencyCode)
  return {
    sourceGlAccountId: params.source.glAccountId,
    destinationGlAccountId: params.destination.glAccountId,
    inTransitGlAccountId: clearing.glAccountId,
    inTransitSource: clearing.source,
  }
}
