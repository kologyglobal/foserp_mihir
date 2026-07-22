import type { Request } from 'express'
import { isPositive, isZero, toDecimal } from '../../inventory/shared/quantity.helpers.js'
import { resolveMaterialClosePolicy } from './material-close-policy.js'
import {
  getMaterialPosition,
  type MaterialLinePosition,
  type MaterialReadinessStatus,
} from './material-position.service.js'

export const MATERIAL_RECONCILIATION_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'BALANCED',
  'DIFFERENCE',
  'BLOCKED',
] as const

export type MaterialReconciliationStatus = (typeof MATERIAL_RECONCILIATION_STATUSES)[number]

export type MaterialReconciliationDifference = {
  materialId: string
  itemId: string
  itemCode: string
  type:
    | 'SHORTAGE'
    | 'ADDITIONAL_ISSUE'
    | 'OPEN_RESERVATION'
    | 'HELD_QTY'
    | 'PARTIAL_ISSUE'
    | 'UNDER_RESERVED'
  severity: 'INFO' | 'WARNING' | 'BLOCKER'
  message: string
  qty: string
  readinessStatus: MaterialReadinessStatus
}

export type MaterialReconciliationBlocker = {
  code: string
  message: string
  materialId?: string
  severity: 'BLOCKER'
}

function buildDifferences(lines: MaterialLinePosition[]): MaterialReconciliationDifference[] {
  const diffs: MaterialReconciliationDifference[] = []

  for (const line of lines) {
    if (line.readinessStatus === 'NOT_REQUIRED') continue

    if (isPositive(line.shortageQty) || line.readinessStatus === 'SHORT') {
      diffs.push({
        materialId: line.materialId,
        itemId: line.itemId,
        itemCode: line.item.code,
        type: 'SHORTAGE',
        severity: 'BLOCKER',
        message: `Shortage of ${line.shortageQty} for ${line.item.code}`,
        qty: line.shortageQty,
        readinessStatus: line.readinessStatus,
      })
    }

    if (isPositive(line.additionalIssuedQty)) {
      diffs.push({
        materialId: line.materialId,
        itemId: line.itemId,
        itemCode: line.item.code,
        type: 'ADDITIONAL_ISSUE',
        severity: 'WARNING',
        message: `Additional issue of ${line.additionalIssuedQty} beyond required for ${line.item.code}`,
        qty: line.additionalIssuedQty,
        readinessStatus: line.readinessStatus,
      })
    }

    if (line.reservationStatus === 'ACTIVE' && isPositive(line.reservedQty)) {
      const remainingIssue = toDecimal(line.remainingToIssue)
      if (remainingIssue.isZero() || toDecimal(line.issuedQty).greaterThanOrEqualTo(toDecimal(line.requiredQty))) {
        diffs.push({
          materialId: line.materialId,
          itemId: line.itemId,
          itemCode: line.item.code,
          type: 'OPEN_RESERVATION',
          severity: 'BLOCKER',
          message: `Active reservation remains after issue coverage for ${line.item.code}`,
          qty: line.reservedQty,
          readinessStatus: line.readinessStatus,
        })
      }
    }

    if (isPositive(line.heldQty)) {
      diffs.push({
        materialId: line.materialId,
        itemId: line.itemId,
        itemCode: line.item.code,
        type: 'HELD_QTY',
        severity: 'WARNING',
        message: `WO still holds ${line.heldQty} of ${line.item.code} (issued custody; not consumed tracker)`,
        qty: line.heldQty,
        readinessStatus: line.readinessStatus,
      })
    }

    if (line.readinessStatus === 'PARTIALLY_ISSUED') {
      diffs.push({
        materialId: line.materialId,
        itemId: line.itemId,
        itemCode: line.item.code,
        type: 'PARTIAL_ISSUE',
        severity: 'INFO',
        message: `Partial issue for ${line.item.code}: remaining ${line.remainingToIssue}`,
        qty: line.remainingToIssue,
        readinessStatus: line.readinessStatus,
      })
    }

    if (
      line.readinessStatus === 'NOT_RESERVED' ||
      line.readinessStatus === 'PARTIALLY_RESERVED'
    ) {
      diffs.push({
        materialId: line.materialId,
        itemId: line.itemId,
        itemCode: line.item.code,
        type: 'UNDER_RESERVED',
        severity: 'INFO',
        message: `Under-reserved for ${line.item.code}: remaining ${line.remainingToReserve}`,
        qty: line.remainingToReserve,
        readinessStatus: line.readinessStatus,
      })
    }
  }

  return diffs
}

