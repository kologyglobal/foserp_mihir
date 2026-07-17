import type { PurchaseRequisition, PurchaseRequisitionListRow } from '@/types/purchaseDomain'

/** Approved and marked for direct PO (skip RFQ). */
export function isPrPendingPo(
  pr: Pick<PurchaseRequisition, 'status' | 'rfqRequired' | 'convertedPoId'>,
): boolean {
  return pr.status === 'approved' && !pr.rfqRequired && !pr.convertedPoId
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
  if (pr.status === 'approved' && !pr.rfqRequired) return true
  if (pr.status === 'converted_to_rfq') return true
  return false
}

export function prProcurementPathLabel(
  pr: Pick<PurchaseRequisition, 'rfqRequired' | 'status' | 'convertedRfqId' | 'convertedPoId'>,
): string {
  if (pr.convertedPoId) return 'PO created'
  if (pr.status === 'converted_to_rfq' || pr.convertedRfqId) return 'Via RFQ'
  if (pr.status === 'approved' && !pr.rfqRequired) return 'Direct to PO'
  if (pr.rfqRequired) return 'RFQ required'
  return 'Direct to PO'
}

export function prNextActionHint(pr: PurchaseRequisitionListRow | PurchaseRequisition): string | null {
  if (isPrPendingPo(pr)) return 'Ready for Purchase Order'
  if (isPrPendingRfq(pr)) return 'Ready for RFQ'
  return null
}
