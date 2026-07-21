/** Finance setup types — aligned with backend Prisma / accounting API shapes. */

export type LegalEntityType =
  | 'PRIVATE_LIMITED'
  | 'PUBLIC_LIMITED'
  | 'LLP'
  | 'PARTNERSHIP'
  | 'PROPRIETORSHIP'
  | 'TRUST'
  | 'OTHER'

export type BranchType =
  | 'HEAD_OFFICE'
  | 'FACTORY'
  | 'WAREHOUSE'
  | 'SALES_OFFICE'
  | 'SERVICE_CENTRE'
  | 'OTHER'

export type FinancialYearStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED'

export type AccountingPeriodStatus = 'OPEN' | 'UNDER_REVIEW' | 'CLOSED' | 'REOPENED'

export type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

export type AccountType =
  | 'GENERAL'
  | 'BANK'
  | 'CASH'
  | 'CUSTOMER_RECEIVABLE'
  | 'VENDOR_PAYABLE'
  | 'RAW_MATERIAL_INVENTORY'
  | 'WIP_INVENTORY'
  | 'FINISHED_GOODS_INVENTORY'
  | 'FIXED_ASSET'
  | 'ACCUMULATED_DEPRECIATION'
  | 'GST_INPUT'
  | 'GST_OUTPUT'
  | 'TDS_RECEIVABLE'
  | 'TDS_PAYABLE'
  | 'SALES'
  | 'SALES_RETURN'
  | 'PURCHASE'
  | 'PURCHASE_RETURN'
  | 'EXPENSE'
  | 'OTHER_INCOME'
  | 'PRODUCTION_VARIANCE'
  | 'RETAINED_EARNINGS'

export type NormalBalance = 'DEBIT' | 'CREDIT'

export type DefaultAccountMappingKey =
  | 'CUSTOMER_RECEIVABLE'
  | 'VENDOR_PAYABLE'
  | 'SALES_REVENUE'
  | 'SALES_RETURN'
  | 'PURCHASE'
  | 'PURCHASE_RETURN'
  | 'RAW_MATERIAL_INVENTORY'
  | 'WIP_INVENTORY'
  | 'FINISHED_GOODS_INVENTORY'
  | 'STOCK_ADJUSTMENT'
  | 'MATERIAL_CONSUMPTION'
  | 'PRODUCTION_VARIANCE'
  | 'SCRAP_INVENTORY'
  | 'SCRAP_LOSS'
  | 'SUBCONTRACTING_EXPENSE'
  | 'FREIGHT_INWARD'
  | 'FREIGHT_OUTWARD'
  | 'GST_INPUT_CGST'
  | 'GST_INPUT_SGST'
  | 'GST_INPUT_IGST'
  | 'GST_OUTPUT_CGST'
  | 'GST_OUTPUT_SGST'
  | 'GST_OUTPUT_IGST'
  | 'TDS_RECEIVABLE'
  | 'TDS_PAYABLE'
  | 'BANK_CHARGES'
  | 'ROUNDING'
  | 'DEPRECIATION_EXPENSE'
  | 'ACCUMULATED_DEPRECIATION'
  | 'ASSET_DISPOSAL_GAIN'
  | 'ASSET_DISPOSAL_LOSS'
  | 'RETAINED_EARNINGS'

export type FinanceDocumentType =
  | 'JOURNAL'
  | 'RECEIPT'
  | 'PAYMENT'
  | 'CONTRA'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'OPENING_BALANCE'
  | 'REVERSAL'

export type RoundingMethod = 'ROUND_HALF_UP' | 'ROUND_HALF_EVEN' | 'ROUND_DOWN' | 'ROUND_UP'

export type CoaTemplateId = 'MANUFACTURING' | 'TRADING' | 'SERVICE' | 'JOB_WORK'

export type FinanceFeatureKey =
  | 'RECEIVABLES'
  | 'PAYABLES'
  | 'BANK_RECONCILIATION'
  | 'GST'
  | 'TDS'
  | 'FIXED_ASSETS'
  | 'MANUFACTURING_ACCOUNTING'
  | 'BUDGETING'
  | 'MULTI_CURRENCY'
  | 'COST_CENTRES'
  | 'PROJECT_ACCOUNTING'
  | 'APPROVALS'