function buildCloseBlockers(
  lines: MaterialLinePosition[],
  differences: MaterialReconciliationDifference[],
): MaterialReconciliationBlocker[] {
  const blockers: MaterialReconciliationBlocker[] = []

  for (const d of differences.filter((x) => x.severity === 'BLOCKER')) {
    blockers.push({
      code: d.type,
      message: d.message,
      materialId: d.materialId,
      severity: 'BLOCKER',
    })
  }

  for (const line of lines) {
    if (line.readinessStatus === 'NOT_REQUIRED') continue

    if (isPositive(line.remainingToIssue)) {
      blockers.push({
        code: 'INCOMPLETE_ISSUE',
        message: `Material ${line.item.code} still requires issue of ${line.remainingToIssue}`,
        materialId: line.materialId,
        severity: 'BLOCKER',
      })
    }

    if (line.reservationStatus === 'ACTIVE' && isPositive(line.reservedQty) && isZero(line.remainingToIssue)) {
      if (!blockers.some((b) => b.materialId === line.materialId && b.code === 'OPEN_RESERVATION')) {
        blockers.push({
          code: 'OPEN_RESERVATION',
          message: `Release or fulfil remaining reservation on ${line.item.code} before close`,
          materialId: line.materialId,
          severity: 'BLOCKER',
        })
      }
    }
  }

  return blockers
}

function deriveReconciliationStatus(
  lines: MaterialLinePosition[],
  differences: MaterialReconciliationDifference[],
): MaterialReconciliationStatus {
  if (lines.length === 0) return 'NOT_STARTED'

  const actionable = lines.filter((l) => l.readinessStatus !== 'NOT_REQUIRED')
  if (actionable.length === 0) return 'BALANCED'

  const anyActivity = actionable.some(
    (l) =>
      isPositive(l.reservedQty) ||
      isPositive(l.issuedQty) ||
      isPositive(l.returnedQty) ||
      isPositive(l.transferredInQty) ||
      isPositive(l.transferredOutQty),
  )
  if (!anyActivity) return 'NOT_STARTED'

  // Shortage blocks material fulfilment; close blockers are listed separately.
  if (actionable.some((l) => l.readinessStatus === 'SHORT') || differences.some((d) => d.type === 'SHORTAGE')) {
    return 'BLOCKED'
  }

  const settled = actionable.every(
    (l) => l.readinessStatus === 'ISSUED' || l.readinessStatus === 'COMPLETE',
  )

  if (settled) {
    if (
      differences.some(
        (d) => d.type === 'ADDITIONAL_ISSUE' || d.type === 'HELD_QTY' || d.type === 'OPEN_RESERVATION',
      )
    ) {
      return 'DIFFERENCE'
    }
    return 'BALANCED'
  }

  return 'IN_PROGRESS'
}

export async function getMaterialReconciliation(tenantId: string, orderId: string, req?: Request) {
  const position = await getMaterialPosition(tenantId, orderId, req)
  const closePolicy = resolveMaterialClosePolicy()
  const differences = buildDifferences(position.lines)
  const blockers = buildCloseBlockers(position.lines, differences).filter((b) => {
    if (b.code === 'OPEN_RESERVATION' && !closePolicy.openReservationBlocksClose) return false
    if (b.code === 'INCOMPLETE_ISSUE' && !closePolicy.unissuedShortageBlocksOperationalCompletion) {
      return false
    }
    return true
  })

  // Held / unused material: STRICT requires return; TOLERANCE/MANAGER treat as difference unless over tolerance.
  if (closePolicy.unusedMaterialMustReturn) {
    for (const line of position.lines) {
      if (isPositive(line.heldQty)) {
        blockers.push({
          code: 'HELD_QTY',
          message: `Return unused ${line.heldQty} of ${line.item.code} before close (STRICT policy)`,
          materialId: line.materialId,
          severity: 'BLOCKER',
        })
      }
    }
  }

  const status = deriveReconciliationStatus(position.lines, differences)
  const differenceOnly =
    status === 'DIFFERENCE' && closePolicy.policy === 'MANAGER_APPROVAL' && closePolicy.openDifferenceRequiresApproval

  return {
    productionOrderId: orderId,
    status,
    closePolicy,
    canClose:
      blockers.length === 0 &&
      (status === 'BALANCED' || (status === 'DIFFERENCE' && !differenceOnly)),
    requiresManagerApproval: differenceOnly,
    summary: {
      ...position.summary,
      differenceCount: differences.length,
      blockerCount: blockers.length,
      heldLineCount: position.lines.filter((l) => isPositive(l.heldQty)).length,
    },
    lines: position.lines,
    differences,
    blockers,
  }
}
