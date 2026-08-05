import type { GstBreakdown } from './invoice'

/** CRM lightweight commercial & receivables — demo store + CRM UI (no Accounting module required). */

export type CrmPaymentMode = 'cash' | 'bank' | 'upi' | 'cheque' | 'neft' | 'rtgs'

export const CRM_PAYMENT_MODE_LABELS: Record<CrmPaymentMode, string> = {
  cash: 'Cash',
  bank: 'Bank',
  upi: 'UPI',
  cheque: 'Cheque',
  neft: 'NEFT',
  rtgs: 'RTGS',
}

export type ProformaPaymentStatus = 'unpaid' | 'partially_paid' | 'fully_paid'

export const PROFORMA_PAYMENT_STATUS_LABELS: Record<ProformaPaymentStatus, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Partially Paid',
  fully_paid: 'Fully Paid',
}

export type CrmTaxInvoiceStatus = 'draft' | 'posted' | 'partially_paid' | 'paid' | 'cancelled'

export const CRM_TAX_INVOICE_STATUS_LABELS: Record<CrmTaxInvoiceStatus, string> = {
  draft: 'Draft',
  posted: 'Posted',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export type CrmInvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid'

export const CRM_INVOICE_PAYMENT_STATUS_LABELS: Record<CrmInvoicePaymentStatus, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
}

export type CrmTaxInvoiceAccountingStatus = 'none' | 'pending_review' | 'converted' | 'rejected'

export const CRM_TAX_INVOICE_ACCOUNTING_STATUS_LABELS: Record<CrmTaxInvoiceAccountingStatus, string> = {
  none: 'Not sent',
  pending_review: 'Pending Accounting',
  converted: 'In Money In',
  rejected: 'Rejected',
}

export type CrmCommercialSource = 'sales_order' | 'proforma' | 'direct' | 'customer'

export interface CrmCommercialLine {
  id: string
  lineNo: number
  itemId: string
  itemCode: string
  description: string
  hsnCode: string
  qty: number
  uom: string
  unitPrice: number
  discountPct: number
  taxPct: number
  taxableValue: number
  gstAmount: number
  lineTotal: number
  /** GST scheme snapshot (cgst_sgst | igst | utgst_pair) — not reinvented at display. */
  taxScheme?: string | null
  cgstRate?: number | null
  sgstRate?: number | null
  utgstRate?: number | null
  igstRate?: number | null
  cgstAmount?: number | null
  sgstAmount?: number | null
  utgstAmount?: number | null
  igstAmount?: number | null
  /** Original SO/PI line qty — used for partial invoicing. */
  sourceLineId?: string | null
  maxQty?: number | null
}

export type CrmPaymentReceiptAccountingMigrationStatus =
  | 'UNREVIEWED'
  | 'NON_ACCOUNTING'
  | 'READY_TO_MIGRATE'
  | 'DRAFT_CREATED'
  | 'MIGRATED'
  | 'DUPLICATE'
  | 'REJECTED'
  | 'FAILED'

export const CRM_RECEIPT_MIGRATION_STATUS_LABELS: Record<
  CrmPaymentReceiptAccountingMigrationStatus,
  string
> = {
  UNREVIEWED: 'Commercial Receipt',
  NON_ACCOUNTING: 'Non-Accounting',
  READY_TO_MIGRATE: 'Ready to Migrate',
  DRAFT_CREATED: 'Accounting Draft Created',
  MIGRATED: 'Posted in Money In',
  DUPLICATE: 'Duplicate',
  REJECTED: 'Rejected',
  FAILED: 'Migration Failed',
}

export interface CrmPaymentReceipt {
  id: string
  receiptNo: string
  receiptDate: string
  customerId: string
  customerName: string
  /** When received against a proforma (advance). */
  proformaInvoiceId: string | null
  proformaNo: string | null
  paymentMode: CrmPaymentMode
  transactionRef: string
  amount: number
  /** Amount not yet allocated to tax invoices. */
  unallocatedAmount: number
  remarks: string
  attachmentName: string | null
  accountingReceiptId?: string | null
  accountingMigrationStatus?: CrmPaymentReceiptAccountingMigrationStatus
  accountingMigrationError?: string | null
  accountingMigratedAt?: string | null
  commercialOnly?: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CrmTaxInvoice {
  id: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string
  status: CrmTaxInvoiceStatus
  paymentStatus: CrmInvoicePaymentStatus
  source: CrmCommercialSource
  customerId: string
  customerName: string
  customerGstin: string
  customerState: string
  customerAddress: string
  placeOfSupply: string
  billingAddress: string | null
  shippingAddress: string | null
  deliveryTerms: string
  paymentTerms: string
  customerPoNumber: string | null
  salesOrderId: string | null
  salesOrderNo: string | null
  quotationId: string | null
  quotationNo: string | null
  proformaInvoiceId: string | null
  proformaNo: string | null
  remarks: string
  lines: CrmCommercialLine[]
  gst: GstBreakdown
  amountPaid: number
  balanceDue: number
  accountingStatus?: CrmTaxInvoiceAccountingStatus
  salesInvoiceId?: string | null
  salesInvoiceNumber?: string | null
  accountingSubmittedAt?: string | null
  accountingConvertedAt?: string | null
  /** AR-synced last payment date (read-only mirror). */
  lastPaymentDate?: string | null
  createdByName?: string
  postedAt: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CrmPaymentAllocation {
  id: string
  receiptId: string
  receiptNo: string
  invoiceId: string
  invoiceNo: string
  customerId: string
  customerName: string
  amount: number
  allocationDate: string
  remarks: string
  reversedAt: string | null
  reversedBy: string | null
  createdAt: string
  createdBy: string
}

export type CrmCommercialAuditAction =
  | 'receipt_created'
  | 'invoice_created'
  | 'invoice_updated'
  | 'invoice_posted'
  | 'invoice_cancelled'
  | 'allocation_created'
  | 'allocation_reversed'

export interface CrmCommercialAuditEntry {
  id: string
  action: CrmCommercialAuditAction
  entityType: 'receipt' | 'invoice' | 'allocation'
  entityId: string
  customerId: string
  summary: string
  details: Record<string, unknown>
  at: string
  by: string
}

export type CrmCustomerTimelineKind =
  | 'quotation'
  | 'sales_order'
  | 'proforma'
  | 'payment_receipt'
  | 'invoice'
  | 'payment_allocation'

export interface CrmCustomerTimelineEvent {
  id: string
  customerId: string
  kind: CrmCustomerTimelineKind
  title: string
  subtitle: string
  amount: number | null
  refId: string
  refPath: string | null
  at: string
}

export function computeProformaPaymentStatus(
  grandTotal: number,
  amountReceived: number,
): ProformaPaymentStatus {
  if (amountReceived <= 0.009) return 'unpaid'
  if (amountReceived + 0.009 >= grandTotal) return 'fully_paid'
  return 'partially_paid'
}

export function computeInvoicePaymentStatus(
  grandTotal: number,
  amountPaid: number,
): CrmInvoicePaymentStatus {
  if (amountPaid <= 0.009) return 'unpaid'
  if (amountPaid + 0.009 >= grandTotal) return 'paid'
  return 'partially_paid'
}

export function invoiceStatusFromPayment(
  paymentStatus: CrmInvoicePaymentStatus,
  current: CrmTaxInvoiceStatus,
): CrmTaxInvoiceStatus {
  if (current === 'draft' || current === 'cancelled') return current
  if (paymentStatus === 'paid') return 'paid'
  if (paymentStatus === 'partially_paid') return 'partially_paid'
  return 'posted'
}
