/**
 * Accounts Receivable — frontend models (demo / UI only).
 * Prepared for future Node.js / MySQL API mapping.
 * Does NOT post real GL, settle customer ledger, or send communications.
 */

export type ReceivableAgeingBucket =
  | 'Not Due'
  | '1–30 Days'
  | '31–60 Days'
  | '61–90 Days'
  | '91–180 Days'
  | 'Above 180 Days'

export type ReceivableInvoiceStatus =
  | 'Open'
  | 'Partially Paid'
  | 'Due Soon'
  | 'Overdue'
  | 'Disputed'
  | 'Paid'
  | 'Cancelled'

export type ReceivableStatus = ReceivableInvoiceStatus

export type CustomerCreditStatus =
  | 'Within Limit'
  | 'Near Limit'
  | 'Over Limit'
  | 'Credit Hold'
  | 'Temporarily Released'
  | 'No Credit Limit'

export type CollectionStatus =
  | 'Not Contacted'
  | 'Follow-up Required'
  | 'Contacted'
  | 'Promise Received'
  | 'Partial Payment Expected'
  | 'Disputed'
  | 'Escalated'
  | 'Credit Hold'
  | 'Closed'

export type ReceiptPaymentMode =
  | 'Cash'
  | 'Cheque'
  | 'NEFT'
  | 'RTGS'
  | 'IMPS'
  | 'UPI'
  | 'Bank Transfer'
  | 'Demand Draft'
  | 'Other'

export type ReceiptVoucherStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Posted'
  | 'Reversed'
  | 'Cancelled'

export type AllocationStatus =
  | 'Unallocated'
  | 'Partially Allocated'
  | 'Fully Allocated'

export type ReceiptStatus = ReceiptVoucherStatus

export type CollectionActivityType =
  | 'Call'
  | 'Email'
  | 'WhatsApp'
  | 'Meeting'
  | 'Internal Follow-up'
  | 'Escalation'
  | 'Payment Promise'
  | 'Dispute Discussion'
  | 'Other'

export type CollectionOutcome =
  | 'No Response'
  | 'Follow-up Required'
  | 'Promise to Pay'
  | 'Partial Payment'
  | 'Dispute Raised'
  | 'Payment Already Made'
  | 'Wrong Contact'
  | 'Escalation Required'
  | 'Closed'

export type PaymentPromiseStatus =
  | 'Active'
  | 'Partially Fulfilled'
  | 'Fulfilled'
  | 'Broken'
  | 'Cancelled'

export type DisputeStatus =
  | 'Open'
  | 'Under Review'
  | 'Awaiting Customer'
  | 'Awaiting Internal Team'
  | 'Resolved'
  | 'Rejected'
  | 'Closed'

export type DisputeType =
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

export type CreditNoteStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Posted'
  | 'Applied'
  | 'Partially Applied'
  | 'Unapplied'
  | 'Cancelled'

export type CreditNoteReason =
  | 'Sales Return'
  | 'Price Difference'
  | 'Quantity Difference'
  | 'Quality Claim'
  | 'Discount'
  | 'Freight Adjustment'
  | 'Tax Correction'
  | 'Commercial Settlement'
  | 'Other'

export type ReminderLevel =
  | 'Courtesy Reminder'
  | 'First Overdue Reminder'
  | 'Second Reminder'
  | 'Final Reminder'
  | 'Credit Hold Warning'
  | 'Escalation Notice'

export type ReminderCategory =
  | 'Due Soon'
  | 'Due Today'
  | '1–7 Days Overdue'
  | '8–30 Days Overdue'
  | '31–60 Days Overdue'
  | 'Above 60 Days'
  | 'Payment Promise Due'
  | 'Broken Promise'

export type AgeingBasis = 'Due Date' | 'Posting Date' | 'Invoice Date'

export type StatementType = 'Detailed' | 'Summary' | 'Open Items' | 'Ageing Statement'

