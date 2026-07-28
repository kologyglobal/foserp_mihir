/**
 * GRN receiving tolerance vs open (pending) qty — frontend mirror of backend calculator.
 */

export type GrnLineToleranceStatus =
  | 'OK'
  | 'PARTIAL'
  | 'NOT_RECEIVED'
  | 'SHORT_OUTSIDE'
  | 'EXCESS_WITHIN'
  | 'EXCESS_OUTSIDE'

export type EvaluateGrnToleranceInput = {
  openQuantity: number
  receivedQuantity: number
  itemTolerancePct?: number | null
  setupTolerancePct?: number | null
  allowOverReceipt?: boolean
  closeOpenQuantity?: boolean
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
}

function n(value: unknown, fallback = 0): number {
  const x = Number(value ?? fallback)
  return Number.isFinite(x) ? x : fallback
}

export function resolveReceivingTolerancePct(input: {
  itemTolerancePct?: number | null
  setupTolerancePct?: number | null
  allowOverReceipt?: boolean
}): number {
  const item = n(input.itemTolerancePct)
  if (item > 0) return item
  if (input.allowOverReceipt) {
    const setup = n(input.setupTolerancePct)
    return setup > 0 ? setup : 0
  }
  return 0
}

export function evaluateGrnLineTolerance(input: EvaluateGrnToleranceInput): EvaluateGrnToleranceResult {
  const open = Math.max(0, n(input.openQuantity))
  const received = Math.max(0, n(input.receivedQuantity))
  const tolerancePercentage = resolveReceivingTolerancePct(input)
  const band = open > 0 ? (open * tolerancePercentage) / 100 : 0
  const lowerBound = Math.max(0, open - band)
  const upperBound = open + band
  const shortQuantity = Math.max(0, open - received)
  const excessQuantity = Math.max(0, received - open)
  const variancePercentage =
    open > 0 ? Number((((received - open) / open) * 100).toFixed(4)) : received > 0 ? 100 : null

  if (received <= 0) {
    return {
      tolerancePercentage,
      variancePercentage: open > 0 ? -100 : null,
      lowerBound,
      upperBound,
      shortQuantity: open,
      excessQuantity: 0,
      toleranceStatus: 'NOT_RECEIVED',
      requiresApproval: false,
    }
  }

  if (received > upperBound + 1e-9) {
    return {
      tolerancePercentage,
      variancePercentage,
      lowerBound,
      upperBound,
      shortQuantity,
      excessQuantity,
      toleranceStatus: 'EXCESS_OUTSIDE',
      requiresApproval: true,
    }
  }

  if (received > open + 1e-9 && received <= upperBound + 1e-9) {
    return {
      tolerancePercentage,
      variancePercentage,
      lowerBound,
      upperBound,
      shortQuantity,
      excessQuantity,
      toleranceStatus: 'EXCESS_WITHIN',
      requiresApproval: false,
    }
  }

  if (received + 1e-9 >= lowerBound && received <= upperBound + 1e-9) {
    return {
      tolerancePercentage,
      variancePercentage,
      lowerBound,
      upperBound,
      shortQuantity,
      excessQuantity,
      toleranceStatus: 'OK',
      requiresApproval: false,
    }
  }

  if (input.closeOpenQuantity) {
    return {
      tolerancePercentage,
      variancePercentage,
      lowerBound,
      upperBound,
      shortQuantity,
      excessQuantity,
      toleranceStatus: 'SHORT_OUTSIDE',
      requiresApproval: true,
    }
  }

  return {
    tolerancePercentage,
    variancePercentage,
    lowerBound,
    upperBound,
    shortQuantity,
    excessQuantity,
    toleranceStatus: 'PARTIAL',
    requiresApproval: false,
  }
}

export const GRN_TOLERANCE_STATUS_LABELS: Record<GrnLineToleranceStatus, string> = {
  OK: 'OK',
  PARTIAL: 'Partial',
  NOT_RECEIVED: 'Not received',
  SHORT_OUTSIDE: 'Short (outside tolerance)',
  EXCESS_WITHIN: 'Excess (within tolerance)',
  EXCESS_OUTSIDE: 'Excess (outside tolerance)',
}

export function lineRequiresToleranceApproval(status: GrnLineToleranceStatus): boolean {
  return status === 'SHORT_OUTSIDE' || status === 'EXCESS_OUTSIDE'
}

/** One evaluated GRN line for document-level rollup (multi-item receive). */
export type GrnToleranceLineSnapshot = {
  itemCode?: string
  openQuantity: number
  receivedQuantity: number
  itemTolerancePct?: number | null
  setupTolerancePct?: number | null
  allowOverReceipt?: boolean
  closeOpenQuantity?: boolean
}

export type GrnDocumentToleranceSummary = {
  lineCount: number
  notReceivedCount: number
  partialCount: number
  okCount: number
  excessWithinCount: number
  outsideCount: number
  /** Lines with receivedQuantity > 0 (will move stock / reduce PO open). */
  receivableLineCount: number
  allNotReceived: boolean
  /** True if ANY line is SHORT_OUTSIDE or EXCESS_OUTSIDE — whole GRN needs approval. */
  requiresApproval: boolean
  lines: Array<EvaluateGrnToleranceResult & { itemCode?: string }>
}

/**
 * Evaluate every line independently, then roll up header flags.
 * Receiving 1 of 3 items → that line OK/PARTIAL/…; others NOT_RECEIVED; no approval unless the received line is outside.
 */
export function evaluateGrnDocumentTolerance(
  lines: GrnToleranceLineSnapshot[],
): GrnDocumentToleranceSummary {
  const evaluated = lines.map((l) => {
    const result = evaluateGrnLineTolerance({
      openQuantity: l.openQuantity,
      receivedQuantity: l.receivedQuantity,
      itemTolerancePct: l.itemTolerancePct,
      setupTolerancePct: l.setupTolerancePct,
      allowOverReceipt: l.allowOverReceipt,
      closeOpenQuantity: l.closeOpenQuantity,
    })
    return { ...result, itemCode: l.itemCode }
  })

  const notReceivedCount = evaluated.filter((l) => l.toleranceStatus === 'NOT_RECEIVED').length
  const partialCount = evaluated.filter((l) => l.toleranceStatus === 'PARTIAL').length
  const okCount = evaluated.filter((l) => l.toleranceStatus === 'OK').length
  const excessWithinCount = evaluated.filter((l) => l.toleranceStatus === 'EXCESS_WITHIN').length
  const outsideCount = evaluated.filter((l) => lineRequiresToleranceApproval(l.toleranceStatus)).length
  const receivableLineCount = lines.filter((l) => n(l.receivedQuantity) > 0).length

  return {
    lineCount: evaluated.length,
    notReceivedCount,
    partialCount,
    okCount,
    excessWithinCount,
    outsideCount,
    receivableLineCount,
    allNotReceived: evaluated.length > 0 && notReceivedCount === evaluated.length,
    requiresApproval: outsideCount > 0,
    lines: evaluated,
  }
}
