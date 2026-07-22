/**
 * Accounts Payable — frontend models (demo / UI only).
 * Indian manufacturing context: RM vendors, freight, subcontract job-work, utilities.
 * Prepared for future Node.js / MySQL API mapping.
 * Does NOT post real GL, settle vendor ledger, or trigger bank payments.
 */

export type PayableAgeingBucket =
  | 'Not Due'
  | '1–30 Days'
  | '31–60 Days'
  | '61–90 Days'
  | '91–180 Days'
  | 'Above 180 Days'

export type PayableInvoiceStatus =
  | 'Open'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Disputed'
  | 'Cancelled'

export type PayableInvoiceApprovalStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Not Required'

export type PayableVendorStatus = 'Active' | 'On Hold'

export type MatchStatus =
  | 'Fully Matched'
  | 'Quantity Mismatch'
  | 'Rate Mismatch'
  | 'Tax Mismatch'
  | 'Amount Mismatch'
  | 'Missing GRN'
  | 'Missing PO'
  | 'Within Tolerance'
  | 'Override Approved'
  | 'Pending Verification'

export type PaymentHoldType = 'Invoice' | 'Vendor' | 'Payment' | 'Proposal'

export type PaymentHoldReason =
  | 'Dispute'
  | 'Quality Issue'
  | 'Missing Document'
  | 'Bank Verification Pending'
  | 'Three-Way Match Failure'
  | 'Management Hold'
  | 'MSME Compliance'
  | 'TDS Issue'
  | 'Other'

export type PaymentHoldStatus = 'Active' | 'Released' | 'Expired'

export type VendorBankVerificationStatus =
  | 'Verified'
  | 'Pending Verification'
  | 'Changed Recently'
  | 'Rejected'
  | 'Not Available'

export type MsmeCategory = 'Micro' | 'Small' | 'Medium' | 'Not MSME'

export type MsmeStatus = 'Registered' | 'Pending Registration' | 'Not Applicable'

export type GstRegistrationType = 'Regular' | 'Composition' | 'Unregistered' | 'SEZ' | 'Government'

export type PaymentPriority = 'Critical' | 'High' | 'Normal' | 'Low' | 'MSME Priority'

export type PaymentPlanningPriority =
  | 'MSME First'
  | 'Overdue First'
  | 'Due Date'
  | 'Amount Descending'
  | 'Vendor Priority'

export type PaymentProposalStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending Approval'
  | 'Approved'
  | 'Partially Processed'
  | 'Processed'
  | 'Rejected'
  | 'Converted'
  | 'Cancelled'

export type VendorPaymentStatus =
  | 'Draft'
  | 'Submitted'
  | 'Approved'
  | 'Posted'
  | 'Reversed'
  | 'Cancelled'

export type VendorPaymentMode =
  | 'NEFT'
  | 'RTGS'
  | 'IMPS'
  | 'UPI'
  | 'Cheque'
  | 'Cash'
  | 'Demand Draft'
  | 'Bank Transfer'
  | 'Other'

export type PaymentAllocationStatus =
  | 'Unallocated'
  | 'Partially Allocated'
  | 'Fully Allocated'

export type VendorAdvanceStatus =
  | 'Open'
  | 'Partially Adjusted'
  | 'Fully Adjusted'
  | 'Cancelled'

export type PayableDebitNoteStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Posted'
  | 'Applied'
  | 'Partially Applied'
  | 'Unapplied'
  | 'Cancelled'

export type PayableDebitNoteReason =
  | 'Purchase Return'
  | 'Price Difference'
  | 'Quantity Shortage'
  | 'Quality Rejection'
  | 'Freight Adjustment'
  | 'Tax Correction'
  | 'Commercial Settlement'
  | 'Other'

export type VendorDisputeStatus =
  | 'Open'
  | 'Under Review'
  | 'Awaiting Vendor'
  | 'Awaiting Internal Team'
  | 'Resolved'
  | 'Rejected'
  | 'Closed'

