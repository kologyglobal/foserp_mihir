import { prisma } from '../../../../config/database.js'
import { getCashPosition } from './cash-position.service.js'
import { getClosingControls } from './closing-controls.service.js'
import { getDailyLiquidity } from './daily-liquidity.service.js'
import { getShortTermForecast } from './short-term-forecast.service.js'
import type { ForecastQuery } from './treasury-liquidity.schemas.js'
import type { TreasuryDashboardResult } from './treasury-liquidity.types.js'

export async function getTreasuryDashboard(tenantId: string, query: ForecastQuery): Promise<TreasuryDashboardResult> {
  const [position, liquidity, forecast, closingControls] = await Promise.all([
    getCashPosition(tenantId, query),
    getDailyLiquidity(tenantId, query),
    getShortTermForecast(tenantId, query),
    getClosingControls(tenantId, query),
  ])
  const asOfDate = position.asOfDate

  const [
    transfersInTransit,
    transfersPendingApproval,
    chequesUncleared,
    adjustmentsReadyToPost,
    openReconciliationSessions,
    standingInstructionsDue,
  ] = await Promise.all([
    prisma.treasuryTransfer.count({
      where: { tenantId, legalEntityId: query.legalEntityId, status: 'IN_TRANSIT' },
    }),
    prisma.treasuryTransfer.count({
      where: { tenantId, legalEntityId: query.legalEntityId, status: 'PENDING_APPROVAL' },
    }),
    prisma.treasuryCheque.count({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        status: { in: ['ISSUED', 'DEPOSITED'] },
      },
    }),
    prisma.treasuryAdjustment.count({
      where: { tenantId, legalEntityId: query.legalEntityId, status: 'READY_TO_POST' },
    }),
    prisma.bankReconciliationSession.count({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED'] },
      },
    }),
    prisma.standingInstruction.count({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        status: 'ACTIVE',
        nextDueDate: { lte: new Date(`${asOfDate}T23:59:59.999Z`) },
      },
    }),
  ])

  return {
    legalEntityId: query.legalEntityId,
    asOfDate,
    currencyCode: position.currencyCode,
    position,
    liquidity,
    forecast,
    closingControls,
    workflow: {
      transfersInTransit,
      transfersPendingApproval,
      chequesUncleared,
      adjustmentsReadyToPost,
      openReconciliationSessions,
      standingInstructionsDue,
    },
  }
}
