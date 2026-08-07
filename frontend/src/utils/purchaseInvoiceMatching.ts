/** GRN line fields for invoice three-way match baseline. */
export type GrnLineMatchInput = {
  receivedQty?: number | null
  receivedUomQty?: number | null
  acceptedQty?: number | null
  acceptedUomQty?: number | null
  rejectedQty?: number | null
  rejectedUomQty?: number | null
  uomConversionFactor?: number | null
}

function n(v: unknown): number {
  return Number(v ?? 0)
}

function vendorUomQty(uomQty: unknown, baseQty: unknown, factor: number): number {
  const uom = n(uomQty)
  if (uom > 0) return uom
  const base = n(baseQty)
  if (base <= 0) return 0
  return factor === 1 ? base : base * factor
}

/**
 * Payable vendor qty for invoice match — QC-accepted when rejection exists, else received.
 * See backend purchase-invoice-matching.util.ts (same rules).
 */
export function billableGrnVendorQtyForInvoiceMatch(line: GrnLineMatchInput | null | undefined): number {
  if (!line) return 0
  const factor = n(line.uomConversionFactor) || 1
  const received = vendorUomQty(line.receivedUomQty, line.receivedQty, factor)
  const accepted = vendorUomQty(line.acceptedUomQty, line.acceptedQty, factor)
  const rejectedBase = n(line.rejectedQty)
  const rejectedUom = n(line.rejectedUomQty)

  if (rejectedBase > 0 || rejectedUom > 0) return accepted
  if (accepted > 0 && received > 0 && Math.abs(accepted - received) > 1e-6) return accepted
  return received > 0 ? received : accepted
}

export function pctDiff(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 100
  return (Math.abs(a - b) / Math.abs(b)) * 100
}
