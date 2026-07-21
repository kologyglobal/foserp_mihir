import { prisma } from '../../../../config/database.js'
import type { DefaultAccountMappingKey } from '@prisma/client'
import type { TreasuryAccountSnapshot } from './treasury-adjustment.types.js'
import { TreasuryAdjustmentAccountNotFoundError, TreasuryAdjustmentLineAccountInvalidError, TreasuryAdjustmentMappingKeyUnresolvedError } from './treasury-adjustment.errors.js'

export async function loadTreasuryAccountSnapshot(tenantId: string, treasuryAccountId: string): Promise<TreasuryAccountSnapshot> {
  const account = await prisma.treasuryAccount.findFirst({ where: { id: treasuryAccountId, tenantId } })
  if (!account) throw new TreasuryAdjustmentAccountNotFoundError()
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

export async function assertLineAccountUsable(tenantId: string, legalEntityId: string, accountId: string): Promise<void> {
  const account = await prisma.account.findFirst({ where: { id: accountId, tenantId, legalEntityId } })
  if (!account || account.isGroup || !account.isActive) {
    throw new TreasuryAdjustmentLineAccountInvalidError()
  }
}

/**
 * Resolves a line's GL account: explicit `accountId` wins (validated); else `mappingKey` is
 * resolved via `DefaultAccountMapping` for the legal entity. Used both for manual line entry and
 * for classification/standing-instruction line templates, which only know mapping keys.
 */
export async function resolveLineAccountId(params: {
  tenantId: string
  legalEntityId: string
  accountId?: string | null
  mappingKey?: string | null
}): Promise<string> {
  if (params.accountId) {
    await assertLineAccountUsable(params.tenantId, params.legalEntityId, params.accountId)
    return params.accountId
  }
  if (params.mappingKey) {
    const mapping = await prisma.defaultAccountMapping.findFirst({
      where: { tenantId: params.tenantId, legalEntityId: params.legalEntityId, mappingKey: params.mappingKey as DefaultAccountMappingKey },
    })
    if (!mapping) {
      throw new TreasuryAdjustmentMappingKeyUnresolvedError(`No default account mapping configured for key "${params.mappingKey}"`)
    }
    return mapping.accountId
  }
  throw new TreasuryAdjustmentMappingKeyUnresolvedError('Either accountId or mappingKey must be provided for each offset line')
}