export type ReceivableWorkspaceTab =
  | 'overview'
  | 'outstanding'
  | 'invoices'
  | 'ageing'
  | 'collections'
  | 'receipts'
  | 'allocations'
  | 'credit_notes'
  | 'disputes'
  | 'reminders'

export type CreditHoldReason =
  | 'Over Credit Limit'
  | 'Long Overdue'
  | 'Broken Payment Promise'
  | 'Dispute'
  | 'Management Decision'
  | 'Compliance Issue'
  | 'Other'

export type CollectionPriority =
  | 'Highest Overdue'
  | 'Highest Outstanding'
  | 'Oldest Invoice'
  | 'Broken Promise'
  | 'Credit Limit Exceeded'
  | 'Strategic Customer'
  | 'Manual Priority'

export type AutoAllocationMethod =
  | 'Oldest Due First'
  | 'Oldest Invoice First'
  | 'Exact Amount Match'
  | 'Smallest Balance First'
  | 'User Priority'

export type GstRegistrationType = 'Regular' | 'Composition' | 'Unregistered' | 'SEZ' | 'Export' | 'Government'

export const RECEIVABLE_AGEING_BUCKETS: ReceivableAgeingBucket[] = [
  'Not Due',
  '1–30 Days',
  '31–60 Days',
  '61–90 Days',
  '91–180 Days',
  'Above 180 Days',
]

export const RECEIVABLE_WORKSPACE_TABS: { id: ReceivableWorkspaceTab; label: string; path: string }[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/receivables' },
  { id: 'outstanding', label: 'Outstanding', path: '/accounting/receivables/outstanding' },
  { id: 'invoices', label: 'Invoices', path: '/accounting/receivables/invoices' },
  { id: 'ageing', label: 'Ageing', path: '/accounting/receivables/ageing' },
  { id: 'collections', label: 'Collections', path: '/accounting/receivables/collections' },
  { id: 'receipts', label: 'Receipts', path: '/accounting/receivables/receipts' },
  { id: 'allocations', label: 'Allocations', path: '/accounting/receivables/allocations' },
  { id: 'credit_notes', label: 'Credit Notes', path: '/accounting/receivables/credit-notes' },
  { id: 'disputes', label: 'Disputes', path: '/accounting/receivables/disputes' },
  { id: 'reminders', label: 'Reminders', path: '/accounting/receivables/reminders' },
]

export const RECEIPT_PAYMENT_MODES: ReceiptPaymentMode[] = [
  'Cash',
  'Cheque',
  'NEFT',
  'RTGS',
  'IMPS',
  'UPI',
  'Bank Transfer',
  'Demand Draft',
  'Other',
]

export const ELECTRONIC_PAYMENT_MODES: ReceiptPaymentMode[] = [
  'NEFT',
  'RTGS',
  'IMPS',
  'UPI',
  'Bank Transfer',
]

export const COLLECTION_STATUSES: CollectionStatus[] = [
  'Not Contacted',
  'Follow-up Required',
  'Contacted',
  'Promise Received',
  'Partial Payment Expected',
  'Disputed',
  'Escalated',
  'Credit Hold',
  'Closed',
]

export const COLLECTION_ACTIVITY_TYPES: CollectionActivityType[] = [
  'Call',
  'Email',
  'WhatsApp',
  'Meeting',
  'Internal Follow-up',
  'Escalation',
  'Payment Promise',
  'Dispute Discussion',
  'Other',
]

export const COLLECTION_OUTCOMES: CollectionOutcome[] = [
  'No Response',
  'Follow-up Required',
  'Promise to Pay',
  'Partial Payment',
  'Dispute Raised',
  'Payment Already Made',
  'Wrong Contact',
  'Escalation Required',
  'Closed',
]

