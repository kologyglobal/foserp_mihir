import { invoiceQty } from './purchase-invoice.workflow.js'

/** GRN line fields needed to derive billable vendor qty for three-way match. */
export type GrnLineMatchInput = {
  receivedQuantity?: unknown
  receivedUomQuantity?: unknown
  acceptedQuantity?: unknown
  acceptedUomQuantity?: unknown
  rejectedQuantity?: unknown
  rejectedUomQuantity?: unknown
  uomConversionFactor?: unknown
}

function vendorUomQty(
  uomQty: unknown,
  baseQty: unknown,
  factor: number,
): number {
  const uom = invoiceQty(uomQty)
  if (uom > 0) return uom
  const base = invoiceQty(baseQty)
  if (base <= 0) return 0
  return factor === 1 ? base : base * factor
}

/**
 * Quantity the vendor invoice should match after GRN + QC.
 *
 * - Before QC: physical receipt (`receivedUomQuantity`).
 * - After partial/full QC rejection: QC-accepted vendor qty (payable), not gross receipt.
 *
 * Example: received 20 NOS, QC accepted 15 / rejected 5 → billable baseline is 15, not 20.
 * Casting (unit + weight): unit receipt may be exact while weight uses a separate GRN tolerance band;
 * invoice match still uses vendor UOM qty columns, not weight.
 */
export function billableGrnVendorQtyForInvoiceMatch(line: GrnLineMatchInput | null | undefined): number {
  if (!line) return 0
  const factor = invoiceQty(line.uomConversionFactor) || 1
  const received = vendorUomQty(line.receivedUomQuantity, line.receivedQuantity, factor)
  const accepted = vendorUomQty(line.acceptedUomQuantity, line.acceptedQuantity, factor)
  const rejectedBase = invoiceQty(line.rejectedQuantity)
  const rejectedUom = invoiceQty(line.rejectedUomQuantity)

  if (rejectedBase > 0 || rejectedUom > 0) return accepted
  if (accepted > 0 && received > 0 && Math.abs(accepted - received) > 1e-6) return accepted
  return received > 0 ? received : accepted
}

export function pctDiff(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 100
  return (Math.abs(a - b) / Math.abs(b)) * 100
}
