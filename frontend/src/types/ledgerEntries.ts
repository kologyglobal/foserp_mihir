/**
 * Ledger Entries — frontend models (read-only demo).
 * Prepared for future Node.js / MySQL API mapping.
 */

export type LedgerEntryStatus =
  | 'Posted'
  | 'Reversed'
  | 'Reversal Entry'
  | 'Opening Balance'
  | 'Adjustment'
  | 'System Generated'

export type LedgerVoucherType =
  | 'Payment'
  | 'Receipt'
  | 'Contra'
  | 'Journal'
  | 'Purchase Invoice'
  | 'Sales Invoice'
  | 'Stock Journal'
  | 'Production'
  | 'GST'
  | 'TDS'
  | 'Opening'
  | 'Reversal'

export type LedgerPartyType = 'Customer' | 'Vendor' | 'Employee' | 'Bank' | 'Other'

export type LedgerSourceModule =
  | 'Purchase'
  | 'Sales'
  | 'Inventory'
  | 'Production'
  | 'Fixed Assets'
  | 'Payroll'
  | 'Banking'
  | 'GST and TDS'
  | 'Manual Voucher'
  | 'Opening Balance'

export type ManufacturingLedgerAccountType =
  | 'Raw Material Inventory'
  | 'Work in Progress'
  | 'Finished Goods Inventory'
  | 'Material Consumption'
  | 'Direct Labour'
  | 'Factory Overhead'
  | 'Subcontracting'
  | 'Scrap'
  | 'Purchase Variance'
  | 'Production Variance'
  | 'Cost of Goods Sold'

export type LedgerViewTab =
  | 'general'
  | 'account'
  | 'voucher'
  | 'party'
  | 'cost_centre'
  | 'project'
  | 'manufacturing'

export type LedgerDateQuickRange =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'previous_month'
  | 'this_quarter'
  | 'this_financial_year'
  | 'custom'

export const LEDGER_ENTRY_STATUSES: LedgerEntryStatus[] = [
  'Posted',
  'Reversed',
  'Reversal Entry',
  'Opening Balance',
  'Adjustment',
  'System Generated',
]

export const LEDGER_VOUCHER_TYPES: LedgerVoucherType[] = [
  'Payment',
  'Receipt',
  'Contra',
  'Journal',
  'Purchase Invoice',
  'Sales Invoice',
  'Stock Journal',
  'Production',
  'GST',
  'TDS',
  'Opening',
  'Reversal',
]

export const LEDGER_PARTY_TYPES: LedgerPartyType[] = ['Customer', 'Vendor', 'Employee', 'Bank', 'Other']

export const MANUFACTURING_LEDGER_ACCOUNT_TYPES: ManufacturingLedgerAccountType[] = [
  'Raw Material Inventory',
  'Work in Progress',
  'Finished Goods Inventory',
  'Material Consumption',
  'Direct Labour',
  'Factory Overhead',
  'Subcontracting',
  'Scrap',
  'Purchase Variance',
  'Production Variance',
  'Cost of Goods Sold',
]

export interface LedgerEntryAccount {
  accountId: string
  code: string
  name: string
  category: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense'
  accountType: 'Group' | 'Posting'
  normalBalance: 'Debit' | 'Credit'
  controlAccountType: string | null
}

export interface LedgerEntryParty {
  partyType: LedgerPartyType
  partyId: string
  partyCode: string
  partyName: string
  gstNumber: string | null
}

export interface LedgerEntryDimension {
  company: string | null
  locationId: string | null
  locationName: string | null
  plantId: string | null
  plantName: string | null
  departmentId: string | null
  departmentName: string | null
  costCentreId: string | null
  costCentreCode: string | null
  costCentreName: string | null
  projectId: string | null
  projectCode: string | null
  projectName: string | null
  businessUnit: string | null
}

export interface LedgerEntryManufacturingReference {
  productionOrder: string | null
  workCentre: string | null
  machineCentre: string | null
  itemCode: string | null
  itemName: string | null
  itemCategory: string | null
  batchNumber: string | null
  jobWorkOrder: string | null
  manufacturingAccountType: ManufacturingLedgerAccountType | null
  costType: 'Material' | 'Labour' | 'Overhead' | 'Other' | null
}

