import type { GrnLineToleranceStatus } from '@prisma/client'
import { cmpQty, isZeroQty, maxQty, mulQty, subQty, toQty } from './purchase-quantity-decimal.js'
import type { QtyInput } from './receiving-tolerance.types.js'

export type UnitReceiptValidationResult = {
  unitToleranceStatus: GrnLineToleranceStatus
  maximumAllowedUnitQuantity: ReturnType<typeof toQty>
  unitVariance: ReturnType<typeof toQty>
  variancePercentage: ReturnType<typeof toQty> | null
  shortQuantity: ReturnType<typeof toQty>
  excessQuantity: ReturnType<typeof toQty>
}

export function validateUnitReceipt(input: {
  openUnitQuantity: QtyInput
  receivedUnitQuantity: QtyInput
  tolerancePercentage: QtyInput
}): UnitReceiptValidationResult {
  const open = maxQty(toQty(input.openUnitQuantity), 0)
  const received = maxQty(toQty(input.receivedUnitQuantity), 0)
  const tolerancePct = toQty(input.tolerancePercentage)
  const maxAllowed = open.isZero()
    ? received
    : open.add(mulQty(open, tolerancePct.div(100)))

  const unitVariance = subQty(received, open)
  const variancePercentage = open.isZero()
    ? received.isZero()
      ? null
      : toQty(100)
    : unitVariance.mul(100).div(open)

  const shortQuantity = maxQty(subQty(open, received), 0)
  const excessQuantity = maxQty(subQty(received, open), 0)

  if (isZeroQty(received)) {
    return {
      unitToleranceStatus: 'NOT_RECEIVED',
      maximumAllowedUnitQuantity: maxAllowed,
      unitVariance,
      variancePercentage: open.isZero() ? null : toQty(-100),
      shortQuantity: open,
      excessQuantity: toQty(0),
    }
  }

  if (cmpQty(received, open) < 0) {
    return {
      unitToleranceStatus: 'PARTIAL',
      maximumAllowedUnitQuantity: maxAllowed,
      unitVariance,
      variancePercentage,
      shortQuantity,
      excessQuantity: toQty(0),
    }
  }

  if (cmpQty(received, open) === 0) {
    return {
      unitToleranceStatus: 'EXACT',
      maximumAllowedUnitQuantity: maxAllowed,
      unitVariance: toQty(0),
      variancePercentage: toQty(0),
      shortQuantity: toQty(0),
      excessQuantity: toQty(0),
    }
  }

  if (cmpQty(received, maxAllowed) <= 0) {
    return {
      unitToleranceStatus: 'EXCESS_WITHIN_TOLERANCE',
      maximumAllowedUnitQuantity: maxAllowed,
      unitVariance,
      variancePercentage,
      shortQuantity: toQty(0),
      excessQuantity,
    }
  }

  return {
    unitToleranceStatus: 'EXCESS_OUTSIDE_TOLERANCE',
    maximumAllowedUnitQuantity: maxAllowed,
    unitVariance,
    variancePercentage,
    shortQuantity: toQty(0),
    excessQuantity,
  }
}

export function unitRequiresApproval(status: GrnLineToleranceStatus): boolean {
  return status === 'EXCESS_OUTSIDE_TOLERANCE'
}
