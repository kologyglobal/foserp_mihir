import type { DispatchReadinessStatus } from '@prisma/client'
import type { DispatchBlocker } from '../shared/dispatch.types.js'

export interface ReadinessInput {
  salesOrderStatus: string
  remainingToDispatchQty: number
  netOrderedQty: number
  netDispatchedQty: number
  activeDraftDispatchQty: number
  availableToDispatchQty: number
  unrestrictedFgOnHand: number
  qualityHoldQty: number
  hasItemMapping: boolean
  hasCustomer: boolean
  hasShipTo: boolean
  commercialHold: boolean
  dispatchHold: boolean
  fulfilmentMismatch: boolean
  waitingForProduction: boolean
  waitingForQuality: boolean
  waitingForStock: boolean
  blockers: DispatchBlocker[]
}

export interface ReadinessResult {
  readinessStatus: DispatchReadinessStatus
  primaryBlockerCode: string | null
  blockers: DispatchBlocker[]
}

/**
 * Evaluation order (primary status):
 * cancelled → fully fulfilled → hold → reconciliation → missing customer/ship-to/item →
 * production → quality → stock → draft → partial → ready
 */
export function evaluateDispatchReadiness(input: ReadinessInput): ReadinessResult {
  const blockers = [...input.blockers]

  const markPrimary = (code: string | null, status: DispatchReadinessStatus): ReadinessResult => {
    const withPrimary = blockers.map((b, idx) => ({
      ...b,
      primary: code ? b.code === code : idx === 0 && b.severity === 'BLOCKER',
    }))
    return { readinessStatus: status, primaryBlockerCode: code, blockers: withPrimary }
  }

  if (input.salesOrderStatus === 'cancelled' || input.netOrderedQty <= 0) {
    return markPrimary('CANCELLED', 'CANCELLED')
  }
  if (input.remainingToDispatchQty <= 0 && input.netDispatchedQty > 0) {
    return markPrimary(null, 'FULLY_FULFILLED')
  }
  if (input.commercialHold || input.dispatchHold) {
    if (!blockers.some((b) => b.code === 'ON_HOLD')) {
      blockers.push({ code: 'ON_HOLD', message: 'Requirement is on commercial or dispatch hold', severity: 'BLOCKER' })
    }
    return markPrimary('ON_HOLD', 'ON_HOLD')
  }
  if (input.fulfilmentMismatch) {
    return markPrimary(
      blockers.find((b) => b.severity === 'BLOCKER')?.code ?? 'RECONCILIATION_REQUIRED',
      'RECONCILIATION_REQUIRED',
    )
  }
  if (!input.hasCustomer) {
    return markPrimary('MISSING_CUSTOMER', 'BLOCKED')
  }
  if (!input.hasItemMapping) {
    return markPrimary('ITEM_MAPPING_MISSING', 'BLOCKED')
  }
  if (blockers.some((b) => b.code === 'ITEM_NOT_DISPATCHABLE')) {
    return markPrimary('ITEM_NOT_DISPATCHABLE', 'BLOCKED')
  }
  if (!input.hasShipTo) {
    // warning only — do not hard-block ready queue for pilot; still surface
  }

  if (input.waitingForProduction && input.availableToDispatchQty <= 0) {
    if (!blockers.some((b) => b.code === 'WAITING_FOR_PRODUCTION')) {
      blockers.push({
        code: 'WAITING_FOR_PRODUCTION',
        message: 'No unrestricted finished goods available; production / FG receipt still required',
        severity: 'WARNING',
      })
    }
    return markPrimary('WAITING_FOR_PRODUCTION', 'WAITING_FOR_PRODUCTION')
  }

  if (input.waitingForQuality) {
    const code =
      blockers.find((b) => b.code === 'FINAL_QC_REQUIRED' || b.code === 'OPEN_INSPECTION' || b.code === 'OPEN_NCR' || b.code === 'STOCK_IN_QUALITY_HOLD')
        ?.code ?? 'WAITING_FOR_QUALITY'
    if (!blockers.some((b) => b.code === 'WAITING_FOR_QUALITY')) {
      blockers.push({
        code: 'WAITING_FOR_QUALITY',
        message: 'Final quality release is pending or stock remains in Quality Hold',
        severity: 'WARNING',
      })
    }
    return markPrimary(code, 'WAITING_FOR_QUALITY')
  }

  if (input.waitingForStock || (input.remainingToDispatchQty > 0 && input.availableToDispatchQty <= 0)) {
    if (!blockers.some((b) => b.code === 'WAITING_FOR_STOCK')) {
      blockers.push({
        code: 'WAITING_FOR_STOCK',
        message: 'Unrestricted finished goods stock is insufficient for the remaining quantity',
        severity: 'WARNING',
      })
    }
    return markPrimary('WAITING_FOR_STOCK', 'WAITING_FOR_STOCK')
  }

  if (input.activeDraftDispatchQty > 0 && input.availableToDispatchQty >= input.remainingToDispatchQty) {
    return markPrimary('ALREADY_IN_DRAFT_DISPATCH', 'ALREADY_IN_DRAFT_DISPATCH')
  }

  if (input.availableToDispatchQty > 0 && input.availableToDispatchQty < input.remainingToDispatchQty) {
    if (!blockers.some((b) => b.code === 'PARTIALLY_READY')) {
      blockers.push({
        code: 'PARTIALLY_READY',
        message: `Only ${input.availableToDispatchQty} of ${input.remainingToDispatchQty} units are currently ready`,
        severity: 'INFO',
      })
    }
    return markPrimary('PARTIALLY_READY', 'PARTIALLY_READY')
  }

  if (input.availableToDispatchQty > 0 && input.remainingToDispatchQty > 0) {
    return markPrimary(null, 'READY_TO_DISPATCH')
  }

  return markPrimary('NOT_READY', 'NOT_READY')
}
