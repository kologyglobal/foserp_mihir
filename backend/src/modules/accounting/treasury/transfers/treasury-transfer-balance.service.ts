import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import type { TreasuryTransferBalanceCheck } from './treasury-transfer.types.js'

/** Current GL balance for a treasury account's linked account — asset-normal (debit − credit). */
export async function getTreasuryAccountGlBalance(tenantId: string, glAccountId: string): Promise<Prisma.Decimal> {
  const agg = await prisma.generalLedgerEntry.aggregate({
    where: { tenantId, accountId: glAccountId },
    _sum: { debitAmount: true, creditAmount: true },
  })
  const debit = toDecimal(agg._sum.debitAmount ?? 0)
  const credit = toDecimal(agg._sum.creditAmount ?? 0)
  return debit.sub(credit)
}

export interface EvaluateTreasuryTransferBalanceParams {
  tenantId: string
  accountType: 'BANK' | 'CASH' | 'CLEARING'
  glAccountId: string
  transferAmount: string
  policy: 'ALLOW' | 'WARN' | 'BLOCK'
}

/** CASH accounts always BLOCK a negative projected balance, regardless of the configured policy. */
export async function evaluateTreasuryTransferBalance(
  params: EvaluateTreasuryTransferBalanceParams,
): Promise<TreasuryTransferBalanceCheck> {
  const currentBalance = await getTreasuryAccountGlBalance(params.tenantId, params.glAccountId)
  const projected = currentBalance.sub(toDecimal(params.transferAmount))
  const effectivePolicy: 'ALLOW' | 'WARN' | 'BLOCK' = params.accountType === 'CASH' ? 'BLOCK' : params.policy

  const warnings: string[] = []
  let isBlocking = false
  if (projected.isNegative()) {
    if (effectivePolicy === 'BLOCK') {
      isBlocking = true
      warnings.push(`Insufficient balance: projected balance ${projected.toFixed(4)} would go negative`)
    } else if (effectivePolicy === 'WARN') {
      warnings.push(`Warning: projected balance ${projected.toFixed(4)} would go negative`)
    }
  }

  return {
    policy: effectivePolicy,
    availableBalance: currentBalance.toFixed(4),
    projectedBalance: projected.toFixed(4),
    isBlocking,
    warnings,
  }
}
