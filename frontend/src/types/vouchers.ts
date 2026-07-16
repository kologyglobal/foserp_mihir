/**
 * Accounting Vouchers — frontend models.
 * Demo/mock only. Prepared for future Node.js / MySQL API mapping.
 * Does not post real GL / payment / GST / TDS transactions.
 */

export type VoucherDocumentType =
  | 'journal'
  | 'payment'
  | 'receipt'
  | 'contra'
  | 'debit_note'
  | 'credit_note'
  | 'opening_balance'

export const VOUCHER_DOCUMENT_TYPES: VoucherDocumentType[] = [
  'journal',
  'payment',
  'receipt',
  'contra',
  'debit_note',
  'credit_note',
  'opening_balance',
]

export const VOUCHER_DOCUMENT_TYPE_LABELS: Record<VoucherDocumentType, string> = {
  journal: 'Journal',
  payment: 'Payment',
  receipt: 'Receipt',
  contra: 'Contra',
  debit_note: 'Debit Note',
  credit_note: 'Credit Note',
  opening_balance: 'Opening Balance',
}

export const VOUCHER_DOCUMENT_TYPE_PREFIX: Record<VoucherDocumentType, string> = {
  journal: 'JV',
  payment: 'PMT',
  receipt: 'RCT',
  contra: 'CTR',
  debit_note: 'DN',
  credit_note: 'CN',
  opening_balance: 'OB',
}

/** Manual entry types allowed in New Voucher. Purchase/Sales invoices are source-driven. */
export const MANUAL_VOUCHER_TYPES: VoucherDocumentType[] = [
  'journal',
  'payment',
  'receipt',
  'contra',
  'debit_note',
  'credit_note',
  'opening_balance',
]

export const SOURCE_INVOICE_NOTE =
  'Purchase and sales invoice accounting entries are normally generated from their source documents.'

export type VoucherLifecycleStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'posted'
  | 'rejected'
  | 'sent_back'
  | 'reversed'
  | 'cancelled'

export const VOUCHER_LIFECYCLE_STATUSES: VoucherLifecycleStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'posted',
  'rejected',
  'sent_back',
  'reversed',
  'cancelled',
]

export const VOUCHER_LIFECYCLE_LABELS: Record<VoucherLifecycleStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  posted: 'Posted',
  rejected: 'Rejected',
  sent_back: 'Sent Back',
  reversed: 'Reversed',
  cancelled: 'Cancelled',
}

export type VoucherPartyType = 'customer' | 'vendor' | 'employee' | 'other' | null

export type VoucherPaymentMode =
  | 'cash'
  | 'bank_transfer'
  | 'cheque'
  | 'neft'
  | 'rtgs'
  | 'upi'
  | 'dd'
  | 'other'

export const VOUCHER_PAYMENT_MODE_LABELS: Record<VoucherPaymentMode, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  neft: 'NEFT',
  rtgs: 'RTGS',
  upi: 'UPI',
  dd: 'Demand Draft',
  other: 'Other',
}

export type VoucherGstTreatment = 'none' | 'taxable' | 'exempt' | 'nil_rated' | 'non_gst' | 'rcm'

export type VoucherLineDc = 'debit' | 'credit'

export interface VoucherPartyRef {
  type: Exclude<VoucherPartyType, null>
  id: string
  name: string
  gstin?: string | null
}

export interface VoucherAccountRef {
  id: string
  code: string
  name: string
}

export interface VoucherLineGst {
  enabled: boolean
  treatment: VoucherGstTreatment
  hsnSac?: string
  taxableAmount?: number
  gstPercent?: number
  cgst?: number
  sgst?: number
  igst?: number
  placeOfSupply?: string
}

export interface VoucherLineTds {
  enabled: boolean
  section?: string
  ratePercent?: number
  baseAmount?: number
  tdsAmount?: number
}

export interface AccountingVoucherLine {
  id: string
  lineNo: number
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  narration: string
  partyType?: VoucherPartyType
  partyId?: string | null
  partyName?: string | null
  costCentreId?: string | null
  costCentreName?: string | null
  projectId?: string | null
  projectName?: string | null
  dimension1?: string | null
  dimension2?: string | null
  gst?: VoucherLineGst
  tds?: VoucherLineTds
}

export interface VoucherAttachmentMeta {
  id: string
  name: string
  sizeKb: number
  uploadedAt: string
  uploadedBy: string
}

export interface VoucherNote {
  id: string
  body: string
  createdAt: string
  createdBy: string
}

export type VoucherApprovalAction =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'sent_back'
  | 'posted'
  | 'reversed'
  | 'cancelled'
  | 'comment'

export interface VoucherApprovalEvent {
  id: string
  action: VoucherApprovalAction
  at: string
  by: string
  comment?: string
}

export interface VoucherAuditEvent {
  id: string
  at: string
  by: string
  action: string
  detail?: string
}

