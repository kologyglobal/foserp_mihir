import type {
  GrnHeader,
  GrnStatus,
  PoStatus,
  PrStatus,
  PurchaseOrder,
  PurchaseRequisition,
  RequestForQuotation,
  RfqStatus,
  VendorQuoteStatus,
} from '../types/purchase'
import { purchaseWorkflowStep } from '../config/purchaseWorkflow'

/** Display labels aligned to canonical procurement vocabulary. */
export const PR_STATUS_LABELS: Record<PrStatus, string> = {
  draft: 'PR Draft',
  submitted: 'Awaiting Requisition Approval',
  approved: 'Requisition Approved',
  converted: 'Converted',
  cancelled: 'Cancelled',
}

export const RFQ_STATUS_LABELS: Record<RfqStatus, string> = {
  draft: 'RFQ Draft',
  sent: 'RFQ Sent to Vendors',
  quoted: 'Vendor Quotations Received',
  closed: 'RFQ Closed',
  cancelled: 'Cancelled',
}

export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  draft: 'PO Draft',
  submitted: 'Awaiting PO Approval',
  approved: 'PO Approved',
  released: 'PO Released',
  sent: 'Awaiting Vendor Confirmation',
  partial: 'Material Partially Delivered',
  received: 'Material Delivered',
  closed: 'Purchase Order Closed',
  cancelled: 'Cancelled',
  amended: 'PO Amended',
}

export const GRN_STATUS_LABELS: Record<GrnStatus, string> = {
  draft: 'GRN Draft',
  pending_qc: 'Quality Inspection',
  posted: 'Accepted Stock Posted',
  cancelled: 'Cancelled',
}

export const VENDOR_QUOTE_STATUS_LABELS: Record<VendorQuoteStatus, string> = {
  draft: 'Draft',
  submitted: 'Quotation Received',
  included: 'In Comparison',
  regret: 'Regret',
  selected: 'Vendor Selected',
}

export function prStatusLabel(status: string): string {
  return PR_STATUS_LABELS[status as PrStatus] ?? formatFallback(status)
}

export function rfqStatusLabel(status: string): string {
  return RFQ_STATUS_LABELS[status as RfqStatus] ?? formatFallback(status)
}

export function poStatusLabel(status: string): string {
  return PO_STATUS_LABELS[status as PoStatus] ?? formatFallback(status)
}

export function grnStatusLabel(status: string): string {
  return GRN_STATUS_LABELS[status as GrnStatus] ?? formatFallback(status)
}

export function purchaseDocStatusLabel(kind: 'pr' | 'rfq' | 'po' | 'grn' | 'quote', status: string): string {
  if (kind === 'pr') return prStatusLabel(status)
  if (kind === 'rfq') return rfqStatusLabel(status)
  if (kind === 'po') return poStatusLabel(status)
  if (kind === 'grn') return grnStatusLabel(status)
  return VENDOR_QUOTE_STATUS_LABELS[status as VendorQuoteStatus] ?? formatFallback(status)
}