export type VendorDisputeType =
  | 'Price Difference'
  | 'Quantity Difference'
  | 'Quality Issue'
  | 'Delivery Delay'
  | 'Short Supply'
  | 'Tax Issue'
  | 'Missing Document'
  | 'Duplicate Invoice'
  | 'Commercial Terms'
  | 'Other'

export type AgeingBasis = 'Due Date' | 'Posting Date' | 'Invoice Date'

export type PayableWorkspaceTab =
  | 'overview'
  | 'outstanding'
  | 'invoices'
  | 'ageing'
  | 'payment_planning'
  | 'payment_proposals'
  | 'vendor_payments'
  | 'allocations'
  | 'advances'
  | 'debit_notes'
  | 'disputes'
  | 'reports'
  | 'setup'

/** Dashboard core AP flow — mirrors Purchase Invoice → … → Ledger/Bank. */
export type PayablePriorityFlowStepId =
  | 'verify_match'
  | 'vendor_outstanding'
  | 'payment_planning'
  | 'proposal_approval'
  | 'vendor_payment'
  | 'invoice_allocation'
  | 'posting_ledger'

export const PAYABLE_AGEING_BUCKETS: PayableAgeingBucket[] = [
  'Not Due',
  '1–30 Days',
  '31–60 Days',
  '61–90 Days',
  '91–180 Days',
  'Above 180 Days',
]

export const PAYABLE_WORKSPACE_TABS: { id: PayableWorkspaceTab; label: string; path: string }[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/payables' },
  { id: 'outstanding', label: 'Vendor Outstanding', path: '/accounting/payables/outstanding' },
  { id: 'invoices', label: 'Payable Invoices', path: '/accounting/payables/invoices' },
  { id: 'ageing', label: 'Vendor Ageing', path: '/accounting/payables/ageing' },
  { id: 'payment_planning', label: 'Payment Planning', path: '/accounting/payables/payment-planning' },
  { id: 'payment_proposals', label: 'Payment Proposals', path: '/accounting/payables/payment-proposals' },
  { id: 'vendor_payments', label: 'Vendor Payments', path: '/accounting/payables/payments' },
  { id: 'allocations', label: 'Payment Allocations', path: '/accounting/payables/allocations' },
  { id: 'advances', label: 'Vendor Advances', path: '/accounting/payables/advances' },
  { id: 'debit_notes', label: 'Debit Notes', path: '/accounting/payables/debit-notes' },
  { id: 'disputes', label: 'Vendor Disputes', path: '/accounting/payables/disputes' },
  { id: 'reports', label: 'Reports', path: '/accounting/payables/reports' },
  { id: 'setup', label: 'Payables Setup', path: '/accounting/payables/setup' },
]

export const MATCH_STATUSES: MatchStatus[] = [
  'Fully Matched',
  'Quantity Mismatch',
  'Rate Mismatch',
  'Tax Mismatch',
  'Amount Mismatch',
  'Missing GRN',
  'Missing PO',
  'Within Tolerance',
  'Override Approved',
  'Pending Verification',
]

export const PAYABLE_INVOICE_STATUSES: PayableInvoiceStatus[] = [
  'Open',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Disputed',
  'Cancelled',
]

export const VENDOR_PAYMENT_MODES: VendorPaymentMode[] = [
  'NEFT',
  'RTGS',
  'IMPS',
  'UPI',
  'Cheque',
  'Cash',
  'Demand Draft',
  'Bank Transfer',
  'Other',
]

export const ELECTRONIC_VENDOR_PAYMENT_MODES: VendorPaymentMode[] = [
  'NEFT',
  'RTGS',
  'IMPS',
  'UPI',
  'Bank Transfer',
]

export const PAYMENT_PROPOSAL_STATUSES: PaymentProposalStatus[] = [
  'Draft',
  'Submitted',
  'Pending Approval',
  'Approved',
  'Partially Processed',
  'Processed',
  'Rejected',
  'Converted',
  'Cancelled',
]

/** UI label map — Submitted displays as Pending Approval */
export const PAYMENT_PROPOSAL_STATUS_LABELS: Partial<Record<PaymentProposalStatus, string>> = {
  Submitted: 'Pending Approval',
}

