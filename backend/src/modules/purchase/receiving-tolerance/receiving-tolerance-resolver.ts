import type { ResolvedReceivingTolerance } from './receiving-tolerance.types.js'
import { toQty } from './purchase-quantity-decimal.js'

export type ResolveReceivingToleranceInput = {
  receivingToleranceId?: string | null
  masterTolerance?: {
    id: string
    code: string
    name: string
    percentage: unknown
    status?: string
  } | null
  /** Legacy dual-read — used only when receivingToleranceId is null. */
  receivingTolerancePercentageLegacy?: unknown
  setupTolerancePct?: unknown
  allowOverReceipt?: boolean
}

/** FK presence determines master path — 0% is valid; never use truthy checks on percentage. */
export function resolveReceivingTolerance(
  input: ResolveReceivingToleranceInput,
): ResolvedReceivingTolerance {
  if (input.receivingToleranceId != null && input.masterTolerance) {
    return {
      source: 'MASTER',
      receivingToleranceId: input.masterTolerance.id,
      code: input.masterTolerance.code,
      name: input.masterTolerance.name,
      percentage: toQty(input.masterTolerance.percentage),
    }
  }

  if (input.receivingToleranceId != null) {
    return {
      source: 'MASTER',
      receivingToleranceId: input.receivingToleranceId,
      code: '',
      name: '',
      percentage: toQty(0),
    }
  }

  if (input.allowOverReceipt) {
    return {
      source: 'SETUP',
      receivingToleranceId: null,
      code: 'SETUP',
      name: 'Purchase Setup over-receipt',
      percentage: toQty(input.setupTolerancePct ?? 0),
    }
  }

  const legacy = input.receivingTolerancePercentageLegacy
  if (legacy != null && input.receivingToleranceId == null && !input.allowOverReceipt) {
    const legacyPct = toQty(legacy)
    if (!legacyPct.isZero()) {
      return {
        source: 'SYSTEM',
        receivingToleranceId: null,
        code: 'LEGACY',
        name: 'Legacy item tolerance',
        percentage: legacyPct,
      }
    }
  }

  return {
    source: 'SYSTEM',
    receivingToleranceId: null,
    code: 'EXACT',
    name: 'Exact receipt',
    percentage: toQty(0),
  }
}
