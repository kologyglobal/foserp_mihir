/**
 * GRN receiving tolerance — delegates to receiving-tolerance domain service.
 * Backend result is authoritative; this module preserves legacy call sites.
 */
import type { GrnLineToleranceStatus } from '@prisma/client'
import {
  evaluateReceiptLine,
  qtyToNumber,
  resolveReceivingTolerance,
  type ReceiptLineEvaluationInput,
} from '../receiving-tolerance/index.js'

export type GrnLineToleranceStatusLegacy = GrnLineToleranceStatus

export type EvaluateGrnToleranceInput = {
  openQuantity: number
  receivedQuantity: number
  itemTolerancePct?: number | null
  receivingToleranceId?: string | null
  masterTolerance?: ReceiptLineEvaluationInput['masterTolerance']
  setupTolerancePct?: number | null
  allowOverReceipt?: boolean
  closeOpenQuantity?: boolean
  shortCloseRequested?: boolean
  shortCloseReason?: string | null
  receivedWeight?: number | null
  standardWeightPerBaseUnit?: number | null
  receiptEntryMode?: ReceiptLineEvaluationInput['receiptEntryMode']
  manualUnitEntry?: boolean
  manualWeightEntry?: boolean
  weightUomCode?: string | null
}

export type EvaluateGrnToleranceResult = {
  tolerancePercentage: number
  variancePercentage: number | null
  lowerBound: number
  upperBound: number
  shortQuantity: number
  excessQuantity: number
  toleranceStatus: GrnLineToleranceStatus
  requiresApproval: boolean
  approvalReasons: string[]
  receivingToleranceIdSnapshot: string | null
  receivingToleranceCodeSnapshot: string
  receivingToleranceNameSnapshot: string
  receivingTolerancePercentageSnapshot: number
  maximumAllowedUnitQuantity: number
  unitVariance: number
  expectedWeight: number | null
  maximumAllowedWeight: number | null
  receivedWeight: number | null
  weightVariance: number | null
  weightVariancePercentage: number | null
  weightConversionRateSnapshot: number | null
  weightUomCodeSnapshot: string
  weightToleranceStatus: string
  manualUnitEntry: boolean
  manualWeightEntry: boolean
  shortCloseRequested: boolean
  shortCloseReason: string | null
}

export function resolveReceivingTolerancePct(input: {
  receivingToleranceId?: string | null
  masterTolerance?: ReceiptLineEvaluationInput['masterTolerance']
  itemTolerancePct?: number | null
  setupTolerancePct?: number | null
  allowOverReceipt?: boolean
}): number {
  return qtyToNumber(
    resolveReceivingTolerance({
      receivingToleranceId: input.receivingToleranceId,
      masterTolerance: input.masterTolerance ?? null,
      receivingTolerancePercentageLegacy: input.itemTolerancePct,
      setupTolerancePct: input.setupTolerancePct,
      allowOverReceipt: input.allowOverReceipt,
    }).percentage,
  )
}

export function evaluateGrnLineTolerance(input: EvaluateGrnToleranceInput): EvaluateGrnToleranceResult {
  const evaluated = evaluateReceiptLine({
    openUnitQuantity: input.openQuantity,
    receivedUnitQuantity: input.receivedQuantity,
    receivingToleranceId: input.receivingToleranceId,
    masterTolerance: input.masterTolerance,
    receivingTolerancePercentage: input.itemTolerancePct,
    setupTolerancePct: input.setupTolerancePct,
    allowOverReceipt: input.allowOverReceipt,
    shortCloseRequested: input.shortCloseRequested ?? input.closeOpenQuantity,
    shortCloseReason: input.shortCloseReason,
    receivedWeight: input.receivedWeight,
    standardWeightPerBaseUnit: input.standardWeightPerBaseUnit,
    receiptEntryMode: input.receiptEntryMode,
    manualUnitEntry: input.manualUnitEntry,
    manualWeightEntry: input.manualWeightEntry,
    weightUomCode: input.weightUomCode,
  })

  const open = input.openQuantity
  const pct = qtyToNumber(evaluated.tolerancePercentage)
  const band = open > 0 ? (open * pct) / 100 : 0

  return {
    tolerancePercentage: pct,
    variancePercentage: evaluated.variancePercentage ? qtyToNumber(evaluated.variancePercentage) : null,
    lowerBound: Math.max(0, open - band),
    upperBound: open + band,
    shortQuantity: qtyToNumber(evaluated.shortQuantity),
    excessQuantity: qtyToNumber(evaluated.excessQuantity),
    toleranceStatus: evaluated.unitToleranceStatus,
    requiresApproval: evaluated.requiresApproval,
    approvalReasons: evaluated.approvalReasons,
    receivingToleranceIdSnapshot: evaluated.receivingToleranceIdSnapshot,
    receivingToleranceCodeSnapshot: evaluated.receivingToleranceCodeSnapshot,
    receivingToleranceNameSnapshot: evaluated.receivingToleranceNameSnapshot,
    receivingTolerancePercentageSnapshot: qtyToNumber(evaluated.receivingTolerancePercentageSnapshot),
    maximumAllowedUnitQuantity: qtyToNumber(evaluated.maximumAllowedUnitQuantity),
    unitVariance: qtyToNumber(evaluated.unitVariance),
    expectedWeight: evaluated.expectedWeight ? qtyToNumber(evaluated.expectedWeight) : null,
    maximumAllowedWeight: evaluated.maximumAllowedWeight
      ? qtyToNumber(evaluated.maximumAllowedWeight)
      : null,
    receivedWeight: evaluated.receivedWeight ? qtyToNumber(evaluated.receivedWeight) : null,
    weightVariance: evaluated.weightVariance ? qtyToNumber(evaluated.weightVariance) : null,
    weightVariancePercentage: evaluated.weightVariancePercentage
      ? qtyToNumber(evaluated.weightVariancePercentage)
      : null,
    weightConversionRateSnapshot: evaluated.weightConversionRateSnapshot
      ? qtyToNumber(evaluated.weightConversionRateSnapshot)
      : null,
    weightUomCodeSnapshot: evaluated.weightUomCodeSnapshot,
    weightToleranceStatus: evaluated.weightToleranceStatus,
    manualUnitEntry: evaluated.manualUnitEntry,
    manualWeightEntry: evaluated.manualWeightEntry,
    shortCloseRequested: evaluated.shortCloseRequested,
    shortCloseReason: evaluated.shortCloseReason,
  }
}

