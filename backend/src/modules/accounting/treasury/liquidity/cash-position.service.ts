import { prisma } from '../../../../config/database.js'
import { add, formatForPersistence, subtract, toDecimal } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import type { LiquidityQuery } from './treasury-liquidity.schemas.js'
import type { CashPositionAccountRow, CashPositionResult } from './treasury-liquidity.types.js'

function asOfEnd(asOfDate: string): Date {
  // Inclusive end-of-day for date-only as-of balances.
  return new Date(`${asOfDate}T23:59:59.999Z`)
}

/** Net GL balance (debit − credit) for an account as of a date (inclusive). */
export async function glBalanceAsOf(
  tenantId: string,
  legalEntityId: string,
  glAccountId: string,
  asOfDate: string,
): Promise<string> {
  const agg = await prisma.generalLedgerEntry.aggregate({
    where: {
      tenantId,
      legalEntityId,
      accountId: glAccountId,
      postingDate: { lte: asOfEnd(asOfDate) },
    },
    _sum: { debitAmount: true, creditAmount: true },
  })
  return formatForPersistence(subtract(agg._sum.debitAmount ?? 0, agg._sum.creditAmount ?? 0))
}

export async function getCashPosition(tenantId: string, query: LiquidityQuery): Promise<CashPositionResult> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const asOfDate = query.asOfDate ?? new Date().toISOString().slice(0, 10)
  const currencyFilter = query.currencyCode?.trim().toUpperCase()

  const accounts = await prisma.treasuryAccount.findMany({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      accountType: { in: ['BANK', 'CASH'] },
      status: { in: ['ACTIVE', 'INACTIVE'] },
      ...(currencyFilter ? { currencyCode: currencyFilter } : {}),
    },
    orderBy: [{ accountType: 'asc' }, { code: 'asc' }],
  })

  const rows: CashPositionAccountRow[] = []
  let totalBank = '0.0000'
  let totalCash = '0.0000'
  const negativeCashAccountIds: string[] = []

  for (const account of accounts) {
    const bookBalance = await glBalanceAsOf(tenantId, query.legalEntityId, account.glAccountId, asOfDate)
    rows.push({
      treasuryAccountId: account.id,
      code: account.code,
      name: account.name,
      accountType: account.accountType as 'BANK' | 'CASH',
      glAccountId: account.glAccountId,
      currencyCode: account.currencyCode,
      bookBalance,
      status: account.status,
    })
    if (account.accountType === 'BANK') totalBank = formatForPersistence(add(totalBank, bookBalance))
    if (account.accountType === 'CASH') {
      totalCash = formatForPersistence(add(totalCash, bookBalance))
      if (toDecimal(bookBalance).isNegative()) negativeCashAccountIds.push(account.id)
    }
  }

  const currencyCode = currencyFilter ?? rows[0]?.currencyCode ?? 'INR'

  return {
    legalEntityId: query.legalEntityId,
    asOfDate,
    currencyCode,
    totalBankBalance: totalBank,
    totalCashBalance: totalCash,
    totalBookBalance: formatForPersistence(add(totalBank, totalCash)),
    accounts: rows,
    negativeCashAccountIds,
  }
}
