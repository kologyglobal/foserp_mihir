import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { collectQualityBlockers } from '../../quality/shared/blockers.service.js'
import { getMaterialReconciliation } from '../materials/material-reconciliation.service.js'
import { sumPostedFgReceived } from '../fg-receipts/fg-eligibility.service.js'
import { getManufacturingSettingsForTenant } from '../settings/manufacturing-settings.service.js'
import { isPositive, subDec, toDecimal } from '../shared/quantity.service.js'
import { dec } from '../shared/manufacturing.mappers.js'

export type CloseReadinessCheck = {
  code: string
  severity: 'BLOCKER' | 'WARNING' | 'INFO'
  message: string
  detail?: unknown
}

/**
 * Advisory close-readiness for a work order. Does NOT auto-close on FG receipt.
 */
export async function getCloseReadiness(
  tenantId: string,
  workOrderId: string,
  options?: { allowInProgress?: boolean },
) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: workOrderId, tenantId, deletedAt: null },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      completedGoodQuantity: true,
      plannedQuantity: true,
    },
  })
  if (!order) throw new NotFoundError('Work order not found')

  const allowInProgress = options?.allowInProgress === true
  const settings = await getManufacturingSettingsForTenant(tenantId)
  const flexible = Boolean(settings.flexibleExecution)
  /** Soft gates: operational Complete WO / flexible execution — inventory & QC advise, do not block. */
  const softGates = flexible || allowInProgress
  const checks: CloseReadinessCheck[] = []

  const statusOk =
    order.status === 'COMPLETED' || (allowInProgress && order.status === 'IN_PROGRESS')
  if (!statusOk) {
    checks.push({
      code: 'OPERATIONAL_STATUS',
      severity: 'BLOCKER',
      message: `Work order status is ${order.status}; expected COMPLETED${allowInProgress ? ' or IN_PROGRESS' : ''}`,
      detail: { status: order.status },
    })
  } else {
    checks.push({
      code: 'OPERATIONAL_STATUS',
      severity: 'INFO',
      message: `Operational status ${order.status} is acceptable`,
      detail: { status: order.status },
    })
  }

  const qualityBlockers = await collectQualityBlockers(tenantId, workOrderId)
  if (qualityBlockers.length > 0) {
    checks.push({
      code: 'QUALITY_BLOCKERS',
      severity: softGates ? 'WARNING' : 'BLOCKER',
      message: `${qualityBlockers.length} open quality blocker(s)`,
      detail: qualityBlockers,
    })
  } else {
    checks.push({
      code: 'QUALITY_BLOCKERS',
      severity: 'INFO',
      message: 'No open quality blockers',
    })
  }

  const materialRecon = await getMaterialReconciliation(tenantId, workOrderId)
  if (materialRecon.status === 'BLOCKED' || materialRecon.status === 'DIFFERENCE') {
    checks.push({
      code: 'MATERIAL_RECONCILIATION',
      severity:
        materialRecon.status === 'BLOCKED' && !softGates ? 'BLOCKER' : 'WARNING',
      message: `Material reconciliation is ${materialRecon.status}`,
      detail: {
        status: materialRecon.status,
        canClose: materialRecon.canClose,
        blockerCount: materialRecon.blockers.length,
        differenceCount: materialRecon.differences.length,
      },
    })
  } else {
    checks.push({
      code: 'MATERIAL_RECONCILIATION',
      severity: 'INFO',
      message: `Material reconciliation is ${materialRecon.status}`,
      detail: { status: materialRecon.status, canClose: materialRecon.canClose },
    })
  }

  const openReservations = await prisma.inventoryStockReservation.count({
    where: {
      tenantId,
      demandType: 'WO',
      demandId: workOrderId,
      status: 'ACTIVE',
    },
  })
  if (openReservations > 0) {
    checks.push({
      code: 'OPEN_RESERVATIONS',
      severity: softGates ? 'WARNING' : 'BLOCKER',
      message: `${openReservations} active WO reservation(s) remain`,
      detail: { count: openReservations },
    })
  } else {
    checks.push({
      code: 'OPEN_RESERVATIONS',
      severity: 'INFO',
      message: 'No active WO reservations',
    })
  }

  const completedGood = toDecimal(order.completedGoodQuantity)
  const fgReceived = await sumPostedFgReceived(tenantId, workOrderId)
  const fgRemaining = subDec(completedGood, fgReceived)
  if (isPositive(completedGood) && isPositive(fgRemaining)) {
    checks.push({
      code: 'FG_NOT_FULLY_RECEIVED',
      // FG receipt is a separate posting — never hard-block operational Complete WO.
      severity: softGates ? 'WARNING' : 'BLOCKER',
      message: `FG remaining to receive: ${dec(fgRemaining)} (completed ${dec(completedGood)}, received ${dec(fgReceived)})`,
      detail: {
        completedGoodQuantity: dec(completedGood),
        receivedQuantity: dec(fgReceived),
        remainingQuantity: dec(fgRemaining),
      },
    })
  } else {
    checks.push({
      code: 'FG_RECEIPT',
      severity: 'INFO',
      message: isPositive(completedGood)
        ? 'Finished goods fully received against completed quantity'
        : 'No completed good quantity to receive',
      detail: {
        completedGoodQuantity: dec(completedGood),
        receivedQuantity: dec(fgReceived),
      },
    })
  }

  // Soft check — job work not reconciled (queryable when linked to WO)
  const openJobWork = await prisma.jobWorkOrder.findMany({
    where: {
      tenantId,
      productionOrderId: workOrderId,
      deletedAt: null,
      status: { notIn: ['CLOSED', 'CANCELLED'] },
    },
    select: { id: true, jwNumber: true, status: true },
  })
  const unreconciledJw = openJobWork.filter(
    (j) => j.status === 'RECONCILIATION_PENDING' || j.status === 'RECEIVED' || j.status === 'PARTIALLY_RECEIVED',
  )
  if (unreconciledJw.length > 0) {
    checks.push({
      code: 'JOB_WORK_UNRECONCILED',
      severity: 'WARNING',
      message: `${unreconciledJw.length} job work order(s) not fully reconciled/closed`,
      detail: unreconciledJw,
    })
  } else if (openJobWork.length > 0) {
    checks.push({
      code: 'JOB_WORK',
      severity: 'WARNING',
      message: `${openJobWork.length} open job work order(s) still linked`,
      detail: openJobWork,
    })
  } else {
    checks.push({
      code: 'JOB_WORK',
      severity: 'INFO',
      message: 'No open job work orders',
    })
  }

  const blockers = checks.filter((c) => c.severity === 'BLOCKER')
  const warnings = checks.filter((c) => c.severity === 'WARNING')

  return {
    productionOrderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    readyToClose: blockers.length === 0,
    summary: {
      blockerCount: blockers.length,
      warningCount: warnings.length,
      checkCount: checks.length,
    },
    checks,
  }
}
