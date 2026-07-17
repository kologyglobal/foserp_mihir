/**
 * Commercial commitments — frontend display types only.
 * Non-posted CRM documents; never mix with posted AR / GL.
 */

export type CommercialAccountingStatus =
  | 'not_posted'
  | 'invoice_pending'
  | 'posting_not_available'
  | 'posted'

export type CommercialSourceType =
  | 'approved_quotation'
  | 'open_sales_order'
  | 'confirmed_sales_order'
  | 'pending_invoice'

export interface CommercialCommitment {
  id: string
  customerId: string
  customerName: string
  opportunityId: string | null
  opportunityName: string | null
  opportunityStage: string | null
  quotationId: string | null
  quotationNo: string | null
  quotationRevision: number | null
  quotationHeaderStatus: string | null
  quotationDocumentStatus: string | null
  customerApprovalStatus: string | null
  quotationValidityDate: string | null
  isLatestRevision: boolean
  salesOrderId: string | null
  salesOrderNo: string | null
  salesOrderStatus: string | null
  commercialValue: number
  accountingStatus: CommercialAccountingStatus
  ownerId: string
  ownerName: string
  sourceType: CommercialSourceType
  documentDate: string
  expectedCloseOrDelivery: string | null
  latestActivityLabel: string | null
  nextFollowUpLabel: string | null
  nextFollowUpDue: string | null
  nextFollowUpStatus: string | null
  directSalesOrderReason: string | null
  createdAt: string
  updatedAt: string
}

export interface CommercialCommitmentSummary {
  approvedQuotationsCount: number
  approvedQuotationsValue: number
  openSalesOrdersCount: number
  openSalesOrdersValue: number
  confirmedSalesOrdersCount: number
  confirmedSalesOrdersValue: number
  pendingInvoiceCount: number
  pendingInvoiceValue: number
  totalNonPostedValue: number
  potentialReceivable: number
}

export interface CrmSourceDocumentModel {
  customerId?: string | null
  customerName?: string | null
  leadId?: string | null
  leadNo?: string | null
  opportunityId?: string | null
  opportunityNo?: string | null
  opportunityStage?: string | null
  quotationId?: string | null
  quotationNo?: string | null
  quotationRevision?: number | null
  quotationHeaderStatus?: string | null
  quotationDocumentStatus?: string | null
  customerApprovalStatus?: string | null
  salesOrderId?: string | null
  salesOrderNo?: string | null
  salesOrderStatus?: string | null
  directSalesOrderReason?: string | null
  ownerName?: string | null
  accountingStatus?: CommercialAccountingStatus | 'not_posted'
}

export const COMMERCIAL_ACCOUNTING_STATUS_LABELS: Record<CommercialAccountingStatus, string> = {
  not_posted: 'Not Posted',
  invoice_pending: 'Invoice Pending',
  posting_not_available: 'Posting Not Available',
  posted: 'Posted',
}

export const PHASE1_SALES_ORDER_STATUSES = ['open', 'confirmed', 'closed'] as const

export function isPhase1SalesOrderStatus(status: string): boolean {
  return (PHASE1_SALES_ORDER_STATUSES as readonly string[]).includes(status)
}

export function salesOrderStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'confirmed':
      return 'Confirmed'
    case 'closed':
      return 'Closed'
    case 'in_production':
    case 'ready_dispatch':
    case 'dispatched':
    case 'invoiced':
      return 'Future workflow status'
    default:
      return status
  }
}

export function salesOrderStatusSupportText(status: string): string | null {
  switch (status) {
    case 'open':
      return 'Draft and editable'
    case 'confirmed':
      return 'Commercially confirmed · Not financially posted'
    case 'closed':
      return 'Commercially closed'
    case 'in_production':
    case 'ready_dispatch':
    case 'dispatched':
    case 'invoiced':
      return 'Demo / future fulfilment — not operational in Phase 1'
    default:
      return null
  }
}

/** Accepted only when header + document + customer approval are all approved. */
export function isQuotationFullyAccepted(c: Pick<
  CommercialCommitment,
  'quotationHeaderStatus' | 'quotationDocumentStatus' | 'customerApprovalStatus'
>): boolean {
  return (
    c.quotationHeaderStatus === 'approved' &&
    c.quotationDocumentStatus === 'approved' &&
    c.customerApprovalStatus === 'approved'
  )
}

export function isQuotationValidityExpired(validityDate: string | null | undefined, today = new Date()): boolean {
  if (!validityDate) return false
  const d = validityDate.slice(0, 10)
  return d < today.toISOString().slice(0, 10)
}

export function summarizeCommercialCommitments(rows: CommercialCommitment[]): CommercialCommitmentSummary {
  const approvedQ = rows.filter((r) => r.sourceType === 'approved_quotation')
  const openSo = rows.filter((r) => r.sourceType === 'open_sales_order')
  const confirmedSo = rows.filter((r) => r.sourceType === 'confirmed_sales_order')
  const pendingInv = rows.filter((r) => r.sourceType === 'pending_invoice' || r.accountingStatus === 'invoice_pending')

  const sum = (list: CommercialCommitment[]) => list.reduce((s, r) => s + r.commercialValue, 0)

  const confirmedValue = sum(confirmedSo)
  const openValue = sum(openSo)
  const pendingValue = sum(pendingInv.length ? pendingInv : confirmedSo)

  return {
    approvedQuotationsCount: approvedQ.length,
    approvedQuotationsValue: sum(approvedQ),
    openSalesOrdersCount: openSo.length,
    openSalesOrdersValue: openValue,
    confirmedSalesOrdersCount: confirmedSo.length,
    confirmedSalesOrdersValue: confirmedValue,
    pendingInvoiceCount: pendingInv.length || confirmedSo.length,
    pendingInvoiceValue: pendingValue,
    totalNonPostedValue: sum(rows.filter((r) => r.accountingStatus !== 'posted')),
    potentialReceivable: confirmedValue,
  }
}