export interface LegalEntity {
  id: string
  tenantId?: string
  code: string
  legalName: string
  displayName: string
  entityType: LegalEntityType
  pan?: string | null
  cin?: string | null
  gstin?: string | null
  baseCurrency: string
  countryCode: string
  stateCode?: string | null
  registeredAddressJson?: Record<string, unknown> | null
  billingAddressJson?: Record<string, unknown> | null
  fiscalYearStartMonth: number
  isDefault: boolean
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Branch {
  id: string
  tenantId?: string
  legalEntityId: string
  code: string
  name: string
  branchType: BranchType
  gstin?: string | null
  stateCode?: string | null
  addressJson?: Record<string, unknown> | null
  phone?: string | null
  email?: string | null
  isHeadOffice: boolean
  isDefault: boolean
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface FinancialYear {
  id: string
  tenantId?: string
  legalEntityId: string
  name: string
  startDate: string
  endDate: string
  status: FinancialYearStatus
  isCurrent: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AccountingPeriod {
  id: string
  tenantId?: string
  legalEntityId: string
  financialYearId: string
  periodNumber: number
  name: string
  startDate: string
  endDate: string
  status: AccountingPeriodStatus
  closedAt?: string | null
  closedBy?: string | null
  reopenedAt?: string | null
  reopenedBy?: string | null
  reopenReason?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Account {
  id: string
  tenantId?: string
  legalEntityId: string
  accountCode: string
  accountName: string
  parentAccountId?: string | null
  category: AccountCategory
  accountType: AccountType
  level: number
  isGroup: boolean
  isControlAccount: boolean
  allowManualPosting: boolean
  normalBalance: NormalBalance
  currencyCode?: string | null
  requiresParty: boolean
  requiresReconciliation: boolean
  isActive: boolean
  description?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface AccountTreeNode extends Account {
  children: AccountTreeNode[]
}

export interface DefaultAccountMapping {
  id: string
  tenantId?: string
  legalEntityId: string
  mappingKey: DefaultAccountMappingKey
  accountId: string
  isMandatory: boolean
  description?: string | null
  account?: Pick<Account, 'id' | 'accountCode' | 'accountName'>
  createdAt?: string
  updatedAt?: string
}

export interface FinanceSettings {
  id?: string
  tenantId?: string
  legalEntityId: string
  baseCurrency: string
  dateFormat?: string
  amountPrecision?: number
  quantityPrecision?: number
  roundingMethod?: RoundingMethod
  roundingTolerance?: number
  allowBackdatedPosting?: boolean
  backdatedDaysLimit?: number
  requireAttachmentAbove?: number | null
  receiptApprovalLimit?: number | null
  paymentApprovalLimit?: number | null
  journalApprovalLimit?: number | null
  writeOffTolerance?: number | null
  bankChargeTolerance?: number | null
  allowManualControlAccountPosting?: boolean
  /** Phase 5B1 */
  treasuryTransferBankBalancePolicy?: 'ALLOW' | 'WARN' | 'BLOCK'
  treasuryTransferRequireInTransit?: boolean
  treasuryTransferInTransitThreshold?: number | null
  treasuryTransferApprovalLimit?: number | null
  treasuryTransferPreventSelfApprove?: boolean
  treasuryTransferPreventDispatcherReceive?: boolean
  /** Phase 5B2 */
  treasuryChequeApprovalLimit?: number | null
  treasuryChequePreventSelfApprove?: boolean
  treasuryChequeRequireCounterpartAccount?: boolean
  /** Phase 5B3 — prefer TreasuryAdjustment from statement lines (default true). */
  useTreasuryAdjustmentsForStatementItems?: boolean
  treasuryAdjustmentApprovalLimit?: number | null
  treasuryAdjustmentPreventSelfApprove?: boolean
  financeActivated: boolean
  activatedAt?: string | null
  activatedBy?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CostCentre {
  id: string
  tenantId?: string
  legalEntityId: string
  code: string
  name: string
  parentId?: string | null
  isGroup: boolean
  managerUserId?: string | null
  isActive: boolean
  description?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CostCentreTreeNode extends CostCentre {
  children: CostCentreTreeNode[]
}

export interface FinanceNumberSeries {
  id: string
  tenantId?: string
  legalEntityId: string
  documentType: FinanceDocumentType
  financialYearId?: string | null
  prefix: string
  currentValue: number
  padLength: number
  resetEachYear: boolean
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface FinanceApprovalRule {
  id: string
  tenantId?: string
  legalEntityId: string
  documentType: string
  ruleName: string
  amountFrom: number
  amountTo?: number | null
  conditionJson?: Record<string, unknown> | null
  approverRoleId?: string | null
  approverUserId?: string | null
  approvalLevel: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface SetupMissingItem {
  key: string
  label: string
  count: number
  route: string
}

export interface SetupStatus {
  ready: boolean
  missing: SetupMissingItem[]
  financeActivated: boolean
}

export interface DefaultMappingValidationResult {
  valid: boolean
  errors: Array<{ mappingKey: DefaultAccountMappingKey; message: string }>
  warnings: Array<{ mappingKey: DefaultAccountMappingKey; message: string }>
}

/** Mandatory mapping keys required before finance activation. */
export const MANDATORY_MAPPING_KEYS: DefaultAccountMappingKey[] = [
  'CUSTOMER_RECEIVABLE',
  'VENDOR_PAYABLE',
  'SALES_REVENUE',
  'PURCHASE',
  'GST_INPUT_CGST',
  'GST_INPUT_SGST',
  'GST_INPUT_IGST',
  'GST_OUTPUT_CGST',
  'GST_OUTPUT_SGST',
  'GST_OUTPUT_IGST',
  'RETAINED_EARNINGS',
]

export const REQUIRED_NUMBER_SERIES_TYPES: FinanceDocumentType[] = [
  'JOURNAL',
  'RECEIPT',
  'PAYMENT',
  'CONTRA',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'OPENING_BALANCE',
  'REVERSAL',
]

export const COA_TEMPLATE_LABELS: Record<CoaTemplateId, string> = {
  MANUFACTURING: 'Manufacturing Company',
  TRADING: 'Trading Company',
  SERVICE: 'Service Company',
  JOB_WORK: 'Manufacturing with Job Work',
}

export const FINANCE_DOCUMENT_TYPE_LABELS: Record<FinanceDocumentType, string> = {
  JOURNAL: 'Journal Voucher',
  RECEIPT: 'Receipt',
  PAYMENT: 'Payment',
  CONTRA: 'Contra',
  CREDIT_NOTE: 'Credit Note',
  DEBIT_NOTE: 'Debit Note',
  OPENING_BALANCE: 'Opening Balance',
  REVERSAL: 'Reversal',
}

export const DEFAULT_MAPPING_LABELS: Record<DefaultAccountMappingKey, string> = {
  CUSTOMER_RECEIVABLE: 'Customer Receivable',
  VENDOR_PAYABLE: 'Vendor Payable',
  SALES_REVENUE: 'Sales Revenue',
  SALES_RETURN: 'Sales Return',
  PURCHASE: 'Purchase',
  PURCHASE_RETURN: 'Purchase Return',
  RAW_MATERIAL_INVENTORY: 'Raw Material Inventory',
  WIP_INVENTORY: 'WIP Inventory',
  FINISHED_GOODS_INVENTORY: 'Finished Goods Inventory',
  STOCK_ADJUSTMENT: 'Stock Adjustment',
  MATERIAL_CONSUMPTION: 'Material Consumption',
  PRODUCTION_VARIANCE: 'Production Variance',
  SCRAP_INVENTORY: 'Scrap Inventory',
  SCRAP_LOSS: 'Scrap Loss',
  SUBCONTRACTING_EXPENSE: 'Subcontracting Expense',
  FREIGHT_INWARD: 'Freight Inward',
  FREIGHT_OUTWARD: 'Freight Outward',
  GST_INPUT_CGST: 'GST Input CGST',
  GST_INPUT_SGST: 'GST Input SGST',
  GST_INPUT_IGST: 'GST Input IGST',
  GST_OUTPUT_CGST: 'GST Output CGST',
  GST_OUTPUT_SGST: 'GST Output SGST',
  GST_OUTPUT_IGST: 'GST Output IGST',
  TDS_RECEIVABLE: 'TDS Receivable',
  TDS_PAYABLE: 'TDS Payable',
  BANK_CHARGES: 'Bank Charges',
  ROUNDING: 'Rounding',
  DEPRECIATION_EXPENSE: 'Depreciation Expense',
  ACCUMULATED_DEPRECIATION: 'Accumulated Depreciation',
  ASSET_DISPOSAL_GAIN: 'Asset Disposal Gain',
  ASSET_DISPOSAL_LOSS: 'Asset Disposal Loss',
  RETAINED_EARNINGS: 'Retained Earnings',
}
