import { prisma } from '../../../config/database.js'
import { AppError, NotFoundError } from '../../../utils/errors.js'
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

export type CloseReadinessResult = {
  productionOrderId: string
  orderNumber: string
  orderStatus: string
  /** COMPLETE = operational Complete WO preview; CLOSE = post-completion close gate. */
  purpose: 'COMPLETE' | 'CLOSE'
  readyToClose: boolean
  summary: {
    blockerCount: number
    warningCount: number
    checkCount: number
  }
  /** Hard gates only (`severity === 'BLOCKER'`). */
  blockers: CloseReadinessCheck[]
  /** Soft / advisory (`severity === 'WARNING'`). */
  warnings: CloseReadinessCheck[]
  checks: CloseReadinessCheck[]
}

/**
 * Close / complete readiness for a work order. Does NOT auto-close on FG receipt.
 *
 * Hard vs soft:
 * - `allowInProgress` only relaxes OPERATIONAL_STATUS (and marks purpose COMPLETE).
 * - Quality softens when `allowCloseWithoutQc` or `flexibleExecution`.
 * - Material / open-reservation softens only when `flexibleExecution`.
 * - FG remaining is never a hard block for operational Complete; hard for CLOSE unless flexible.
 * - Job work is always advisory (WARNING).
 */
export async function getCloseReadiness(
  tenantId: string,
  workOrderId: string,
  options?: { allowInProgress?: boolean },
): Promise<CloseReadinessResult> {
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
  const purpose: 'COMPLETE' | 'CLOSE' = allowInProgress ? 'COMPLETE' : 'CLOSE'
  const settings = await getManufacturingSettingsForTenant(tenantId)
  const flexible = Boolean(settings.flexibleExecution)
  const softQualityGates = Boolean(settings.allowCloseWithoutQc) || flexible
  /** Inventory / reservation hard gates soft only under flexible execution — not merely COMPLETE preview. */
  const softMaterialGates = flexible
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
      message: `Operational status ${order.status} is acceptable for ${purpose}`,
      detail: { status: order.status, purpose },
    })
  }

  const qualityBlockers = await collectQualityBlockers(tenantId, workOrderId)
  if (qualityBlockers.length > 0) {
    checks.push({
      code: 'QUALITY_BLOCKERS',
      severity: softQualityGates ? 'WARNING' : 'BLOCKER',
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
        materialRecon.status === 'BLOCKED' && !softMaterialGates ? 'BLOCKER' : 'WARNING',
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
      severity: softMaterialGates ? 'WARNING' : 'BLOCKER',
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
      severity: allowInProgress || softMaterialGates ? 'WARNING' : 'BLOCKER',
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
    purpose,
    readyToClose: blockers.length === 0,
    summary: {
      blockerCount: blockers.length,
      warningCount: warnings.length,
      checkCount: checks.length,
    },
    blockers,
    warnings,
    checks,
  }
}

/**
 * Enforces hard close-readiness gates for operational Complete WO (`IN_PROGRESS` → `COMPLETED`).
 * Soft / WARNING checks do not block. Flexible / allowCloseWithoutQc soften quality & material gates.
 */
export async function assertCompleteAllowed(tenantId: string, workOrderId: string): Promise<CloseReadinessResult> {
  const readiness = await getCloseReadiness(tenantId, workOrderId, { allowInProgress: true })
  if (readiness.blockers.length === 0) return readiness

  throw new AppError(
    409,
    `Cannot complete work order due to readiness blockers: ${readiness.blockers.map((b) => b.code).join(', ')}`,
    'WO_COMPLETE_BLOCKED',
    readiness.blockers.map((b) => ({ field: b.code, message: b.message })),
    {
      purpose: readiness.purpose,
      readyToClose: false,
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      summary: readiness.summary,
    },
  )
}
