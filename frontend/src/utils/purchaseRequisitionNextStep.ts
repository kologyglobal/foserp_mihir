import type { PurchaseRequisition, PurchaseRequisitionListRow } from '@/types/purchaseDomain'

/** Approved for Direct Purchase Planning (Planning Sheet rows; no RFQ). */
export function isPrPendingPo(
  pr: Pick<PurchaseRequisition, 'status' | 'rfqRequired' | 'convertedPoId'>,
): boolean {
  if (pr.rfqRequired || pr.convertedPoId) return false
  return pr.status === 'approved' || pr.status === 'partially_converted'
}

/** Approved and waiting for RFQ creation. */
export function isPrPendingRfq(
  pr: Pick<PurchaseRequisition, 'status' | 'rfqRequired' | 'convertedRfqId'>,
): boolean {
  return pr.status === 'approved' && pr.rfqRequired && !pr.convertedRfqId
}

export function canConvertPrToRfq(
  pr: Pick<PurchaseRequisition, 'status' | 'rfqRequired' | 'convertedRfqId'>,
): boolean {
  return isPrPendingRfq(pr)
}

export function canConvertPrToPo(
  pr: Pick<PurchaseRequisition, 'status' | 'rfqRequired' | 'convertedPoId' | 'convertedRfqId'>,
): boolean {
  if (pr.convertedPoId) return false
  if (!pr.rfqRequired && (pr.status === 'approved' || pr.status === 'partially_converted')) {
    return true
  }
  if (pr.status === 'converted_to_rfq') return true
  return false
}

export function prProcurementPathLabel(
  pr: Pick<PurchaseRequisition, 'rfqRequired' | 'status' | 'convertedRfqId' | 'convertedPoId'>,
): string {
  if (pr.convertedPoId) return 'PO created'
  if (pr.status === 'converted_to_rfq' || pr.convertedRfqId) return 'Via RFQ'
  if (pr.status === 'approved' && !pr.rfqRequired) return 'Direct Purchase Planning Path'
  if (pr.rfqRequired) return 'RFQ Purchase Path'
  return 'Direct Purchase Planning Path'
}

export function prNextActionHint(pr: PurchaseRequisitionListRow | PurchaseRequisition): string | null {
  if (isPrPendingPo(pr)) return 'Create PO — select lines and vendor'
  if (isPrPendingRfq(pr)) return 'Ready for RFQ'
  return null
}

/** Open PO create wizard with PR line selection (partial conversion). */
export function purchaseOrderFromPrHref(prId: string, vendorId?: string): string {
  const params = new URLSearchParams({ mode: 'pr', prId })
  if (vendorId?.trim()) params.set('vendorId', vendorId.trim())
  return `/purchase/orders/new?${params.toString()}`
}

/** Deep-link to planning sheet filtered by PR document number. */
export function purchasePlanningSheetHrefForPr(documentNumber: string): string {
  const q = encodeURIComponent(documentNumber.trim())
  return q ? `/purchase/planning-sheet?search=${q}` : '/purchase/planning-sheet'
}
