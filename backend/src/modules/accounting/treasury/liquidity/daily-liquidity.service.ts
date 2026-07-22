import { prisma } from '../../../../config/database.js'
import { add, formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import { getCashPosition } from './cash-position.service.js'
import type { LiquidityQuery } from './treasury-liquidity.schemas.js'
import type { DailyLiquidityResult } from './treasury-liquidity.types.js'

export async function getDailyLiquidity(tenantId: string, query: LiquidityQuery): Promise<DailyLiquidityResult> {
  const position = await getCashPosition(tenantId, query)
  const asOfDate = position.asOfDate
  const asOf = new Date(`${asOfDate}T23:59:59.999Z`)

  const [inTransitTransfers, unclearedIssued, unclearedReceived, openSessions] = await Promise.all([
    prisma.treasuryTransfer.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        status: 'IN_TRANSIT',
      },
      select: { id: true, transferAmount: true, currencyCode: true },
    }),
    prisma.treasuryCheque.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        direction: 'ISSUED',
        status: { in: ['ISSUED', 'DEPOSITED'] },
      },
      select: { amount: true },
    }),
    prisma.treasuryCheque.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        direction: 'RECEIVED',
        status: { in: ['DEPOSITED'] },
      },
      select: { amount: true },
    }),
    prisma.bankReconciliationSession.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED'] },
      },
      select: { unmatchedStatementAmount: true },
    }),
  ])

  const fundsInTransit = inTransitTransfers.reduce(
    (s, t) => formatForPersistence(add(s, t.transferAmount)),
    '0.0000',
  )
  const unclearedIssuedCheques = unclearedIssued.reduce(
    (s, c) => formatForPersistence(add(s, c.amount)),
    '0.0000',
  )
  const unclearedReceivedCheques = unclearedReceived.reduce(
    (s, c) => formatForPersistence(add(s, c.amount)),
    '0.0000',
  )
  const unmatchedStatementAmount = openSessions.reduce(
    (s, sess) => formatForPersistence(add(s, sess.unmatchedStatementAmount ?? 0)),
    '0.0000',
  )

  // Available = book − funds still in transit visibility (already left source) is informational.
  // We treat available as book balances; transit/uncleared shown as visibility buckets.
  const availableLiquidity = position.totalBookBalance

  const warnings: string[] = []
  if (position.negativeCashAccountIds.length > 0) {
    warnings.push(`${position.negativeCashAccountIds.length} cash account(s) have a negative book balance`)
  }
  if (toDecimal(unmatchedStatementAmount).gt(0)) {
    warnings.push('Open reconciliation sessions have unmatched statement amounts')
  }
  if (inTransitTransfers.length > 0) {
    warnings.push(`${inTransitTransfers.length} transfer(s) are in transit as of ${asOfDate}`)
  }

  void asOf

  return {
    legalEntityId: query.legalEntityId,
    asOfDate,
    currencyCode: position.currencyCode,
    bookBankBalance: position.totalBankBalance,
    bookCashBalance: position.totalCashBalance,
    totalBookBalance: position.totalBookBalance,
    fundsInTransit,
    unclearedIssuedCheques,
    unclearedReceivedCheques,
    unmatchedStatementAmount,
    availableLiquidity,
    buckets: [
      { label: 'Book bank', amount: position.totalBankBalance },
      { label: 'Book cash', amount: position.totalCashBalance },
      { label: 'Funds in transit', amount: fundsInTransit },
      { label: 'Uncleared issued cheques', amount: unclearedIssuedCheques },
      { label: 'Uncleared received cheques', amount: unclearedReceivedCheques },
      { label: 'Unmatched statement', amount: unmatchedStatementAmount },
      { label: 'Available (book)', amount: availableLiquidity },
    ],
    warnings,
  }
}