export interface LedgerEntryTaxReference {
  gstApplicable: boolean
  gstType: string | null
  gstRate: number | null
  tdsApplicable: boolean
  tdsSection: string | null
  taxableAmount: number | null
}

export interface LedgerEntrySourceDocument {
  module: LedgerSourceModule
  documentType: string
  documentNumber: string
  documentDate: string
  partyName: string | null
  amount: number | null
  status: string
  /** Existing app route, or null when not available */
  href: string | null
  /**
   * Optional CRM / commercial chain for future posted sales invoices (display only).
   * Not persisted to a backend in Phase 1.
   */
  crmTrace?: {
    customerId?: string | null
    opportunityId?: string | null
    opportunityNo?: string | null
    quotationId?: string | null
    quotationNo?: string | null
    quotationRevisionId?: string | null
    quotationRevision?: number | null
    salesOrderId?: string | null
    salesOrderNo?: string | null
    salesInvoiceId?: string | null
    salesInvoiceNo?: string | null
    ownerName?: string | null
    sourceModule?: string | null
  } | null
}

export interface LedgerEntryReversalReference {
  originalEntryId: string | null
  originalVoucherNumber: string | null
  reversalEntryId: string | null
  reversalVoucherNumber: string | null
  reversalDate: string | null
  reversalReason: string | null
}

export interface LedgerEntryAuditEvent {
  id: string
  entryId: string
  action: string
  user: string
  at: string
  reference: string | null
  comment: string | null
  status: string | null
}

export interface LedgerEntry {
  id: string
  entryNumber: string
  postingDate: string
  documentDate: string
  voucherId: string | null
  voucherNumber: string
  voucherType: LedgerVoucherType
  referenceNumber: string
  externalDocumentNumber: string
  narration: string
  debit: number
  credit: number
  /** Mock running balance after this entry when sequenced by account (signed; Dr positive for debit-normal) */
  runningBalance: number
  runningBalanceSide: 'Dr' | 'Cr'
  status: LedgerEntryStatus
  account: LedgerEntryAccount
  party: LedgerEntryParty | null
  dimensions: LedgerEntryDimension
  manufacturing: LedgerEntryManufacturingReference
  tax: LedgerEntryTaxReference
  sourceDocument: LedgerEntrySourceDocument | null
  reversal: LedgerEntryReversalReference | null
  currency: string
  exchangeRate: number
  baseCurrencyAmount: number
  createdBy: string
  createdAt: string
  postedBy: string
  postedAt: string
  hasAttachments: boolean
  /** Preview-only rows are excluded from default posted queries */
  isPreviewOnly: boolean
}

export interface LedgerEntryFilter {
  search: string
  dateQuickRange: LedgerDateQuickRange
  postingDateFrom: string
  postingDateTo: string
  documentDateFrom: string
  documentDateTo: string
  entryNumber: string
  voucherNumber: string
  voucherType: LedgerVoucherType | ''
  entryStatus: LedgerEntryStatus | ''
  accountId: string
  accountCode: string
  accountName: string
  accountCategory: string
  accountType: string
  controlAccountType: string
  normalBalance: string
  partyType: LedgerPartyType | ''
  partyId: string
  partyCode: string
  partyName: string
  locationId: string
  plantId: string
  departmentId: string
  costCentreId: string
  projectId: string
  businessUnit: string
  productionOrder: string
  workCentre: string
  itemCode: string
  itemCategory: string
  batchNumber: string
  jobWorkOrder: string
  manufacturingAccountType: ManufacturingLedgerAccountType | ''
  createdBy: string
  postedBy: string
  reversedBy: string
  hasAttachments: '' | 'yes' | 'no'
  hasSourceDocument: '' | 'yes' | 'no'
  hasReversal: '' | 'yes' | 'no'
  isReversalEntry: '' | 'yes' | 'no'
  debitFrom: string
  debitTo: string
  creditFrom: string
  creditTo: string
  absoluteAmountFrom: string
  absoluteAmountTo: string
  hasBalanceImpact: '' | 'yes' | 'no'
  includePreview: boolean
  viewTab: LedgerViewTab
}

export interface LedgerSummary {
  entryCount: number
  totalDebit: number
  totalCredit: number
  netMovement: number
  postedVouchers: number
  reversedEntries: number
  accountsAffected: number
}