export const VENDOR_PAYMENT_STATUSES: VendorPaymentStatus[] = [
  'Draft',
  'Submitted',
  'Approved',
  'Posted',
  'Reversed',
  'Cancelled',
]

export const PAYMENT_ALLOCATION_STATUSES: PaymentAllocationStatus[] = [
  'Unallocated',
  'Partially Allocated',
  'Fully Allocated',
]

export const VENDOR_ADVANCE_STATUSES: VendorAdvanceStatus[] = [
  'Open',
  'Partially Adjusted',
  'Fully Adjusted',
  'Cancelled',
]

export const PAYABLE_DEBIT_NOTE_REASONS: PayableDebitNoteReason[] = [
  'Purchase Return',
  'Price Difference',
  'Quantity Shortage',
  'Quality Rejection',
  'Freight Adjustment',
  'Tax Correction',
  'Commercial Settlement',
  'Other',
]

export const VENDOR_DISPUTE_TYPES: VendorDisputeType[] = [
  'Price Difference',
  'Quantity Difference',
  'Quality Issue',
  'Delivery Delay',
  'Short Supply',
  'Tax Issue',
  'Missing Document',
  'Duplicate Invoice',
  'Commercial Terms',
  'Other',
]

export interface PaymentHold {
  id: string
  holdType: PaymentHoldType
  reason: PaymentHoldReason
  status: PaymentHoldStatus
  entityId: string
  entityType: string
  placedBy: string
  placedAt: string
  releasedBy: string | null
  releasedAt: string | null
  remarks: string
}

export interface VendorBankDetails {
  vendorId: string
  beneficiaryName: string
  bankName: string
  branch: string
  ifsc: string
  accountNumberMasked: string
  accountType: 'Current' | 'Savings' | 'CC' | 'OD'
  verificationStatus: VendorBankVerificationStatus
  verifiedBy: string | null
  verifiedAt: string | null
  lastChangedAt: string | null
}

export interface ThreeWayMatchLine {
  itemDescription: string
  poQty: number
  grnQty: number
  invoiceQty: number
  poRate: number
  grnRate: number
  invoiceRate: number
  poTax: number
  grnTax: number
  invoiceTax: number
  poValue: number
  grnValue: number
  invoiceValue: number
  difference: number
  tolerance: number
  status: MatchStatus
  comment: string | null
}

export interface ThreeWayMatchResult {
  invoiceId: string
  invoiceNumber: string
  vendorName: string
  poNumber: string | null
  grnNumber: string | null
  overallStatus: MatchStatus
  lines: ThreeWayMatchLine[]
  totalDifference: number
  toleranceAmount: number
  withinTolerance: boolean
  verifiedBy: string | null
  verifiedAt: string | null
}

export interface PaymentPlanningCriteria {
  paymentDate: string
  maxPaymentAmount: number | null
  includeOverdue: boolean
  includeDueWithinDays: number
  msmePriority: boolean
  excludeOnHold: boolean
  excludeDisputed: boolean
  vendorIds: string[]
  minimumInvoiceAmount: number | null
  priority: PaymentPlanningPriority
}

export interface PaymentPlanningPreviewLine {
  invoiceId: string
  invoiceNumber: string
  vendorId: string
  vendorName: string
  dueDate: string
  outstanding: number
  proposedAmount: number
  msmeVendor: boolean
  overdueDays: number
  paymentHold: boolean
  selected: boolean
}

export interface PaymentPlanningPreview {
  criteria: PaymentPlanningCriteria
  proposedPaymentDate: string
  totalProposed: number
  vendorCount: number
  invoiceCount: number
  msmeAmount: number
  overdueAmount: number
  lines: PaymentPlanningPreviewLine[]
  warnings: string[]
}

export interface MsmeAgeingRow {
  vendorId: string
  vendorName: string
  msmeCategory: MsmeCategory
  udyamNumber: string | null
  notDue: number
  d1to30: number
  d31to60: number
  d61to90: number
  d91to180: number
  above180: number
  totalOutstanding: number
  msmePaymentDueDays: number
  daysSinceDue: number
  complianceRisk: 'Low' | 'Medium' | 'High' | 'Critical'
}