export const DISPUTE_TYPES: DisputeType[] = [
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

export const CREDIT_NOTE_REASONS: CreditNoteReason[] = [
  'Sales Return',
  'Price Difference',
  'Quantity Difference',
  'Quality Claim',
  'Discount',
  'Freight Adjustment',
  'Tax Correction',
  'Commercial Settlement',
  'Other',
]

export const CREDIT_HOLD_REASONS: CreditHoldReason[] = [
  'Over Credit Limit',
  'Long Overdue',
  'Broken Payment Promise',
  'Dispute',
  'Management Decision',
  'Compliance Issue',
  'Other',
]

export const REMINDER_LEVELS: ReminderLevel[] = [
  'Courtesy Reminder',
  'First Overdue Reminder',
  'Second Reminder',
  'Final Reminder',
  'Credit Hold Warning',
  'Escalation Notice',
]

export const AUTO_ALLOCATION_METHODS: AutoAllocationMethod[] = [
  'Oldest Due First',
  'Oldest Invoice First',
  'Exact Amount Match',
  'Smallest Balance First',
  'User Priority',
]

export interface ReceivableCustomer {
  id: string
  customerCode: string
  customerName: string
  customerGroup: string
  gstNumber: string | null
  gstRegistrationType: GstRegistrationType
  state: string
  territory: string
  salesperson: string
  collectionOwner: string
  paymentTerms: string
  creditLimit: number
  creditStatus: CustomerCreditStatus
  contactPerson: string
  email: string
  mobile: string
  billingAddress: string
  shippingAddress: string
  averageCollectionDays: number
  isStrategic: boolean
  masterCustomerId: string | null
}

export interface ReceivableInvoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  postingDate: string
  dueDate: string
  customerId: string
  customerCode: string
  customerName: string
  customerGstNumber: string | null
  salesOrderNumber: string | null
  deliveryNumber: string | null
  referenceNumber: string | null
  paymentTerms: string
  placeOfSupply: string
  salesperson: string
  territory: string
  location: string
  originalAmount: number
  taxableAmount: number
  cgst: number
  sgst: number
  igst: number
  appliedAmount: number
  creditNoteAmount: number
  outstandingBalance: number
  overdueDays: number
  ageingBucket: ReceivableAgeingBucket
  invoiceStatus: ReceivableInvoiceStatus
  collectionStatus: CollectionStatus
  collectionOwner: string
  gstStatus: string
  eInvoiceStatus: string
  eInvoiceIrn: string | null
  eWayBillNumber: string | null
  hasDispute: boolean
  hasCreditNote: boolean
  lastReminderDate: string | null
  paymentPromiseDate: string | null
  invoiceType: string
  sourceSalesInvoiceId: string | null
}

export interface CustomerOutstandingSummary {
  customerId: string
  customerCode: string
  customerName: string
  customerGroup: string
  gstNumber: string | null
  state: string
  salesperson: string
  territory: string
  paymentTerms: string
  creditLimit: number
  totalOutstanding: number
  currentAmount: number
  overdueAmount: number
  oldestDueDate: string | null
  maximumOverdueDays: number
  unallocatedReceipt: number
  creditUtilization: number
  collectionOwner: string
  creditStatus: CustomerCreditStatus
  averageCollectionDays: number
  lastReceiptDate: string | null
  lastReceiptAmount: number
  openInvoiceCount: number
  disputeAmount: number
  promisedPaymentDate: string | null
  hasDispute: boolean
  hasPaymentPromise: boolean
  collectionStatus: CollectionStatus
  gstRegistrationType: GstRegistrationType
}

export interface ReceiptAllocationLine {
  id: string
  invoiceId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  originalAmount: number
  previousAllocation: number
  outstandingBalance: number
  overdueDays: number
  discountEligible: boolean
  tdsAmount: number
  allocationAmount: number
  remainingBalance: number
  status: string
}

export interface ReceiptAllocation {
  receiptId: string
  lines: ReceiptAllocationLine[]
  receiptAmount: number
  tdsDeducted: number
  bankCharges: number
  amountAvailable: number
  allocatedAmount: number
  unallocatedAmount: number
  allocationStatus: AllocationStatus
}