export function lineRequiresToleranceApproval(status: GrnLineToleranceStatus): boolean {
  return status === 'EXCESS_OUTSIDE_TOLERANCE'
}

export type GrnToleranceLineSnapshot = {
  itemCode?: string
  openQuantity: number
  receivedQuantity: number
  itemTolerancePct?: number | null
  receivingToleranceId?: string | null
  masterTolerance?: ReceiptLineEvaluationInput['masterTolerance']
  setupTolerancePct?: number | null
  allowOverReceipt?: boolean
  closeOpenQuantity?: boolean
  shortCloseRequested?: boolean
  receivedWeight?: number | null
  standardWeightPerBaseUnit?: number | null
  receiptEntryMode?: ReceiptLineEvaluationInput['receiptEntryMode']
}

export type GrnDocumentToleranceSummary = {
  lineCount: number
  notReceivedCount: number
  partialCount: number
  exactCount: number
  excessWithinCount: number
  outsideCount: number
  receivableLineCount: number
  allNotReceived: boolean
  requiresApproval: boolean
  lines: Array<EvaluateGrnToleranceResult & { itemCode?: string }>
}

export function evaluateGrnDocumentTolerance(
  lines: GrnToleranceLineSnapshot[],
): GrnDocumentToleranceSummary {
  const evaluated = lines.map((l) => {
    const result = evaluateGrnLineTolerance({
      openQuantity: l.openQuantity,
      receivedQuantity: l.receivedQuantity,
      itemTolerancePct: l.itemTolerancePct,
      receivingToleranceId: l.receivingToleranceId,
      masterTolerance: l.masterTolerance,
      setupTolerancePct: l.setupTolerancePct,
      allowOverReceipt: l.allowOverReceipt,
      closeOpenQuantity: l.closeOpenQuantity,
      shortCloseRequested: l.shortCloseRequested ?? l.closeOpenQuantity,
      receivedWeight: l.receivedWeight,
      standardWeightPerBaseUnit: l.standardWeightPerBaseUnit,
      receiptEntryMode: l.receiptEntryMode,
    })
    return { ...result, itemCode: l.itemCode }
  })

  const notReceivedCount = evaluated.filter((l) => l.toleranceStatus === 'NOT_RECEIVED').length
  const partialCount = evaluated.filter((l) => l.toleranceStatus === 'PARTIAL').length
  const exactCount = evaluated.filter((l) => l.toleranceStatus === 'EXACT').length
  const excessWithinCount = evaluated.filter((l) => l.toleranceStatus === 'EXCESS_WITHIN_TOLERANCE').length
  const outsideCount = evaluated.filter((l) => l.requiresApproval).length
  const receivableLineCount = lines.filter((l) => l.receivedQuantity > 0).length

  return {
    lineCount: evaluated.length,
    notReceivedCount,
    partialCount,
    exactCount,
    excessWithinCount,
    outsideCount,
    receivableLineCount,
    allNotReceived: evaluated.length > 0 && notReceivedCount === evaluated.length,
    requiresApproval: outsideCount > 0,
    lines: evaluated,
  }
}