export interface PayableVendor {
  id: string
  code: string
  name: string
  gstin: string | null
  pan: string | null
  state: string
  creditDays: number
  creditLimit: number
  outstanding: number
  overdue: number
  status: PayableVendorStatus
  /** Vendor category — steel RM, fasteners, paint, freight, subcontract, utilities */
  category: string
  vendorGroup: string
  contactPerson: string
  email: string
  mobile: string
  paymentTerms: string
  buyer: string
  bankAccountName: string | null
  bankVerificationStatus: VendorBankVerificationStatus
  msmeCategory: MsmeCategory
  msmeStatus: MsmeStatus
  paymentHold: PaymentHold | null
  masterVendorId: string | null
}

export interface PayableInvoice {
  id: string
  invoiceNumber: string
  vendorInvoiceNumber: string
  vendorId: string
  vendorCode: string
  vendorName: string
  invoiceDate: string
  dueDate: string
  postingDate: string
  originalAmount: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  paidAmount: number
  debitNoteAmount: number
  outstandingBalance: number
  status: PayableInvoiceStatus
  matchStatus: MatchStatus
  approvalStatus: PayableInvoiceApprovalStatus
  paymentHold: PaymentHold | null
  ageingBucket: PayableAgeingBucket
  overdueDays: number
  plant: string
  location: string
  costCentre: string
  buyer: string
  poNumber: string | null
  grnNumber: string | null
  reference: string | null
  tdsAmount: number
  tdsSection: string | null
  msmeVendor: boolean
  duplicateWarning: boolean
  gstRegistrationType: GstRegistrationType
  hasDispute: boolean
  hasDebitNote: boolean
  sourcePurchaseInvoiceId: string | null
}

export interface VendorOutstandingSummary {
  vendorId: string
  vendorCode: string
  vendorName: string
  category: string
  gstin: string | null
  creditDays: number
  creditLimit: number
  totalOutstanding: number
  currentAmount: number
  overdueAmount: number
  oldestDueDate: string | null
  maximumOverdueDays: number
  unallocatedPayment: number
  creditUtilization: number
  openInvoiceCount: number
  disputeAmount: number
  advanceBalance: number
  debitNoteBalance: number
  paymentHold: boolean
  holdReason: PaymentHoldReason | null
  paymentPriority: PaymentPriority
  msme: boolean
  msmeCategory: MsmeCategory | null
  status: PayableVendorStatus
  lastPaymentDate: string | null
  lastPaymentAmount: number
  hasDispute: boolean
}

export interface PaymentProposalLine {
  id: string
  invoiceId: string
  invoiceNumber: string
  vendorId: string
  vendorName: string
  dueDate: string
  outstanding: number
  proposedAmount: number
  selected: boolean
}

export interface PaymentProposal {
  id: string
  proposalNumber: string
  status: PaymentProposalStatus
  proposedPaymentDate: string
  totalAmount: number
  vendorCount: number
  invoiceCount: number
  lines: PaymentProposalLine[]
  createdBy: string
  approvedBy: string | null
  rejectionReason: string | null
  createdAt: string
  submittedAt: string | null
  approvedAt: string | null
}

export interface PaymentAllocationLine {
  id: string
  invoiceId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  originalAmount: number
  previousAllocation: number
  outstandingBalance: number
  overdueDays: number
  tdsDeducted: number
  allocationAmount: number
  remainingBalance: number
  status: string
}

