/**
 * FOS ERP — Accounting module types (frontend-only, mock/localStorage).
 * No backend, no Prisma, no real posting engine. Demo data only.
 */

export type AccountGroupType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'
export type AccountNature = 'debit' | 'credit'

export const ACCOUNT_GROUP_LABELS: Record<AccountGroupType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
}

export interface LedgerAccount {
  id: string
  code: string
  name: string
  parentId: string | null
  groupType: AccountGroupType
  nature: AccountNature
  isGroup: boolean
  isPostable: boolean
  isActive: boolean
  currency: string
  description?: string
  costCenterRequired?: boolean
  linkedTo?: 'customer' | 'vendor' | 'bank' | 'cash' | null
  openingBalance: number
  openingBalanceType: AccountNature
  createdAt: string
  updatedAt: string
}

export type VoucherType = 'payment' | 'receipt' | 'contra' | 'journal'

export const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  payment: 'Payment Voucher',
  receipt: 'Receipt Voucher',
  contra: 'Contra Voucher',
  journal: 'Journal Voucher',
}

export const VOUCHER_TYPE_PREFIX: Record<VoucherType, string> = {
  payment: 'PMT',
  receipt: 'RCT',
  contra: 'CTR',
  journal: 'JV',
}

export type VoucherStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'posted'
  | 'rejected'
  | 'reversed'

export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  posted: 'Posted',
  rejected: 'Rejected',
  reversed: 'Reversed',
}

export type PaymentMode = 'cash' | 'bank' | 'cheque' | 'neft' | 'rtgs' | 'upi'

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  bank: 'Bank Transfer',
  cheque: 'Cheque',
  neft: 'NEFT',
  rtgs: 'RTGS',
  upi: 'UPI',
}

export interface SourceDocumentRef {
  type: 'sales_order' | 'purchase_order' | 'grn' | 'dispatch' | 'invoice' | 'quotation' | 'work_order' | 'other'
  id: string
  label: string
  href?: string | null
}

export interface VoucherLine {
  id: string
  lineNo: number
  accountId: string
  debit: number
  credit: number
  narration: string
  costCenterId?: string | null
  dimension1?: string | null
  dimension2?: string | null
  partyType?: 'customer' | 'vendor' | null
  partyId?: string | null
}

export interface VoucherAttachment {
  id: string
  name: string
  sizeKb: number
  uploadedAt: string
}

export interface Voucher {
  id: string
  voucherNo: string
  voucherType: VoucherType
  voucherDate: string
  narration: string
  status: VoucherStatus
  lines: VoucherLine[]
  totalDebit: number
  totalCredit: number
  sourceDocument?: SourceDocumentRef | null
  referenceNo?: string
  bankAccountId?: string | null
  paymentMode?: PaymentMode | null
  chequeNo?: string
  chequeDate?: string | null
  partyType?: 'customer' | 'vendor' | null
  partyId?: string | null
  dimension1?: string | null
  dimension2?: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  submittedAt?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  postedBy?: string | null
  postedAt?: string | null
  rejectedReason?: string | null
  reversedByVoucherId?: string | null
  reversalOfVoucherId?: string | null
  attachments: VoucherAttachment[]
}

export type LedgerEntrySourceType =
  | VoucherType
  | 'opening_balance'
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'manufacturing'

export interface LedgerEntry {
  id: string
  entryDate: string
  accountId: string
  voucherId: string
  voucherNo: string
  sourceType: LedgerEntrySourceType
  debit: number
  credit: number
  narration: string
  partyType?: 'customer' | 'vendor' | null
  partyId?: string | null
  costCenterId?: string | null
  createdAt: string
}

export type OpenItemDocumentType = 'invoice' | 'payment' | 'credit_note' | 'debit_note' | 'receipt'

export interface OpenItemEntry {
  id: string
  partyType: 'customer' | 'vendor'
  partyId: string
  partyName: string
  documentType: OpenItemDocumentType
  documentNo: string
  documentDate: string
  dueDate: string | null
  amount: number
  amountSettled: number
  balance: number
  sourceDocument?: SourceDocumentRef | null
}

export interface AgeingBucketRow {
  partyId: string
  partyName: string
  current: number
  d1to30: number
  d31to60: number
  d61to90: number
  d90plus: number
  total: number
}

export interface BankStatementLine {
  id: string
  bankAccountId: string
  txnDate: string
  description: string
  reference: string
  debit: number
  credit: number
  isMatched: boolean
  matchedLedgerEntryId?: string | null
}

export interface BankReconciliationSession {
  id: string
  bankAccountId: string
  statementDate: string
  openingBalanceBank: number
  closingBalanceBank: number
  openingBalanceBooks: number
  closingBalanceBooks: number
  status: 'in_progress' | 'completed'
  matches: { statementLineId: string; ledgerEntryId: string; matchedAt: string }[]
  completedAt?: string | null
  completedBy?: string | null
}

