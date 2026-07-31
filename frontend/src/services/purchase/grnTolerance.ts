/**
 * GRN receiving tolerance — frontend mirror (demo mode). API mode uses POST /purchase/grns/evaluate-lines.
 * Excess-only band; no symmetric lower tolerance.
 */

export type GrnLineToleranceStatus =
  | 'NOT_RECEIVED'
  | 'PARTIAL'
  | 'EXACT'
  | 'EXCESS_WITHIN_TOLERANCE'
  | 'EXCESS_OUTSIDE_TOLERANCE'

export type EvaluateGrnToleranceInput = {
  openQuantity: number
  receivedQuantity: number
  itemTolerancePct?: number | null
  receivingToleranceId?: string | null
  setupTolerancePct?: number | null
  allowOverReceipt?: boolean
  shortCloseRequested?: boolean
}

export type EvaluateGrnToleranceResult = {
  tolerancePercentage: number
  variancePercentage: number | null
  upperBound: number
  shortQuantity: number
  excessQuantity: number
  toleranceStatus: GrnLineToleranceStatus
  requiresApproval: boolean
}

function n(value: unknown, fallback = 0): number {
  const x = Number(value ?? fallback)
  return Number.isFinite(x) ? x : fallback
}

export function resolveReceivingTolerancePct(input: {
  receivingToleranceId?: string | null
  itemTolerancePct?: number | null
  setupTolerancePct?: number | null
  allowOverReceipt?: boolean
}): number {
  if (input.receivingToleranceId != null) {
    return n(input.itemTolerancePct)
  }
  if (input.allowOverReceipt) return n(input.setupTolerancePct)
  const legacy = n(input.itemTolerancePct)
  return legacy > 0 ? legacy : 0
}

export function evaluateGrnLineTolerance(input: EvaluateGrnToleranceInput): EvaluateGrnToleranceResult {
  const open = Math.max(0, n(input.openQuantity))
  const received = Math.max(0, n(input.receivedQuantity))
  const tolerancePercentage = resolveReceivingTolerancePct(input)
  const upperBound = open + (open > 0 ? (open * tolerancePercentage) / 100 : 0)
  const shortQuantity = Math.max(0, open - received)
  const excessQuantity = Math.max(0, received - open)
  const variancePercentage =
    open > 0 ? Number((((received - open) / open) * 100).toFixed(4)) : received > 0 ? 100 : null

  if (received <= 0) {
    return {
      tolerancePercentage,
      variancePercentage: open > 0 ? -100 : null,
      upperBound,
      shortQuantity: open,
      excessQuantity: 0,
      toleranceStatus: 'NOT_RECEIVED',
      requiresApproval: false,
    }
  }

  if (received < open) {
    return {
      tolerancePercentage,
      variancePercentage,
      upperBound,
      shortQuantity,
      excessQuantity: 0,
      toleranceStatus: 'PARTIAL',
      requiresApproval: Boolean(input.shortCloseRequested),
    }
  }

  if (received === open) {
    return {
      tolerancePercentage,
      variancePercentage: 0,
      upperBound,
      shortQuantity: 0,
      excessQuantity: 0,
      toleranceStatus: 'EXACT',
      requiresApproval: Boolean(input.shortCloseRequested),
    }
  }

  if (received <= upperBound + 1e-9) {
    return {
      tolerancePercentage,
      variancePercentage,
      upperBound,
      shortQuantity: 0,
      excessQuantity,
      toleranceStatus: 'EXCESS_WITHIN_TOLERANCE',
      requiresApproval: Boolean(input.shortCloseRequested),
    }
  }

  return {
    tolerancePercentage,
    variancePercentage,
    upperBound,
    shortQuantity: 0,
    excessQuantity,
    toleranceStatus: 'EXCESS_OUTSIDE_TOLERANCE',
    requiresApproval: true,
  }
}

export const GRN_TOLERANCE_STATUS_LABELS: Record<GrnLineToleranceStatus, string> = {
  NOT_RECEIVED: 'Not received',
  PARTIAL: 'Partial',
  EXACT: 'Exact',
  EXCESS_WITHIN_TOLERANCE: 'Excess (within tolerance)',
  EXCESS_OUTSIDE_TOLERANCE: 'Excess (outside tolerance)',
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
  setupTolerancePct?: number | null
  allowOverReceipt?: boolean
  shortCloseRequested?: boolean
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
      setupTolerancePct: l.setupTolerancePct,
      allowOverReceipt: l.allowOverReceipt,
      shortCloseRequested: l.shortCloseRequested,
    })
    return { ...result, itemCode: l.itemCode }
  })

  const notReceivedCount = evaluated.filter((l) => l.toleranceStatus === 'NOT_RECEIVED').length
  const partialCount = evaluated.filter((l) => l.toleranceStatus === 'PARTIAL').length
  const exactCount = evaluated.filter((l) => l.toleranceStatus === 'EXACT').length
  const excessWithinCount = evaluated.filter((l) => l.toleranceStatus === 'EXCESS_WITHIN_TOLERANCE').length
  const outsideCount = evaluated.filter((l) => l.requiresApproval).length
  const receivableLineCount = lines.filter((l) => n(l.receivedQuantity) > 0).length

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
