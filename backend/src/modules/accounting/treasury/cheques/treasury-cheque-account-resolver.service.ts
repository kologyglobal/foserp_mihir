import { prisma } from '../../../../config/database.js'
import type { TreasuryChequeCounterpartResolution, TreasuryAccountSnapshot } from './treasury-cheque.types.js'
import {
  TreasuryChequeAccountNotFoundError,
  TreasuryChequeAccountTypeNotSupportedError,
  TreasuryChequeCounterpartAccountInvalidError,
} from './treasury-cheque.errors.js'

/** Cheques are always drawn on / deposited to a BANK treasury account (Phase 5B2 scope). */
export async function loadTreasuryAccountSnapshot(tenantId: string, treasuryAccountId: string): Promise<TreasuryAccountSnapshot> {
  const account = await prisma.treasuryAccount.findFirst({ where: { id: treasuryAccountId, tenantId } })
  if (!account) throw new TreasuryChequeAccountNotFoundError()
  if (account.accountType !== 'BANK') throw new TreasuryChequeAccountTypeNotSupportedError()
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
  }
}

/** Validates a user-provided counterpart GL account belongs to the legal entity and is postable. */
export async function assertCounterpartAccountUsable(tenantId: string, legalEntityId: string, accountId: string): Promise<void> {
  const account = await prisma.account.findFirst({ where: { id: accountId, tenantId, legalEntityId } })
  if (!account || account.isGroup || !account.isActive) {
    throw new TreasuryChequeCounterpartAccountInvalidError()
  }
}

/**
 * Counterpart resolve order (Phase 5B2):
 *   1. Explicit `counterpartGlAccountId` on the request (validated against the legal entity).
 *   2. Else `DefaultAccountMapping` key `CHEQUE_RECEIPT_CLEARING` (RECEIVED) / `CHEQUE_PAYMENT_CLEARING` (ISSUED).
 *   3. Else unresolved — caller decides whether that blocks posting (see finance settings
 *      `treasuryChequeRequireCounterpartAccount`).
 */
export async function resolveTreasuryChequeCounterpart(params: {
  tenantId: string
  legalEntityId: string
  direction: 'ISSUED' | 'RECEIVED'
  providedAccountId?: string | null
}): Promise<TreasuryChequeCounterpartResolution> {
  if (params.providedAccountId) {
    await assertCounterpartAccountUsable(params.tenantId, params.legalEntityId, params.providedAccountId)
    return { counterpartGlAccountId: params.providedAccountId, counterpartSource: 'PROVIDED' }
  }

  const mappingKey = params.direction === 'RECEIVED' ? 'CHEQUE_RECEIPT_CLEARING' : 'CHEQUE_PAYMENT_CLEARING'
  const mapping = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId: params.tenantId, legalEntityId: params.legalEntityId, mappingKey },
  })
  if (mapping) {
    return { counterpartGlAccountId: mapping.accountId, counterpartSource: 'DEFAULT_MAPPING' }
  }

  return { counterpartGlAccountId: null, counterpartSource: 'UNRESOLVED' }
}
