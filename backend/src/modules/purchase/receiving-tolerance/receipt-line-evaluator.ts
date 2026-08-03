import type { GrnReceiptApprovalReason } from '@prisma/client'
import { resolveReceivingTolerance } from './receiving-tolerance-resolver.js'
import { unitRequiresApproval, validateUnitReceipt } from './unit-receipt-validator.js'
import { validateWeightReceipt, weightRequiresApproval } from './weight-receipt-validator.js'
import type { ReceiptLineEvaluationInput, ReceiptLineEvaluationResult } from './receiving-tolerance.types.js'
import { toQty } from './purchase-quantity-decimal.js'

export function evaluateReceiptLine(input: ReceiptLineEvaluationInput): ReceiptLineEvaluationResult {
  const resolved = resolveReceivingTolerance({
    receivingToleranceId: input.receivingToleranceId,
    masterTolerance: input.masterTolerance ?? null,
    receivingTolerancePercentageLegacy: input.receivingTolerancePercentage,
    setupTolerancePct: input.setupTolerancePct,
    allowOverReceipt: input.allowOverReceipt,
  })

  const receiptEntryMode = input.receiptEntryMode ?? 'UNIT_ONLY'
  const unit = validateUnitReceipt({
    openUnitQuantity: input.openUnitQuantity,
    receivedUnitQuantity: input.receivedUnitQuantity,
    tolerancePercentage: resolved.percentage,
  })

  const weight = validateWeightReceipt({
    receivedUnitQuantity: input.receivedUnitQuantity,
    receivedWeight: input.receivedWeight ?? 0,
    standardWeightPerBaseUnit: input.standardWeightPerBaseUnit ?? 0,
    tolerancePercentage: resolved.percentage,
    receiptEntryMode,
  })

  const approvalReasons: GrnReceiptApprovalReason[] = []
  if (unitRequiresApproval(unit.unitToleranceStatus)) {
    approvalReasons.push('UNIT_OVER_TOLERANCE')
  }
  if (weightRequiresApproval(weight.weightToleranceStatus)) {
    approvalReasons.push('WEIGHT_OVER_TOLERANCE')
  }
  const shortCloseRequested = Boolean(input.shortCloseRequested)
  if (shortCloseRequested) {
    approvalReasons.push('SHORT_CLOSE_REQUESTED')
  }

  const requiresApproval = approvalReasons.length > 0

  return {
    tolerancePercentage: resolved.percentage,
    receivingToleranceIdSnapshot: resolved.receivingToleranceId,
    receivingToleranceCodeSnapshot: resolved.code,
    receivingToleranceNameSnapshot: resolved.name,
    receivingTolerancePercentageSnapshot: resolved.percentage,
    maximumAllowedUnitQuantity: unit.maximumAllowedUnitQuantity,
    unitVariance: unit.unitVariance,
    variancePercentage: unit.variancePercentage,
    unitToleranceStatus: unit.unitToleranceStatus,
    receivedWeight:
      receiptEntryMode === 'UNIT_ONLY' ? null : toQty(input.receivedWeight ?? 0),
    expectedWeight: receiptEntryMode === 'UNIT_ONLY' ? null : weight.expectedWeight,
    maximumAllowedWeight: receiptEntryMode === 'UNIT_ONLY' ? null : weight.maximumAllowedWeight,
    weightVariance: receiptEntryMode === 'UNIT_ONLY' ? null : weight.weightVariance,
    weightVariancePercentage:
      receiptEntryMode === 'UNIT_ONLY' ? null : weight.weightVariancePercentage,
    weightConversionRateSnapshot:
      receiptEntryMode === 'UNIT_ONLY' ? null : toQty(input.standardWeightPerBaseUnit ?? 0),
    weightUomCodeSnapshot: input.weightUomCode ?? '',
    weightToleranceStatus: weight.weightToleranceStatus,
    manualUnitEntry: Boolean(input.manualUnitEntry),
    manualWeightEntry: Boolean(input.manualWeightEntry),
    requiresApproval,
    approvalReasons,
    shortCloseRequested,
    shortCloseReason: input.shortCloseReason ?? null,
    shortQuantity: unit.shortQuantity,
    excessQuantity: unit.excessQuantity,
  }
}
