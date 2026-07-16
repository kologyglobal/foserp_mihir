/**
 * Chart of Accounts — frontend models.
 * Prepared for future Node.js / MySQL API mapping. Demo/mock only today.
 */

export type AccountCategory = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense'
export type AccountType = 'Group' | 'Posting'
export type NormalBalance = 'Debit' | 'Credit'

export type ControlAccountType =
  | 'Customer Receivable'
  | 'Vendor Payable'
  | 'Bank'
  | 'Cash'
  | 'Inventory'
  | 'Fixed Asset'
  | 'GST'
  | 'TDS'
  | 'Payroll'
  | 'Loan'
  | 'Other'

export type GstAccountType =
  | 'Input CGST'
  | 'Input SGST'
  | 'Input IGST'
  | 'Output CGST'
  | 'Output SGST'
  | 'Output IGST'
  | 'GST Payable'
  | 'GST Receivable'
  | 'GST Adjustment'
  | 'Not Applicable'

export type TdsAccountType = 'TDS Payable' | 'TDS Receivable' | 'TDS Expense' | 'Not Applicable'

export type ManufacturingAccountType =
  | 'Raw Material Inventory'
  | 'Work in Progress'
  | 'Finished Goods Inventory'
  | 'Stores and Consumables'
  | 'Material Consumption'
  | 'Direct Labour'
  | 'Factory Overhead'
  | 'Subcontracting'
  | 'Scrap'
  | 'Purchase Variance'
  | 'Production Variance'
  | 'Cost of Goods Sold'
  | 'Not Applicable'

export type CostElementType = 'Material' | 'Labour' | 'Machine' | 'Overhead' | 'Subcontracting' | 'Other'

export type AccountStatus = 'Active' | 'Inactive'

export const ACCOUNT_CATEGORIES: AccountCategory[] = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']
export const ACCOUNT_TYPES: AccountType[] = ['Group', 'Posting']
export const NORMAL_BALANCES: NormalBalance[] = ['Debit', 'Credit']
export const CONTROL_ACCOUNT_TYPES: ControlAccountType[] = [
  'Customer Receivable',
  'Vendor Payable',
  'Bank',
  'Cash',
  'Inventory',
  'Fixed Asset',
  'GST',
  'TDS',
  'Payroll',
  'Loan',
  'Other',
]
export const GST_ACCOUNT_TYPES: GstAccountType[] = [
  'Input CGST',
  'Input SGST',
  'Input IGST',
  'Output CGST',
  'Output SGST',
  'Output IGST',
  'GST Payable',
  'GST Receivable',
  'GST Adjustment',
  'Not Applicable',
]
export const TDS_ACCOUNT_TYPES: TdsAccountType[] = [
  'TDS Payable',
  'TDS Receivable',
  'TDS Expense',
  'Not Applicable',
]
export const MANUFACTURING_ACCOUNT_TYPES: ManufacturingAccountType[] = [
  'Raw Material Inventory',
  'Work in Progress',
  'Finished Goods Inventory',
  'Stores and Consumables',
  'Material Consumption',
  'Direct Labour',
  'Factory Overhead',
  'Subcontracting',
  'Scrap',
  'Purchase Variance',
  'Production Variance',
  'Cost of Goods Sold',
  'Not Applicable',
]
export const COST_ELEMENT_TYPES: CostElementType[] = [
  'Material',
  'Labour',
  'Machine',
  'Overhead',
  'Subcontracting',
  'Other',
]

export interface AccountPostingControl {
  allowDirectPosting: boolean
  allowManualJournalPosting: boolean
  reconciliationRequired: boolean
  isControlAccount: boolean
  controlAccountType: ControlAccountType | null
  allowOpeningBalance: boolean
  costCentreRequired: boolean
  projectRequired: boolean
  departmentRequired: boolean
  blockNegativeBalance: boolean
  currency: string
  postingDescriptionRequired: boolean
}

export interface AccountTaxConfiguration {
  gstRelevant: boolean
  gstAccountType: GstAccountType
  tdsRelevant: boolean
  tdsAccountType: TdsAccountType
  tcsRelevant: boolean
  reverseChargeApplicable: boolean
  statutoryAccount: boolean
  complianceNotes: string
}

export interface ManufacturingAccountConfiguration {
  manufacturingAccount: boolean
  manufacturingAccountType: ManufacturingAccountType
  inventoryValuationAccount: boolean
  consumptionAccount: boolean
  wipAccount: boolean
  finishedGoodsAccount: boolean
  cogsAccount: boolean
  purchaseVarianceAccount: boolean
  productionVarianceAccount: boolean
  scrapAccount: boolean
  overheadAccount: boolean
  costElementType: CostElementType | null
}

export interface AccountDimensionConfiguration {
  defaultCostCentreId: string | null
  costCentreMandatory: boolean
  defaultDepartmentId: string | null
  departmentMandatory: boolean
  defaultProjectId: string | null
  projectMandatory: boolean
  defaultPlantId: string | null
  plantMandatory: boolean
  defaultLocationId: string | null
  locationMandatory: boolean
}

export interface AccountBalance {
  accountId: string
  openingBalance: number
  debitMovement: number
  creditMovement: number
  closingBalance: number
  /** Demo label — not live GL */
  isDemo: true
}

export interface AccountAuditEntry {
  id: string
  accountId: string
  action: string
  performedBy: string
  performedAt: string
  details?: string
}