export interface CashBankAccountSummary {
  accountId: string
  accountName: string
  accountCode: string
  kind: 'bank' | 'cash'
  bankName?: string
  accountNumberMasked?: string
  ifsc?: string
  currentBalance: number
  lastReconciledDate?: string | null
}

export interface InventoryValuationRow {
  id: string
  itemCode: string
  itemName: string
  warehouseName: string
  qtyOnHand: number
  valuationMethod: 'FIFO' | 'Moving Average' | 'Standard Cost'
  unitCost: number
  totalValue: number
  glAccountId: string
  asOfDate: string
}

export interface WipRow {
  id: string
  workOrderNo: string
  itemName: string
  materialCost: number
  labourCost: number
  overheadCost: number
  totalWip: number
  status: 'in_progress' | 'completed' | 'closed'
}

export interface CostVarianceRow {
  id: string
  workOrderNo: string
  itemName: string
  standardCost: number
  actualCost: number
  materialVariance: number
  labourVariance: number
  overheadVariance: number
  totalVariance: number
}

export interface GrniRow {
  id: string
  grnNo: string
  poNo: string
  vendorName: string
  grnDate: string
  grnValue: number
  invoicedValue: number
  outstandingValue: number
  ageDays: number
}

export interface InvVsGlRow {
  id: string
  category: string
  inventoryLedgerValue: number
  glStockAccountValue: number
  difference: number
}

export interface ProductionOrderCostMock {
  id: string
  woNo: string
  itemName: string
  qtyProduced: number
  materialCost: number
  labourCost: number
  overheadCost: number
  totalCost: number
  unitCost: number
  status: 'in_progress' | 'completed'
}

export type GstReturnStatus = 'not_filed' | 'draft' | 'filed'

export interface GstSummaryRow {
  id: string
  period: string
  returnType: 'GSTR-1' | 'GSTR-3B'
  outputTax: number
  inputTaxCredit: number
  netPayable: number
  status: GstReturnStatus
  dueDate: string
  filedDate?: string | null
}

export interface TdsEntryRow {
  id: string
  section: string
  partyName: string
  partyPan: string
  paymentDate: string
  paymentAmount: number
  tdsRate: number
  tdsAmount: number
  challanNo?: string | null
  challanDate?: string | null
  status: 'pending' | 'deposited' | 'return_filed'
}

export type PeriodCloseTaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked'

export interface PeriodCloseTask {
  id: string
  period: string
  taskLabel: string
  category: 'reconciliation' | 'review' | 'reporting' | 'approval'
  status: PeriodCloseTaskStatus
  assignedTo: string
  completedAt?: string | null
  notes?: string
}

export interface PeriodCloseChecklist {
  id: string
  period: string
  isLocked: boolean
  tasks: PeriodCloseTask[]
}

export interface PostingSetupRule {
  id: string
  area: string
  event: string
  debitAccountName: string
  creditAccountName: string
  isActive: boolean
}

export interface AccountingDimensionValue {
  id: string
  code: string
  name: string
  isActive: boolean
}

export interface AccountingDimension {
  id: string
  name: string
  description: string
  values: AccountingDimensionValue[]
}

export interface AccountingPeriodSetup {
  id: string
  fiscalYear: string
  periodName: string
  startDate: string
  endDate: string
  status: 'open' | 'closed' | 'locked'
}

/** Mock roles — scoped to Accounting module only (does not affect global RBAC). */
export type AccountingMockRole =
  | 'accountant'
  | 'finance-manager'
  | 'finance-administrator'
  | 'auditor'
  | 'cashier'

export const ACCOUNTING_ROLE_LABELS: Record<AccountingMockRole, string> = {
  accountant: 'Accountant',
  'finance-manager': 'Finance Manager',
  'finance-administrator': 'Finance Administrator',
  auditor: 'Auditor',
  cashier: 'Cashier',
}

export const ALL_ACCOUNTING_ROLES: AccountingMockRole[] = [
  'accountant',
  'finance-manager',
  'finance-administrator',
  'auditor',
  'cashier',
]

/** Roles allowed to view/edit Accounting Setup (posting setups, dimensions, periods). */
export const ACCOUNTING_SETUP_ROLES: AccountingMockRole[] = ['finance-manager', 'finance-administrator']

/** Roles allowed to approve/post vouchers. */
export const ACCOUNTING_APPROVER_ROLES: AccountingMockRole[] = ['finance-manager', 'finance-administrator']

/** Roles that are read-only across the module (cannot create/edit/post). */
export const ACCOUNTING_READONLY_ROLES: AccountingMockRole[] = ['auditor']