export interface CustomerReceipt {
  id: string
  receiptNumber: string
  receiptDate: string
  postingDate: string
  customerId: string
  customerCode: string
  customerName: string
  customerBankReference: string | null
  paymentMode: ReceiptPaymentMode
  bankOrCashAccountId: string
  bankOrCashAccountName: string
  transactionReference: string | null
  chequeNumber: string | null
  chequeDate: string | null
  bankName: string | null
  currency: string
  exchangeRate: number
  receiptAmount: number
  tdsDeducted: number
  bankCharges: number
  netAmountReceived: number
  allocatedAmount: number
  unallocatedAmount: number
  allocationStatus: AllocationStatus
  voucherStatus: ReceiptVoucherStatus
  narration: string
  internalRemarks: string
  createdBy: string
  postedBy: string | null
  postedAt: string | null
  relatedVoucherId: string | null
  relatedVoucherNumber: string | null
  originalReceiptId: string | null
  reversalReceiptId: string | null
  allocationLines: ReceiptAllocationLine[]
  attachments: { id: string; name: string; uploadedAt: string }[]
}

export interface CollectionActivity {
  id: string
  customerId: string
  customerName: string
  invoiceId: string | null
  invoiceNumber: string | null
  activityType: CollectionActivityType
  activityDate: string
  contactPerson: string
  contactMode: string
  outcome: CollectionOutcome
  nextFollowUpDate: string | null
  notes: string
  promiseDate: string | null
  promiseAmount: number | null
  escalationRequired: boolean
  collectionOwner: string
  status: CollectionStatus
  completed: boolean
  createdAt: string
  createdBy: string
}

export interface PaymentPromise {
  id: string
  customerId: string
  customerName: string
  invoiceId: string | null
  invoiceNumber: string | null
  promiseDate: string
  promiseAmount: number
  paymentMode: ReceiptPaymentMode | null
  customerContact: string
  notes: string
  followUpDate: string | null
  status: PaymentPromiseStatus
  collectedAmount: number
  collectionOwner: string
  createdAt: string
}

export interface CustomerDispute {
  id: string
  disputeNumber: string
  customerId: string
  customerName: string
  invoiceId: string
  invoiceNumber: string
  disputeDate: string
  disputeType: DisputeType
  disputedAmount: number
  description: string
  owner: string
  responsibleDepartment: string
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  targetResolutionDate: string
  status: DisputeStatus
  resolution: string | null
  creditNoteRequired: boolean
  collectionHold: boolean
  supportingDocuments: string[]
  createdAt: string
}

export interface CreditNoteApplication {
  id: string
  creditNoteId: string
  invoiceId: string
  invoiceNumber: string
  appliedAmount: number
  appliedDate: string
}

export interface CreditNote {
  id: string
  creditNoteNumber: string
  creditNoteDate: string
  customerId: string
  customerName: string
  referenceInvoiceId: string | null
  referenceInvoiceNumber: string | null
  reason: CreditNoteReason
  originalAmount: number
  appliedAmount: number
  remainingAmount: number
  gstAdjustment: number
  status: CreditNoteStatus
  sourceDocument: string | null
  relatedVoucherId: string | null
  applications: CreditNoteApplication[]
}

export interface PaymentReminder {
  id: string
  customerId: string
  customerName: string
  invoiceId: string
  invoiceNumber: string
  dueDate: string
  overdueDays: number
  outstandingAmount: number
  lastReminderDate: string | null
  reminderLevel: ReminderLevel
  category: ReminderCategory
  contactPerson: string
  email: string
  mobile: string
  collectionOwner: string
  excluded: boolean
  demoMarkedSentAt: string | null
}

export interface CustomerStatementLine {
  date: string
  documentNumber: string
  documentType: string
  reference: string
  debit: number
  credit: number
  runningBalance: number
}