export interface VendorPayment {
  id: string
  paymentNumber: string
  status: VendorPaymentStatus
  vendorId: string
  vendorCode: string
  vendorName: string
  paymentDate: string
  postingDate: string
  paymentMode: VendorPaymentMode
  bankAccountId: string
  bankAccountName: string
  transactionReference: string | null
  chequeNumber: string | null
  chequeDate: string | null
  /** Net bank disbursement (legacy field — same as netPayment) */
  amount: number
  grossAmount: number
  netPayment: number
  otherDeductions: number
  bankCharges: number
  beneficiaryBankMasked: string | null
  currency: string
  exchangeRate: number
  tdsDeducted: number
  tdsSection: string | null
  tdsRate: number | null
  tdsBaseAmount: number | null
  unallocatedAmount: number
  allocatedAmount: number
  allocationStatus: PaymentAllocationStatus
  allocationLines: PaymentAllocationLine[]
  voucherId: string | null
  voucherNumber: string | null
  ledgerEntryIds: string[] | null
  narration: string
  internalRemarks: string
  createdBy: string
  approvedBy: string | null
  postedBy: string | null
  postedAt: string | null
  proposalId: string | null
}

export interface VendorAdvance {
  id: string
  advanceNumber: string
  advanceDate: string
  vendorId: string
  vendorCode: string
  vendorName: string
  poNumber: string | null
  originalAmount: number
  adjustedAmount: number
  remainingAmount: number
  status: VendorAdvanceStatus
  paymentId: string | null
  narration: string
  createdBy: string
}

export interface PayableDebitNote {
  id: string
  debitNoteNumber: string
  debitNoteDate: string
  vendorId: string
  vendorName: string
  referenceInvoiceId: string | null
  referenceInvoiceNumber: string | null
  reason: PayableDebitNoteReason
  originalAmount: number
  appliedAmount: number
  remainingAmount: number
  gstAdjustment: number
  status: PayableDebitNoteStatus
  sourceDocument: string | null
  relatedVoucherId: string | null
}

export interface VendorDispute {
  id: string
  disputeNumber: string
  vendorId: string
  vendorName: string
  invoiceId: string
  invoiceNumber: string
  purchaseOrders?: Array<{ id: string; number: string }>
  grns?: Array<{ id: string; number: string }>
  disputeDate: string
  disputeType: VendorDisputeType
  disputedAmount: number
  description: string
  owner: string
  responsibleDepartment: string
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  targetResolutionDate: string
  status: VendorDisputeStatus
  resolution: string | null
  debitNoteRequired: boolean
  paymentHold: boolean
  supportingDocuments: string[]
  createdAt: string
}

export interface PayablesDashboardKpis {
  totalPayables: number
  currentOutstanding: number
  overdueAmount: number
  dueThisWeek: number
  paymentsThisMonth: number
  proposalsPendingApproval: number
  advancesOutstanding: number
  disputedAmount: number
  unallocatedPayments: number
  invoicesOnHold: number
  tdsPayable: number
  matchDifferences: number
  msmePaymentsDue: number
  vendorsBlockedForPayment: number
}

export interface PayablePriorityFlowStep {
  id: PayablePriorityFlowStepId
  label: string
  description: string
  count: number
  href: string
  ctaLabel: string
}

export interface PayablesDashboardData {
  kpis: PayablesDashboardKpis
  priorityFlow: PayablePriorityFlowStep[]
  ageingChart: { bucket: PayableAgeingBucket; amount: number; count: number }[]
  topVendors: VendorOutstandingSummary[]
  dueSoonInvoices: PayableInvoice[]
  alerts: {
    id: string
    type: string
    severity: 'info' | 'warning' | 'critical'
    title: string
    description: string
    href: string
  }[]
  paymentTrend: { month: string; invoiced: number; paid: number }[]
  recentPayments: VendorPayment[]
  pendingProposals: PaymentProposal[]
}

export interface VendorAgeingRow {
  vendorId: string
  vendorName: string
  creditLimit: number
  notDue: number
  d1to30: number
  d31to60: number
  d61to90: number
  d91to180: number
  above180: number
  totalOutstanding: number
}

export interface PayableAgeingResult {
  asOfDate: string
  ageingBasis: AgeingBasis
  summary: {
    totalOutstanding: number
    notDue: number
    d1to30: number
    d31to60: number
    d61to90: number
    above90: number
  }
  vendorWise: VendorAgeingRow[]
  msmeWise: MsmeAgeingRow[]
  invoiceWise: PayableInvoice[]
}

