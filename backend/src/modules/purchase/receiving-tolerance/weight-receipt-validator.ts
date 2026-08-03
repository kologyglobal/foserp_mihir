import type { GrnLineWeightToleranceStatus } from '@prisma/client'
import { cmpQty, isZeroQty, subQty, toQty } from './purchase-quantity-decimal.js'
import {
  calculateExpectedWeight,
  calculateMaximumAllowedWeight,
} from './weight-calculator.js'
import type { QtyInput } from './receiving-tolerance.types.js'

export type WeightReceiptValidationResult = {
  expectedWeight: ReturnType<typeof toQty>
  maximumAllowedWeight: ReturnType<typeof toQty>
  weightVariance: ReturnType<typeof toQty>
  weightVariancePercentage: ReturnType<typeof toQty> | null
  weightToleranceStatus: GrnLineWeightToleranceStatus
}

export function validateWeightReceipt(input: {
  receivedUnitQuantity: QtyInput
  receivedWeight: QtyInput
  standardWeightPerBaseUnit: QtyInput
  tolerancePercentage: QtyInput
  receiptEntryMode: 'UNIT_ONLY' | 'WEIGHT_ONLY' | 'UNIT_AND_WEIGHT'
}): WeightReceiptValidationResult {
  if (input.receiptEntryMode === 'UNIT_ONLY') {
    return {
      expectedWeight: toQty(0),
      maximumAllowedWeight: toQty(0),
      weightVariance: toQty(0),
      weightVariancePercentage: null,
      weightToleranceStatus: 'NOT_APPLICABLE',
    }
  }

  const expectedWeight = calculateExpectedWeight({
    receivedUnitQuantity: input.receivedUnitQuantity,
    standardWeightPerBaseUnit: input.standardWeightPerBaseUnit,
  })
  const maximumAllowedWeight = calculateMaximumAllowedWeight({
    expectedWeight,
    tolerancePercentage: input.tolerancePercentage,
  })
  const receivedWeight = toQty(input.receivedWeight)
  const weightVariance = subQty(receivedWeight, expectedWeight)
  const weightVariancePercentage = expectedWeight.isZero()
    ? receivedWeight.isZero()
      ? null
      : toQty(100)
    : weightVariance.mul(100).div(expectedWeight)

  if (isZeroQty(receivedWeight) && isZeroQty(expectedWeight)) {
    return {
      expectedWeight,
      maximumAllowedWeight,
      weightVariance: toQty(0),
      weightVariancePercentage: null,
      weightToleranceStatus: 'NOT_APPLICABLE',
    }
  }

  if (cmpQty(receivedWeight, expectedWeight) === 0) {
    return {
      expectedWeight,
      maximumAllowedWeight,
      weightVariance: toQty(0),
      weightVariancePercentage: toQty(0),
      weightToleranceStatus: 'EXACT',
    }
  }

  if (cmpQty(receivedWeight, maximumAllowedWeight) <= 0 && cmpQty(receivedWeight, expectedWeight) > 0) {
    return {
      expectedWeight,
      maximumAllowedWeight,
      weightVariance,
      weightVariancePercentage,
      weightToleranceStatus: 'EXCESS_WITHIN_TOLERANCE',
    }
  }

  if (cmpQty(receivedWeight, maximumAllowedWeight) > 0) {
    return {
      expectedWeight,
      maximumAllowedWeight,
      weightVariance,
      weightVariancePercentage,
      weightToleranceStatus: 'EXCESS_OUTSIDE_TOLERANCE',
    }
  }

  return {
    expectedWeight,
    maximumAllowedWeight,
    weightVariance,
    weightVariancePercentage,
    weightToleranceStatus: 'EXACT',
  }
}

export function weightRequiresApproval(status: GrnLineWeightToleranceStatus): boolean {
  return status === 'EXCESS_OUTSIDE_TOLERANCE'
}