export interface CustomerStatement {
  companyName: string
  customerId: string
  customerName: string
  customerAddress: string
  gstNumber: string | null
  statementPeriodFrom: string
  statementPeriodTo: string
  statementType: StatementType
  openingBalance: number
  closingBalance: number
  lines: CustomerStatementLine[]
  ageingSummary: Record<ReceivableAgeingBucket, number> | null
  contactDetails: { person: string; email: string; mobile: string } | null
}

export interface ReceivableAuditEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  details: string
  performedBy: string
  performedAt: string
  isDemo: boolean
}

export interface ReceivableFilter {
  search: string
  customerId: string
  customerGroup: string
  salesperson: string
  territory: string
  state: string
  location: string
  creditStatus: CustomerCreditStatus | ''
  overdueStatus: 'all' | 'current' | 'overdue' | 'due_soon'
  ageingBucket: ReceivableAgeingBucket | ''
  amountMin: number | null
  amountMax: number | null
  dueDateFrom: string
  dueDateTo: string
  gstRegistrationType: GstRegistrationType | ''
  hasDispute: 'all' | 'yes' | 'no'
  hasPaymentPromise: 'all' | 'yes' | 'no'
  invoiceStatus: ReceivableInvoiceStatus | ''
  invoiceTab: string
  receiptTab: string
  collectionTab: string
  disputeTab: string
  creditNoteTab: string
  reminderCategory: ReminderCategory | ''
  paymentMode: ReceiptPaymentMode | ''
  allocationStatus: AllocationStatus | ''
  voucherStatus: ReceiptVoucherStatus | ''
  collectionOwner: string
  priority: CollectionPriority | ''
  asOfDate: string
  financialYear: string
  ageingBasis: AgeingBasis
  workspaceTab: ReceivableWorkspaceTab
}

export const DEFAULT_RECEIVABLE_FILTER: ReceivableFilter = {
  search: '',
  customerId: '',
  customerGroup: '',
  salesperson: '',
  territory: '',
  state: '',
  location: '',
  creditStatus: '',
  overdueStatus: 'all',
  ageingBucket: '',
  amountMin: null,
  amountMax: null,
  dueDateFrom: '',
  dueDateTo: '',
  gstRegistrationType: '',
  hasDispute: 'all',
  hasPaymentPromise: 'all',
  invoiceStatus: '',
  invoiceTab: 'all',
  receiptTab: 'all',
  collectionTab: 'my_worklist',
  disputeTab: 'open',
  creditNoteTab: 'all',
  reminderCategory: '',
  paymentMode: '',
  allocationStatus: '',
  voucherStatus: '',
  collectionOwner: '',
  priority: '',
  asOfDate: new Date().toISOString().slice(0, 10),
  financialYear: '',
  ageingBasis: 'Due Date',
  workspaceTab: 'overview',
}

export interface ReceivableSavedView {
  id: string
  name: string
  filters: ReceivableFilter
  columns: string[]
  sortKey: string
  sortDir: 'asc' | 'desc'
  selectedTab: string
  createdAt: string
  isDemo: boolean
}

export interface ReceivablesDashboardKpis {
  totalReceivables: number
  currentOutstanding: number
  overdueAmount: number
  dueThisWeek: number
  receiptsThisMonth: number
  unallocatedReceipts: number
  customersOverCreditLimit: number
  averageCollectionDays: number
}

export interface ReceivablesDashboardData {
  kpis: ReceivablesDashboardKpis
  ageing: { bucket: ReceivableAgeingBucket; amount: number; count: number }[]
  outstandingByCustomer: CustomerOutstandingSummary[]
  upcomingDueInvoices: ReceivableInvoice[]
  criticalAlerts: {
    id: string
    type: string
    severity: 'info' | 'warning' | 'critical'
    title: string
    description: string
    href: string
  }[]
  billingCollectionTrend: { month: string; billed: number; collected: number }[]
  topOverdueCustomers: CustomerOutstandingSummary[]
  recentReceipts: CustomerReceipt[]
  collectionTeamActivity: CollectionActivity[]
}