export interface ChartOfAccount {
  id: string
  code: string
  name: string
  alias: string
  accountType: AccountType
  category: AccountCategory
  parentId: string | null
  normalBalance: NormalBalance
  description: string
  active: boolean
  systemAccount: boolean
  posting: AccountPostingControl
  tax: AccountTaxConfiguration
  manufacturing: ManufacturingAccountConfiguration
  dimensions: AccountDimensionConfiguration
  /** Demo current balance (closing) */
  currentBalance: number
  /** Demo flag: account has mock ledger activity */
  hasLedgerActivity: boolean
  createdBy: string
  createdAt: string
  modifiedBy: string
  modifiedAt: string
  deactivatedReason?: string | null
}

export interface AccountHierarchyNode {
  id: string
  code: string
  name: string
  accountType: AccountType
  category: AccountCategory
  parentId: string | null
  childCount: number
  descendantCount: number
  children: AccountHierarchyNode[]
}

export interface AccountFilter {
  search: string
  category: AccountCategory | ''
  accountType: AccountType | ''
  parentId: string | ''
  normalBalance: NormalBalance | ''
  directPosting: '' | 'yes' | 'no'
  controlAccount: '' | 'yes' | 'no'
  activeStatus: '' | 'Active' | 'Inactive'
  gstRelevant: '' | 'yes' | 'no'
  tdsRelevant: '' | 'yes' | 'no'
  reconciliationRequired: '' | 'yes' | 'no'
  costCentreRequired: '' | 'yes' | 'no'
  hasBalance: '' | 'yes' | 'no'
  createdBy: string
  createdDateFrom: string
  createdDateTo: string
  /** Quick filters from summary / tree / tabs */
  treeGroupId: string | null
  listTab: 'all' | 'posting' | 'group' | 'inactive' | 'control'
}

export interface AccountImportPreviewRow {
  rowNumber: number
  code: string
  name: string
  accountType: string
  category: string
  parentAccountCode: string
  normalBalance: string
  directPosting: string
  controlAccount: string
  active: string
  status: 'valid' | 'error' | 'warning'
  errors: string[]
}

export interface AccountImportPreview {
  fileName: string
  totalRows: number
  validRows: number
  errorRows: number
  warningRows: number
  rows: AccountImportPreviewRow[]
  /** UI-only — never claimed as permanently imported */
  isDemoPreview: true
}

export interface AccountLedgerPreviewLine {
  id: string
  date: string
  voucherNo: string
  narration: string
  debit: number
  credit: number
  balance: number
  isDemo: true
}

export interface DimensionLookupOption {
  id: string
  code: string
  name: string
}

export interface AccountFormInput {
  code: string
  name: string
  alias: string
  accountType: AccountType
  category: AccountCategory
  parentId: string | null
  normalBalance: NormalBalance
  description: string
  active: boolean
  systemAccount: boolean
  posting: AccountPostingControl
  tax: AccountTaxConfiguration
  manufacturing: ManufacturingAccountConfiguration
  dimensions: AccountDimensionConfiguration
}

export type AccountExportScope =
  | 'current_view'
  | 'all'
  | 'posting'
  | 'group'
  | 'hierarchy'
  | 'audit'

export type AccountExportFormat = 'excel' | 'csv' | 'pdf'

export const DEFAULT_ACCOUNT_FILTER: AccountFilter = {
  search: '',
  category: '',
  accountType: '',
  parentId: '',
  normalBalance: '',
  directPosting: '',
  controlAccount: '',
  activeStatus: '',
  gstRelevant: '',
  tdsRelevant: '',
  reconciliationRequired: '',
  costCentreRequired: '',
  hasBalance: '',
  createdBy: '',
  createdDateFrom: '',
  createdDateTo: '',
  treeGroupId: null,
  listTab: 'all',
}

export function defaultPostingControl(accountType: AccountType): AccountPostingControl {
  const isPosting = accountType === 'Posting'
  return {
    allowDirectPosting: isPosting,
    allowManualJournalPosting: isPosting,
    reconciliationRequired: false,
    isControlAccount: false,
    controlAccountType: null,
    allowOpeningBalance: isPosting,
    costCentreRequired: false,
    projectRequired: false,
    departmentRequired: false,
    blockNegativeBalance: false,
    currency: 'INR',
    postingDescriptionRequired: false,
  }
}

export function defaultTaxConfiguration(): AccountTaxConfiguration {
  return {
    gstRelevant: false,
    gstAccountType: 'Not Applicable',
    tdsRelevant: false,
    tdsAccountType: 'Not Applicable',
    tcsRelevant: false,
    reverseChargeApplicable: false,
    statutoryAccount: false,
    complianceNotes: '',
  }
}

export function defaultManufacturingConfiguration(): ManufacturingAccountConfiguration {
  return {
    manufacturingAccount: false,
    manufacturingAccountType: 'Not Applicable',
    inventoryValuationAccount: false,
    consumptionAccount: false,
    wipAccount: false,
    finishedGoodsAccount: false,
    cogsAccount: false,
    purchaseVarianceAccount: false,
    productionVarianceAccount: false,
    scrapAccount: false,
    overheadAccount: false,
    costElementType: null,
  }
}

export function defaultDimensionConfiguration(): AccountDimensionConfiguration {
  return {
    defaultCostCentreId: null,
    costCentreMandatory: false,
    defaultDepartmentId: null,
    departmentMandatory: false,
    defaultProjectId: null,
    projectMandatory: false,
    defaultPlantId: null,
    plantMandatory: false,
    defaultLocationId: null,
    locationMandatory: false,
  }
}