export interface AccountingVoucher {
  id: string
  voucherNumber: string
  voucherType: VoucherDocumentType
  status: VoucherLifecycleStatus
  voucherDate: string
  postingDate: string
  fiscalPeriod: string
  narration: string
  referenceNo?: string
  /** Header party (payment/receipt/DN/CN) */
  partyType?: VoucherPartyType
  partyId?: string | null
  partyName?: string | null
  partyGstin?: string | null
  /** Payment / receipt */
  paymentMode?: VoucherPaymentMode | null
  bankAccountId?: string | null
  bankAccountName?: string | null
  chequeNo?: string
  chequeDate?: string | null
  transactionRef?: string
  /** Contra */
  fromAccountId?: string | null
  fromAccountName?: string | null
  toAccountId?: string | null
  toAccountName?: string | null
  /** Debit / Credit note */
  originalInvoiceNo?: string
  originalInvoiceDate?: string | null
  reasonCode?: string
  /** Opening balance */
  openingBalanceAsOf?: string | null
  lines: AccountingVoucherLine[]
  totalDebit: number
  totalCredit: number
  difference: number
  isBalanced: boolean
  currency: 'INR'
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  submittedAt?: string | null
  submittedBy?: string | null
  approvedAt?: string | null
  approvedBy?: string | null
  postedAt?: string | null
  postedBy?: string | null
  rejectedReason?: string | null
  sentBackReason?: string | null
  cancelledReason?: string | null
  reversedByVoucherId?: string | null
  reversedByVoucherNumber?: string | null
  reversalOfVoucherId?: string | null
  reversalOfVoucherNumber?: string | null
  attachments: VoucherAttachmentMeta[]
  notes: VoucherNote[]
  approvalTrail: VoucherApprovalEvent[]
  auditTrail: VoucherAuditEvent[]
}

export type VoucherListTab =
  | 'all'
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'posted'
  | 'rejected'
  | 'sent_back'
  | 'reversed'
  | 'cancelled'

export interface VoucherFilter {
  search: string
  listTab: VoucherListTab
  voucherType: VoucherDocumentType | 'all'
  status: VoucherLifecycleStatus | 'all'
  dateFrom: string
  dateTo: string
  partyId: string
  createdBy: string
  minAmount: string
  maxAmount: string
  unbalancedOnly: boolean
}

export const DEFAULT_VOUCHER_FILTER: VoucherFilter = {
  search: '',
  listTab: 'all',
  voucherType: 'all',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  partyId: '',
  createdBy: '',
  minAmount: '',
  maxAmount: '',
  unbalancedOnly: false,
}

export interface VoucherKpiSummary {
  totalVouchers: number
  draftCount: number
  pendingApprovalCount: number
  approvedCount: number
  postedCount: number
  rejectedCount: number
  postedValueThisMonth: number
  unbalancedCount: number
}

export interface VoucherFormInput {
  voucherType: VoucherDocumentType
  voucherDate: string
  postingDate: string
  fiscalPeriod: string
  narration: string
  referenceNo?: string
  partyType?: VoucherPartyType
  partyId?: string | null
  partyName?: string | null
  partyGstin?: string | null
  paymentMode?: VoucherPaymentMode | null
  bankAccountId?: string | null
  bankAccountName?: string | null
  chequeNo?: string
  chequeDate?: string | null
  transactionRef?: string
  fromAccountId?: string | null
  fromAccountName?: string | null
  toAccountId?: string | null
  toAccountName?: string | null
  originalInvoiceNo?: string
  originalInvoiceDate?: string | null
  reasonCode?: string
  openingBalanceAsOf?: string | null
  lines: Omit<AccountingVoucherLine, 'id' | 'lineNo'>[]
}

export interface VoucherPartyOption {
  id: string
  name: string
  type: Exclude<VoucherPartyType, null>
  gstin?: string
  city?: string
}

export interface VoucherCostCentreOption {
  id: string
  code: string
  name: string
}

export interface VoucherImportPreviewRow {
  rowNo: number
  voucherType: string
  voucherDate: string
  narration: string
  accountCode: string
  debit: string
  credit: string
  status: 'ok' | 'error' | 'warning'
  messages: string[]
}

export interface VoucherImportPreview {
  fileName: string
  rows: VoucherImportPreviewRow[]
  okCount: number
  errorCount: number
  warningCount: number
}

export type VoucherExportFormat = 'csv' | 'json'
export type VoucherExportScope = 'current_view' | 'all'

export type VoucherWorkspaceId = 'information' | 'entries'

export function emptyVoucherLine(): Omit<AccountingVoucherLine, 'id' | 'lineNo'> {
  return {
    accountId: '',
    accountCode: '',
    accountName: '',
    debit: 0,
    credit: 0,
    narration: '',
    partyType: null,
    partyId: null,
    partyName: null,
    costCentreId: null,
    costCentreName: null,
    projectId: null,
    projectName: null,
    dimension1: null,
    dimension2: null,
    gst: { enabled: false, treatment: 'none' },
    tds: { enabled: false },
  }
}

export function sumVoucherDebitCredit(lines: Pick<AccountingVoucherLine, 'debit' | 'credit'>[]) {
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100
  return {
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    difference,
    isBalanced: Math.abs(difference) < 0.005,
  }
}
