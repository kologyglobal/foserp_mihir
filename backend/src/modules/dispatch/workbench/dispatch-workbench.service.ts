import { prisma } from '../../../config/database.js'
import * as reqRepo from '../requirements/dispatch-requirement.repository.js'
import { synchroniseDispatchRequirements } from '../requirements/dispatch-requirement-sync.service.js'
import type { DispatchWorkbenchSummary } from '../shared/dispatch.types.js'

export async function getWorkbenchSummary(tenantId: string, refresh = false): Promise<DispatchWorkbenchSummary> {
  if (refresh) {
    await synchroniseDispatchRequirements(tenantId, {})
  }

  const [
    readyToDispatch,
    waitingForProduction,
    waitingForQuality,
    waitingForStock,
    blocked,
    partiallyReady,
    draftInReq,
    overdue,
    draftDispatches,
    allActiveRequirements,
    activeReservations,
    openPickLists,
    inProgressPickLists,
    openShortages,
    readyToPack,
    packingInProgress,
    packedSessions,
    packingShortages,
    readyForChallan,
    challanDrafts,
    challanInReview,
    challansIssued,
    readyForDispatch,
    challanBlocked,
  ] = await Promise.all([
    reqRepo.countByReadiness(tenantId, 'READY_TO_DISPATCH'),
    reqRepo.countByReadiness(tenantId, 'WAITING_FOR_PRODUCTION'),
    reqRepo.countByReadiness(tenantId, 'WAITING_FOR_QUALITY'),
    reqRepo.countByReadiness(tenantId, 'WAITING_FOR_STOCK'),
    reqRepo.countByReadiness(tenantId, ['BLOCKED', 'RECONCILIATION_REQUIRED', 'ON_HOLD']),
    reqRepo.countByReadiness(tenantId, 'PARTIALLY_READY'),
    reqRepo.countByReadiness(tenantId, 'ALREADY_IN_DRAFT_DISPATCH'),
    prisma.dispatchRequirement.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'ON_HOLD', 'RECONCILIATION_REQUIRED'] },
        remainingQuantitySnapshot: { gt: 0 },
        requestedDeliveryDate: { lt: new Date() },
      },
    }),
    prisma.outboundDispatch.count({
      where: { tenantId, deletedAt: null, status: 'DRAFT' },
    }),
    prisma.dispatchRequirement.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'ON_HOLD', 'RECONCILIATION_REQUIRED'] },
      },
    }),
    prisma.inventoryStockReservation.count({
      where: { tenantId, demandType: 'DISPATCH', status: 'ACTIVE', outboundDispatchId: { not: null } },
    }),
    prisma.dispatchPickList.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'PARTIALLY_PICKED'] },
      },
    }),
    prisma.dispatchPickList.count({
      where: { tenantId, deletedAt: null, status: 'IN_PROGRESS' },
    }),
    prisma.dispatchPickLine.count({
      where: { tenantId, shortageQuantity: { gt: 0 } },
    }),
    prisma.dispatchPackingSession.count({
      where: { tenantId, deletedAt: null, status: 'READY' },
    }),
    prisma.dispatchPackingSession.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['IN_PROGRESS', 'PARTIALLY_PACKED'] },
      },
    }),
    prisma.dispatchPackingSession.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['PACKED', 'VERIFIED'] },
      },
    }),
    prisma.dispatchPackingSession.count({
      where: { tenantId, deletedAt: null, status: 'BLOCKED', totalShortageQuantity: { gt: 0 } },
    }),
    prisma.dispatchPackingSession.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['PACKED', 'VERIFIED'] },
        deliveryChallans: { none: { deletedAt: null, status: { notIn: ['CANCELLED', 'SUPERSEDED'] } } },
      },
    }),
    prisma.deliveryChallan.count({
      where: { tenantId, deletedAt: null, status: { in: ['DRAFT', 'SENT_BACK'] } },
    }),
    prisma.deliveryChallan.count({
      where: { tenantId, deletedAt: null, status: { in: ['READY_FOR_REVIEW', 'APPROVED'] } },
    }),
    prisma.deliveryChallan.count({
      where: { tenantId, deletedAt: null, status: 'ISSUED' },
    }),
    prisma.deliveryChallan.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ISSUED',
        outboundDispatch: { status: 'DRAFT', deletedAt: null },
      },
    }),
    prisma.deliveryChallan.count({
      where: { tenantId, deletedAt: null, status: { in: ['SENT_BACK', 'CANCELLED'] } },
    }),
  ])

  return {
    readyToDispatch: readyToDispatch + partiallyReady,
    waitingForProduction,
    waitingForQuality,
    waitingForStock,
    overdue,
    blocked: blocked + draftInReq * 0,
    draftDispatches,
    allActiveRequirements,
    activeReservations,
    openPickLists,
    inProgressPickLists,
    openShortages,
    readyToPack,
    packingInProgress,
    packedSessions,
    packingShortages,
    readyForChallan,
    challanDrafts,
    challanInReview,
    challansIssued,
    readyForDispatch,
    challanBlocked,
  }
}
