/**
 * Phase 7 — e-Way Bill readiness, Part A/B, threshold helpers (pure, no I/O).
 */
export type EwaySourceType = 'SALES_INVOICE' | 'DELIVERY_CHALLAN'

export type EwayPartA = {
  fromPlace: string
  toPlace: string
  distanceKm: number
  documentNumber?: string | null
  sellerGstin?: string | null
}

export type EwayPartB = {
  vehicleNumber?: string | null
  transporterId?: string | null
  transporterName?: string | null
  transportMode?: '1' | '2' | '3' | '4' | null
}

export function evaluateThreshold(taxableAmount: number, thresholdInr: number, force?: boolean): {
  required: boolean
  reason: string
} {
  if (force) {
    return {
      required: true,
      reason:
        taxableAmount < thresholdInr
          ? 'Forced generate (below threshold)'
          : `Taxable consignment exceeds applicable threshold (₹${thresholdInr.toLocaleString('en-IN')}; value ₹${Math.round(taxableAmount).toLocaleString('en-IN')})`,
    }
  }
  if (taxableAmount >= thresholdInr) {
    return {
      required: true,
      reason: `Taxable consignment exceeds applicable threshold (₹${thresholdInr.toLocaleString('en-IN')}; value ₹${Math.round(taxableAmount).toLocaleString('en-IN')})`,
    }
  }
  return {
    required: false,
    reason: `Consignment value at or below general ₹${thresholdInr.toLocaleString('en-IN')} FAQ threshold (subject to rules/exceptions)`,
  }
}

export function validateEwayPartA(partA: EwayPartA): { ok: true } | { ok: false; message: string } {
  if (!partA.fromPlace?.trim()) return { ok: false, message: 'Part A: fromPlace is required' }
  if (!partA.toPlace?.trim()) return { ok: false, message: 'Part A: toPlace is required' }
  if (partA.distanceKm < 0 || partA.distanceKm > 20000) {
    return { ok: false, message: 'Part A: distanceKm must be between 0 and 20000' }
  }
  if (!partA.sellerGstin?.trim()) {
    return { ok: false, message: 'Part A: seller GSTIN (legal entity) is required' }
  }
  return { ok: true }
}

/**
 * Part B (transport details). Road (mode 1 / default) needs vehicle or transporter id.
 * Rail/air/ship (2–4) may rely on transporter only.
 */
export function validateEwayPartB(partB: EwayPartB, opts?: { requirePartB?: boolean }): {
  ok: true
  warnings: string[]
} | { ok: false; message: string; warnings: string[] } {
  const warnings: string[] = []
  const mode = partB.transportMode ?? '1'
  const vehicle = partB.vehicleNumber?.trim()
  const transporterId = partB.transporterId?.trim()
  const transporterName = partB.transporterName?.trim()

  if (!opts?.requirePartB) {
    if (!vehicle && !transporterId) {
      warnings.push('Part B incomplete — vehicle or transporter id recommended before consignment moves')
    }
    return { ok: true, warnings }
  }

  if (mode === '1') {
    if (!vehicle && !transporterId) {
      return {
        ok: false,
        message: 'Part B: road movement requires vehicleNumber or transporterId',
        warnings,
      }
    }
  } else if (!transporterId && !transporterName) {
    return {
      ok: false,
      message: 'Part B: non-road movement requires transporter details',
      warnings,
    }
  }
  return { ok: true, warnings }
}

export function checkEwaySourceReadiness(input: {
  sourceType: EwaySourceType
  documentStatus: string
}): { ok: true } | { ok: false; message: string } {
  if (input.sourceType === 'SALES_INVOICE' && input.documentStatus !== 'POSTED') {
    return { ok: false, message: 'Only posted sales invoices can generate an e-way bill' }
  }
  if (input.sourceType === 'DELIVERY_CHALLAN' && input.documentStatus !== 'ISSUED') {
    return { ok: false, message: 'Only issued delivery challans can generate an e-way bill' }
  }
  return { ok: true }
}

export function planEwayGenerate(existing: { status: string; ewbNumber: string | null } | null): {
  action: 'IDEMPOTENT_RETURN' | 'RETRY' | 'CREATE' | 'BLOCK'
  reason?: string
} {
  if (!existing) return { action: 'CREATE' }
  if (existing.status === 'GENERATED' && existing.ewbNumber) return { action: 'IDEMPOTENT_RETURN' }
  if (existing.status === 'CANCELLED') {
    return { action: 'BLOCK', reason: 'Previous e-way bill was cancelled — revise source document before regenerating' }
  }
  if (existing.status === 'NOT_REQUIRED') return { action: 'IDEMPOTENT_RETURN' }
  if (existing.status === 'EXCEPTION' || existing.status === 'REQUIRED') return { action: 'RETRY' }
  return { action: 'CREATE' }
}

/** Simulated extension: valid_upto must still be future; max +1 day per call in SIMULATOR rules. */
export function planEwayExtension(input: {
  status: string
  validUpto: Date | string | null
  now?: Date
  extensionHours?: number
}): { ok: true; newValidUpto: Date } | { ok: false; message: string } {
  if (input.status !== 'GENERATED') {
    return { ok: false, message: 'Only generated e-way bills can be extended' }
  }
  if (!input.validUpto) {
    return { ok: false, message: 'E-way bill has no validity timestamp to extend' }
  }
  const now = input.now ?? new Date()
  const current = typeof input.validUpto === 'string' ? new Date(input.validUpto) : input.validUpto
  if (Number.isNaN(current.getTime())) {
    return { ok: false, message: 'Invalid validUpto' }
  }
  if (current.getTime() < now.getTime() - 60_000) {
    return { ok: false, message: 'E-way bill validity already expired — extension not allowed in this product path' }
  }
  const hours = Math.min(Math.max(input.extensionHours ?? 8, 1), 24)
  const newValidUpto = new Date(current)
  newValidUpto.setHours(newValidUpto.getHours() + hours)
  return { ok: true, newValidUpto }
}