function formatFallback(status: string): string {
  return status
    .replace(/_/g, ' ')
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export type PurchaseProcessNextAction = {
  label: string
  href?: string
  /** Canonical step number this advances */
  step?: number
  planned?: boolean
  hint?: string
}

/** Map PR demo status → active canonical step. */
export function prProcessStep(pr: PurchaseRequisition): number {
  if (pr.status === 'draft') return 3
  if (pr.status === 'submitted') return 4
  if (pr.status === 'approved') return 4
  if (pr.status === 'converted') return 5
  return 3
}

export function rfqProcessStep(rfq: RequestForQuotation): number {
  if (rfq.status === 'draft') return 5
  if (rfq.status === 'sent') return 5
  if (rfq.status === 'quoted') return rfq.recommendedVendorId ? 8 : 6
  if (rfq.status === 'closed') return 8
  return 5
}

export function poProcessStep(po: PurchaseOrder): number {
  if (po.status === 'draft') return 9
  if (po.status === 'submitted') return 10
  if (po.status === 'approved') return 10
  if (po.status === 'released') return 10
  if (po.status === 'sent') return 11
  if (po.status === 'partial') return 12
  if (po.status === 'received') return 15
  if (po.status === 'closed') return 20
  if (po.status === 'amended') return 9
  return 9
}

export function grnProcessStep(grn: GrnHeader): number {
  if (grn.status === 'draft') return 13
  if (grn.status === 'pending_qc') return 14
  if (grn.status === 'posted') return 15
  return 13
}

export function buildPrProcessNextActions(
  pr: PurchaseRequisition,
  opts?: { linkedRfqId?: string; linkedPoId?: string },
): PurchaseProcessNextAction[] {
  const actions: PurchaseProcessNextAction[] = []
  if (pr.status === 'draft') {
    actions.push({ label: 'Submit for Requisition Approval', step: 4, href: `/purchase/requisitions/${pr.id}` })
  } else if (pr.status === 'submitted') {
    actions.push({ label: 'Approve Requisition', step: 4, href: `/purchase/requisitions/${pr.id}` })
  } else if (pr.status === 'approved') {
    if (!opts?.linkedRfqId) {
      actions.push({
        label: 'Send RFQ to Approved Vendors',
        step: 5,
        href: `/purchase/rfqs/new?prId=${pr.id}`,
      })
    } else {
      actions.push({ label: 'Open RFQ', step: 5, href: `/purchase/rfqs/${opts.linkedRfqId}` })
    }
    if (!opts?.linkedPoId) {
      actions.push({
        label: 'Create Purchase Order',
        step: 9,
        href: `/purchase/orders/new?mode=pr&prId=${pr.id}`,
        hint: 'Skip RFQ when vendor is already known',
      })
    }
    actions.push({
      label: 'Stock and Incoming Quantity Checked',
      step: 2,
      planned: true,
      hint: 'Planned — inventory availability check',
    })
  } else if (pr.status === 'converted') {
    if (opts?.linkedPoId) {
      actions.push({ label: 'Open Purchase Order', step: 9, href: `/purchase/orders/${opts.linkedPoId}` })
    } else if (opts?.linkedRfqId) {
      actions.push({ label: 'Open RFQ', step: 5, href: `/purchase/rfqs/${opts.linkedRfqId}` })
    }
  }
  return actions
}

export function buildRfqProcessNextActions(rfq: RequestForQuotation): PurchaseProcessNextAction[] {
  const actions: PurchaseProcessNextAction[] = []
  if (rfq.status === 'draft') {
    actions.push({ label: 'Send RFQ to Approved Vendors', step: 5, href: `/purchase/rfqs/${rfq.id}` })
  } else if (rfq.status === 'sent') {
    actions.push({ label: 'Record Vendor Quotations', step: 6, href: `/purchase/rfqs/${rfq.id}` })
    actions.push({ label: 'Vendor Quotations Register', step: 6, href: '/purchase/vendor-quotations' })
    if (rfq.quotes.length >= 2) {
      actions.push({
        label: 'Technical and Commercial Comparison',
        step: 7,
        href: `/purchase/comparison/${rfq.id}`,
      })
    }
  } else if (rfq.status === 'quoted') {
    if (rfq.quotes.length >= 2) {
      actions.push({
        label: 'Technical and Commercial Comparison',
        step: 7,
        href: `/purchase/comparison/${rfq.id}`,
      })
    }
    if (!rfq.recommendedVendorId) {
      actions.push({ label: 'Select Vendor', step: 8, href: `/purchase/rfqs/${rfq.id}` })
    } else {
      actions.push({ label: 'Create Purchase Order', step: 9, href: `/purchase/rfqs/${rfq.id}` })
    }
  } else if (rfq.status === 'closed' && rfq.recommendedVendorId) {
    actions.push({ label: 'Create Purchase Order', step: 9, href: `/purchase/rfqs/${rfq.id}` })
  }
  return actions
}

export function buildPoProcessNextActions(po: PurchaseOrder): PurchaseProcessNextAction[] {
  const actions: PurchaseProcessNextAction[] = []
  if (po.status === 'draft') {
    actions.push({ label: 'Submit for PO Approval', step: 10, href: `/purchase/orders/${po.id}` })
  } else if (po.status === 'submitted') {
    actions.push({ label: 'Approve and Release Purchase Order', step: 10, href: `/purchase/orders/${po.id}` })
  } else if (po.status === 'approved') {
    actions.push({ label: 'Release Purchase Order', step: 10, href: `/purchase/orders/${po.id}` })
    actions.push({ label: 'Send to Vendor', step: 11, href: `/purchase/orders/${po.id}` })
  } else if (po.status === 'released') {
    actions.push({ label: 'Send to Vendor / Await Confirmation', step: 11, href: `/purchase/orders/${po.id}` })
  } else if (po.status === 'sent' || po.status === 'partial') {
    actions.push({ label: 'Record Gate Entry and GRN', step: 13, href: '/purchase/grn' })
    actions.push({
      label: 'Vendor Confirmation Received',
      step: 11,
      planned: true,
      hint: 'Demo: PO Sent stands in for vendor acknowledgement',
    })
  } else if (po.status === 'received') {
    actions.push({
      label: 'Vendor Invoice Received',
      step: 16,
      planned: true,
      hint: 'Planned with finance / AP',
    })
    actions.push({ label: 'Close Purchase Order', step: 20, href: `/purchase/orders/${po.id}` })
  } else if (po.status === 'closed') {
    actions.push({ label: purchaseWorkflowStep(20)?.label ?? 'Purchase Order Closed', step: 20 })
  }
  return actions
}

export function buildGrnProcessNextActions(grn: GrnHeader): PurchaseProcessNextAction[] {
  const actions: PurchaseProcessNextAction[] = []
  if (grn.status === 'draft') {
    actions.push({ label: 'Complete Gate Entry and Post GRN', step: 13, href: `/purchase/grn/${grn.id}` })
    actions.push({
      label: 'Gate Entry',
      step: 13,
      planned: true,
      hint: 'Gate fields are demo stubs — complete GRN lines to post',
    })
  } else if (grn.status === 'pending_qc') {
    actions.push({ label: 'Complete Quality Inspection', step: 14, href: '/quality/incoming' })
  } else if (grn.status === 'posted') {
    actions.push({
      label: 'Accepted Stock Posted to Inventory',
      step: 15,
      hint: 'Demo stock post complete — inventory ledger API deferred',
    })
    actions.push({
      label: 'Vendor Invoice Received',
      step: 16,
      planned: true,
      hint: 'Planned with finance / AP',
    })
    actions.push({ label: 'Open Source PO', step: 12, href: `/purchase/orders/${grn.poId}` })
  }
  return actions
}