export interface AccountLedgerSummary {
  accountId: string
  openingBalance: number
  openingSide: 'Dr' | 'Cr'
  totalDebit: number
  totalCredit: number
  netMovement: number
  closingBalance: number
  closingSide: 'Dr' | 'Cr'
  entryCount: number
  lastPostingDate: string | null
}

export interface PartyLedgerSummary {
  partyId: string
  openingBalance: number
  openingSide: 'Dr' | 'Cr'
  debitMovement: number
  creditMovement: number
  closingBalance: number
  closingSide: 'Dr' | 'Cr'
  unappliedAmount: number
  entryCount: number
}

export interface ManufacturingLedgerSummary {
  materialConsumption: number
  labourCost: number
  factoryOverhead: number
  wipMovement: number
  finishedGoodsValue: number
  productionVariance: number
  scrapValue: number
}

/** Demo-only project cost rollup — not a profitability engine. */
export interface ProjectLedgerSummary {
  projectId: string
  projectCode: string
  projectName: string
  customer: string
  projectManager: string
  status: string
  revenue: number
  materialCost: number
  labourCost: number
  overhead: number
  otherCost: number
  netResult: number
  entryCount: number
}

/** Demo-only cost-centre rollup. */
export interface CostCentreLedgerSummary {
  costCentreId: string
  costCentreCode: string
  costCentreName: string
  totalDebit: number
  totalCredit: number
  netCost: number
  entryCount: number
}

export interface SavedLedgerView {
  id: string
  name: string
  filters: LedgerEntryFilter
  columns: string[]
  sortKey: string
  sortDir: 'asc' | 'desc'
  createdAt: string
  isDemo: true
}

export type LedgerExportScope =
  | 'current_view'
  | 'selected'
  | 'general'
  | 'account'
  | 'voucher'
  | 'party'
  | 'cost_centre'
  | 'project'
  | 'manufacturing'
  | 'audit'

export type LedgerExportFormat = 'excel' | 'csv' | 'pdf'

export interface LedgerExportRequest {
  scope: LedgerExportScope
  format: LedgerExportFormat
  filter?: Partial<LedgerEntryFilter>
  selectedIds?: string[]
}

export interface LedgerPrintPreview {
  reportName: string
  companyName: string
  dateRangeLabel: string
  filtersLabel: string
  generatedBy: string
  generatedAt: string
  rows: LedgerEntry[]
  confidentialityNote: string
  isDemo: true
}

export const DEFAULT_LEDGER_FILTER: LedgerEntryFilter = {
  search: '',
  dateQuickRange: 'this_financial_year',
  postingDateFrom: '',
  postingDateTo: '',
  documentDateFrom: '',
  documentDateTo: '',
  entryNumber: '',
  voucherNumber: '',
  voucherType: '',
  entryStatus: '',
  accountId: '',
  accountCode: '',
  accountName: '',
  accountCategory: '',
  accountType: '',
  controlAccountType: '',
  normalBalance: '',
  partyType: '',
  partyId: '',
  partyCode: '',
  partyName: '',
  locationId: '',
  plantId: '',
  departmentId: '',
  costCentreId: '',
  projectId: '',
  businessUnit: '',
  productionOrder: '',
  workCentre: '',
  itemCode: '',
  itemCategory: '',
  batchNumber: '',
  jobWorkOrder: '',
  manufacturingAccountType: '',
  createdBy: '',
  postedBy: '',
  reversedBy: '',
  hasAttachments: '',
  hasSourceDocument: '',
  hasReversal: '',
  isReversalEntry: '',
  debitFrom: '',
  debitTo: '',
  creditFrom: '',
  creditTo: '',
  absoluteAmountFrom: '',
  absoluteAmountTo: '',
  hasBalanceImpact: '',
  includePreview: false,
  viewTab: 'general',
}

export const LEDGER_VIEW_TAB_LABELS: Record<LedgerViewTab, string> = {
  general: 'General Ledger',
  account: 'Account Ledger',
  voucher: 'Voucher Entries',
  party: 'Party Ledger',
  cost_centre: 'Cost Centre Ledger',
  project: 'Project Ledger',
  manufacturing: 'Manufacturing Ledger',
}