export interface PaymentAllocation {
  paymentId: string
  lines: PaymentAllocationLine[]
  paymentAmount: number
  tdsDeducted: number
  amountAvailable: number
  allocatedAmount: number
  unallocatedAmount: number
  allocationStatus: PaymentAllocationStatus
}

export interface PaymentAllocationPreview {
  paymentId: string
  paymentNumber: string
  vendorName: string
  grossAmount: number
  tdsDeducted: number
  amountAvailable: number
  suggestedLines: PaymentAllocationLine[]
  unallocatedAfter: number
  warnings: string[]
}

export interface PaymentPostingPreview {
  paymentNumber: string
  vendorName: string
  paymentAmount: number
  allocatedAmount: number
  unallocatedAmount: number
  bankAccountName: string
  vendorControlAccount: string
  tdsAmount: number
  postingDate: string
  lines: { account: string; debit: number; credit: number; narration: string }[]
  balanced: boolean
  voucherNumber: string
  message: string
  warnings: string[]
}

export interface VendorStatementLine {
  date: string
  documentNumber: string
  documentType: string
  reference: string
  debit: number
  credit: number
  runningBalance: number
}

export interface VendorStatementPreview {
  companyName: string
  vendorId: string
  vendorName: string
  vendorAddress: string
  gstNumber: string | null
  pan: string | null
  statementPeriodFrom: string
  statementPeriodTo: string
  openingBalance: number
  closingBalance: number
  lines: VendorStatementLine[]
  ageingSummary: Record<PayableAgeingBucket, number> | null
}

export interface PaymentAdviceLine {
  invoiceNumber: string
  invoiceDate: string
  grossAmount: number
  tdsDeducted: number
  otherDeductions: number
  netPayable: number
}

export interface PaymentAdvicePreview {
  paymentNumber: string
  paymentDate: string
  vendorName: string
  vendorCode: string
  beneficiaryName: string
  bankName: string
  ifsc: string
  accountNumberMasked: string
  paymentMode: VendorPaymentMode
  grossAmount: number
  tdsDeducted: number
  otherDeductions: number
  bankCharges: number
  netPayment: number
  narration: string
  lines: PaymentAdviceLine[]
}

export interface VendorPayablesCard {
  vendor: PayableVendor
  outstanding: VendorOutstandingSummary
  openInvoices: PayableInvoice[]
  recentPayments: VendorPayment[]
  advances: VendorAdvance[]
  debitNotes: PayableDebitNote[]
  disputes: VendorDispute[]
  paymentHolds: PaymentHold[]
  bankDetails: VendorBankDetails | null
  threeWayMatchIssues: number
  alerts: string[]
}

export interface PayablesSetupGeneral {
  defaultPaymentTerms: number
  autoMatchTolerancePercent: number
  autoMatchToleranceAmount: number
  requireThreeWayMatch: boolean
  blockPaymentWithoutGrn: boolean
  msmePriorityEnabled: boolean
  msmePaymentDays: number
}

export interface PayablesSetupApproval {
  paymentProposalApprovalRequired: boolean
  paymentApprovalRequired: boolean
  paymentApprovalThreshold: number
  debitNoteApprovalRequired: boolean
  bankVerificationRequired: boolean
}

export interface PayablesSetupTds {
  autoCalculateTds: boolean
  defaultTdsSection: string
  tdsThresholdAmount: number
  showTdsOnPaymentAdvice: boolean
}

export interface PayablesSetupNotifications {
  notifyOnOverdue: boolean
  notifyOnProposalPending: boolean
  notifyOnBankChange: boolean
  notifyOnMsmeDue: boolean
}

export interface PayablesSetup {
  general: PayablesSetupGeneral
  approval: PayablesSetupApproval
  tds: PayablesSetupTds
  notifications: PayablesSetupNotifications
  lastUpdatedBy: string | null
  lastUpdatedAt: string | null
}

export interface PayablesReportCatalogEntry {
  id: string
  name: string
  description: string
  category: string
  permission: string
  formats: ('excel' | 'csv' | 'pdf')[]
}

export interface PayablesAuditEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  details: string
  performedBy: string
  performedAt: string
  isDemo: boolean
}

