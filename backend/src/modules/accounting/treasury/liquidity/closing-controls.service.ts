import { prisma } from '../../../../config/database.js'
import { formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import { getCashPosition } from './cash-position.service.js'
import { getDailyLiquidity } from './daily-liquidity.service.js'
import type { LiquidityQuery } from './treasury-liquidity.schemas.js'
import type { ClosingControlItem, ClosingControlsResult } from './treasury-liquidity.types.js'

export async function getClosingControls(tenantId: string, query: LiquidityQuery): Promise<ClosingControlsResult> {
  const [position, liquidity] = await Promise.all([
    getCashPosition(tenantId, query),
    getDailyLiquidity(tenantId, query),
  ])
  const asOfDate = position.asOfDate

  const [
    transfersInTransit,
    transfersPending,
    openRecons,
    adjustmentsReady,
    standingDue,
    dayClose,
  ] = await Promise.all([
    prisma.treasuryTransfer.count({
      where: { tenantId, legalEntityId: query.legalEntityId, status: 'IN_TRANSIT' },
    }),
    prisma.treasuryTransfer.count({
      where: { tenantId, legalEntityId: query.legalEntityId, status: 'PENDING_APPROVAL' },
    }),
    prisma.bankReconciliationSession.count({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED'] },
      },
    }),
    prisma.treasuryAdjustment.count({
      where: { tenantId, legalEntityId: query.legalEntityId, status: 'READY_TO_POST' },
    }),
    prisma.standingInstruction.count({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        status: 'ACTIVE',
        nextDueDate: { lte: new Date(`${asOfDate}T23:59:59.999Z`) },
      },
    }),
    prisma.treasuryDayClose.findFirst({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        closeDate: new Date(`${asOfDate}T00:00:00.000Z`),
      },
    }),
  ])

  const items: ClosingControlItem[] = [
    {
      id: 'negative_cash',
      label: 'No negative cash balances',
      severity: position.negativeCashAccountIds.length ? 'critical' : 'ok',
      passed: position.negativeCashAccountIds.length === 0,
      detail:
        position.negativeCashAccountIds.length === 0
          ? 'All cash accounts have non-negative book balances'
          : `${position.negativeCashAccountIds.length} cash account(s) are negative`,
      count: position.negativeCashAccountIds.length,
      href: '/accounting/bank-cash/cashbook',
    },
    {
      id: 'transfers_in_transit',
      label: 'No transfers stuck in transit',
      severity: transfersInTransit > 0 ? 'warning' : 'ok',
      passed: transfersInTransit === 0,
      detail: transfersInTransit === 0 ? 'No in-transit transfers' : `${transfersInTransit} transfer(s) in transit`,
      count: transfersInTransit,
      amount: liquidity.fundsInTransit,
      href: '/accounting/bank-cash/transfers/in-transit',
    },
    {
      id: 'open_reconciliation',
      label: 'Reconciliation sessions cleared or finalised',
      severity: openRecons > 0 ? 'warning' : 'ok',
      passed: openRecons === 0,
      detail: openRecons === 0 ? 'No open reconciliation sessions' : `${openRecons} open session(s)`,
      count: openRecons,
      amount: liquidity.unmatchedStatementAmount,
      href: '/accounting/bank-cash/reconciliation',
    },
    {
      id: 'pending_approvals',
      label: 'No transfers pending approval',
      severity: transfersPending > 0 ? 'info' : 'ok',
      passed: transfersPending === 0,
      detail: transfersPending === 0 ? 'No transfers awaiting approval' : `${transfersPending} transfer(s) pending approval`,
      count: transfersPending,
      href: '/accounting/bank-cash/transfers?status=PENDING_APPROVAL',
    },
    {
      id: 'adjustments_ready',
      label: 'Treasury adjustments ready to post reviewed',
      severity: adjustmentsReady > 0 ? 'info' : 'ok',
      passed: true,
      detail:
        adjustmentsReady === 0
          ? 'No adjustments ready to post'
          : `${adjustmentsReady} adjustment(s) ready to post (review before close)`,
      count: adjustmentsReady,
      href: '/accounting/bank-cash/treasury-adjustments?status=READY_TO_POST',
    },
    {
      id: 'standing_due',
      label: 'Standing instructions due processed',
      severity: standingDue > 0 ? 'info' : 'ok',
      passed: standingDue === 0,
      detail: standingDue === 0 ? 'No standing instructions overdue' : `${standingDue} instruction(s) due on/before as-of`,
      count: standingDue,
      href: '/accounting/bank-cash/standing-instructions',
    },
    {
      id: 'book_liquidity',
      label: 'Book liquidity recorded',
      severity: 'ok',
      passed: true,
      detail: `Available book liquidity ${formatForPersistence(liquidity.availableLiquidity)} ${liquidity.currencyCode}`,
      amount: liquidity.availableLiquidity,
    },
  ]

  const blocking = items.filter((i) => !i.passed && (i.severity === 'critical' || i.severity === 'warning'))
  const readyToClose = blocking.length === 0 && (!dayClose || dayClose.status !== 'CLOSED')

  return {
    legalEntityId: query.legalEntityId,
    asOfDate,
    readyToClose,
    items,
    dayClose: dayClose
      ? { id: dayClose.id, status: dayClose.status, updatedAt: dayClose.updatedAt.toISOString() }
      : null,
  }
}

void toDecimal