export interface CustomerAgeingRow {
  customerId: string
  customerName: string
  creditLimit: number
  notDue: number
  d1to30: number
  d31to60: number
  d61to90: number
  d91to180: number
  above180: number
  totalOutstanding: number
}

export interface ReceivableAgeingResult {
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
  customerWise: CustomerAgeingRow[]
  invoiceWise: ReceivableInvoice[]
}

export interface CollectionWorklistItem {
  id: string
  priority: number
  priorityReason: CollectionPriority
  customerId: string
  customerName: string
  totalOutstanding: number
  overdue: number
  oldestOverdueDays: number
  lastContact: string | null
  nextFollowUp: string | null
  paymentPromise: string | null
  promiseAmount: number | null
  collectionOwner: string
  collectionStatus: CollectionStatus
  isBrokenPromise: boolean
  hasDispute: boolean
}

export interface CustomerReceivableCard {
  customer: ReceivableCustomer
  creditLimit: number
  totalOutstanding: number
  overdue: number
  availableCredit: number
  averageCollectionDays: number
  lastReceipt: CustomerReceipt | null
  openInvoiceCount: number
  disputeAmount: number
  creditUtilization: number
  ageing: Record<ReceivableAgeingBucket, number>
  openInvoices: ReceivableInvoice[]
  receipts: CustomerReceipt[]
  creditNotes: CreditNote[]
  disputes: CustomerDispute[]
  activities: CollectionActivity[]
  promises: PaymentPromise[]
  alerts: string[]
  audit: ReceivableAuditEntry[]
}

export interface ReceiptDraftInput {
  receiptDate: string
  postingDate: string
  customerId: string
  customerBankReference?: string | null
  paymentMode: ReceiptPaymentMode
  bankOrCashAccountId: string
  transactionReference?: string | null
  chequeNumber?: string | null
  chequeDate?: string | null
  bankName?: string | null
  currency?: string
  exchangeRate?: number
  receiptAmount: number
  tdsDeducted?: number
  bankCharges?: number
  narration?: string
  internalRemarks?: string
  allocationLines?: { invoiceId: string; allocationAmount: number; tdsAmount?: number }[]
}

export interface AutoAllocationPreview {
  method: AutoAllocationMethod
  receiptAmount: number
  invoiceCount: number
  totalAllocated: number
  remainingAmount: number
  proposedLines: ReceiptAllocationLine[]
}

export interface ReceiptPostingPreview {
  receiptNumber: string
  customerName: string
  receiptAmount: number
  allocatedAmount: number
  unallocatedAmount: number
  bankOrCashAccountName: string
  customerControlAccount: string
  tdsAmount: number
  bankCharges: number
  postingDate: string
  warnings: string[]
}

export interface CreditHoldInput {
  customerId: string
  holdReason: CreditHoldReason
  effectiveDate: string
  reviewDate: string
  internalNote: string
}

export interface CreditHoldReleaseInput {
  customerId: string
  releaseReason: string
  validUntil: string
  approvedBy: string
  internalNote: string
}

export interface ReceivableExportRequest {
  scope:
    | 'customer_outstanding'
    | 'open_invoices'
    | 'ageing'
    | 'customer_statement'
    | 'collection_worklist'
    | 'receipts'
    | 'receipt_allocations'
    | 'credit_notes'
    | 'disputes'
    | 'payment_promises'
    | 'reminder_history'
  format: 'excel' | 'csv' | 'pdf'
  filter?: Partial<ReceivableFilter>
  customerId?: string
}

export interface ReceivablePrintPreview {
  companyName: string
  reportName: string
  subtitle: string
  filtersApplied: string
  generatedBy: string
  generatedAt: string
  html: string
}

export interface ReceivableLookups {
  customers: { id: string; code: string; name: string }[]
  customerGroups: string[]
  salespersons: string[]
  territories: string[]
  states: string[]
  locations: string[]
  collectionOwners: string[]
  bankAccounts: { id: string; name: string; kind: 'bank' | 'cash' }[]
}