export interface PayablesSavedView {
  id: string
  name: string
  filters: PayableFilter
  columns: string[]
  sortKey: string
  sortDir: 'asc' | 'desc'
  selectedTab: string
  workspaceTab: PayableWorkspaceTab
  createdAt: string
  isDemo: boolean
}

export interface PayableFilter {
  search: string
  vendorId: string
  vendorCategory: string
  plant: string
  costCentre: string
  overdueStatus: 'all' | 'current' | 'overdue' | 'due_soon'
  ageingBucket: PayableAgeingBucket | ''
  amountMin: number | null
  amountMax: number | null
  dueDateFrom: string
  dueDateTo: string
  invoiceStatus: PayableInvoiceStatus | ''
  matchStatus: MatchStatus | ''
  invoiceTab: string
  paymentTab: string
  proposalTab: string
  disputeTab: string
  debitNoteTab: string
  advanceTab: string
  paymentMode: VendorPaymentMode | ''
  allocationStatus: PaymentAllocationStatus | ''
  paymentStatus: VendorPaymentStatus | ''
  proposalStatus: PaymentProposalStatus | ''
  vendorStatus: PayableVendorStatus | ''
  asOfDate: string
  financialYear: string
  ageingBasis: AgeingBasis
  workspaceTab: PayableWorkspaceTab
}

export const DEFAULT_PAYABLE_FILTER: PayableFilter = {
  search: '',
  vendorId: '',
  vendorCategory: '',
  plant: '',
  costCentre: '',
  overdueStatus: 'all',
  ageingBucket: '',
  amountMin: null,
  amountMax: null,
  dueDateFrom: '',
  dueDateTo: '',
  invoiceStatus: '',
  matchStatus: '',
  invoiceTab: 'all',
  paymentTab: 'all',
  proposalTab: 'all',
  disputeTab: 'open',
  debitNoteTab: 'all',
  advanceTab: 'all',
  paymentMode: '',
  allocationStatus: '',
  paymentStatus: '',
  proposalStatus: '',
  vendorStatus: '',
  asOfDate: new Date().toISOString().slice(0, 10),
  financialYear: '',
  ageingBasis: 'Due Date',
  workspaceTab: 'overview',
}

export interface VendorPaymentDraftInput {
  paymentDate: string
  postingDate: string
  vendorId: string
  paymentMode: VendorPaymentMode
  bankAccountId: string
  transactionReference?: string | null
  chequeNumber?: string | null
  chequeDate?: string | null
  amount: number
  tdsDeducted?: number
  otherDeductions?: number
  bankCharges?: number
  currency?: string
  exchangeRate?: number
  tdsSection?: string | null
  tdsRate?: number | null
  tdsBaseAmount?: number | null
  narration?: string
  internalRemarks?: string
  allocationLines?: { invoiceId: string; allocationAmount: number; tdsDeducted?: number }[]
}

export interface PayableExportRequest {
  scope:
    | 'vendor_outstanding'
    | 'open_invoices'
    | 'ageing'
    | 'payment_proposals'
    | 'vendor_payments'
    | 'payment_allocations'
    | 'vendor_advances'
    | 'debit_notes'
    | 'disputes'
    | 'msme_ageing'
    | 'tds_summary'
    | 'match_exceptions'
  format: 'excel' | 'csv' | 'pdf'
  filter?: Partial<PayableFilter>
  vendorId?: string
  reportId?: string
}

export interface PayableLookups {
  vendors: { id: string; code: string; name: string }[]
  vendorCategories: string[]
  vendorGroups: string[]
  plants: string[]
  costCentres: string[]
  buyers: string[]
  bankAccounts: { id: string; name: string; kind: 'bank' | 'cash' }[]
  matchStatuses: MatchStatus[]
  tdsSections: string[]
}

export interface PayablesPrintPreview {
  documentType: 'payment_advice' | 'vendor_statement' | 'payment_proposal' | 'ageing_report'
  title: string
  generatedAt: string
  htmlPreview: string
  disclaimer: string
}
