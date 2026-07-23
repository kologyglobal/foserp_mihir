/**
 * Fixed Assets Management — frontend models (demo / UI only).
 * Prepared for future Node.js / MySQL API mapping.
 * Does NOT post real GL, run depreciation engine posting, or integrate with finance backend.
 */

// ─── Enums / unions ───────────────────────────────────────────────────────────

export type AssetStatus =
  | 'Draft'
  | 'Under Construction'
  | 'Pending Capitalization'
  | 'Active'
  | 'Idle'
  | 'Under Maintenance'
  | 'Fully Depreciated'
  | 'Held for Disposal'
  | 'Disposed'
  | 'Written Off'
  | 'Sold'

export type DepreciationMethod = 'Straight Line' | 'WDV' | 'Units of Production' | 'Manual'

export type DisposalType = 'Sale' | 'Scrap' | 'Write-off' | 'Theft or Loss' | 'Exchange'

export type AcquisitionType =
  | 'Purchase'
  | 'Capital Work in Progress'
  | 'Transfer In'
  | 'Donation'
  | 'Lease Capitalization'
  | 'Self Constructed'

export type DepreciationRunStatus = 'Draft' | 'Preview' | 'Posted' | 'Reversed' | 'Cancelled'

export type CapitalizationStatus = 'Draft' | 'Pending Approval' | 'Capitalized' | 'Rejected'

export type TransferStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Completed' | 'Rejected' | 'Cancelled'

export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'

export type MaintenanceType = 'Preventive' | 'Breakdown' | 'Calibration' | 'AMC' | 'Inspection'

export type RevaluationStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Posted' | 'Rejected' | 'Cancelled'

export type ImpairmentStatus = 'Draft' | 'Pending Approval' | 'Recognized' | 'Rejected' | 'Cancelled'

export type DisposalStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Completed' | 'Cancelled'

export type VerificationStatus = 'Draft' | 'In Progress' | 'Completed' | 'Cancelled'

export type VerificationLineStatus = 'Pending' | 'Verified' | 'Not Found' | 'Damaged' | 'Excess'

export type FixedAssetsWorkspaceTab =
  | 'overview'
  | 'register'
  | 'categories'
  | 'acquisition'
  | 'capitalization'
  | 'depreciation'
  | 'transfers'
  | 'maintenance'
  | 'revaluation'
  | 'impairment'
  | 'disposal'
  | 'verification'
  | 'ledger'
  | 'reports'
  | 'setup'

export type AssetLedgerEntryType =
  | 'Acquisition'
  | 'Capitalization'
  | 'Depreciation'
  | 'Transfer'
  | 'Revaluation'
  | 'Impairment'
  | 'Disposal'
  | 'Adjustment'

// ─── Core entities ────────────────────────────────────────────────────────────

export interface FixedAssetCategory {
  id: string
  code: string
  name: string
  depreciationMethod: DepreciationMethod
  usefulLifeYears: number
  residualPercent: number
  glAssetAccount: string
  glAccumDepAccount: string
  glDepExpenseAccount: string
  active: boolean
}

export interface FixedAsset {
  id: string
  assetNumber: string
  name: string
  categoryId: string
  categoryName: string
  status: AssetStatus
  location: string
  plant: string
  department: string
  custodian: string
  acquisitionDate: string
  capitalizationDate: string | null
  acquisitionCost: number
  residualValue: number
  usefulLifeYears: number
  depreciationMethod: DepreciationMethod
  accumulatedDepreciation: number
  netBookValue: number
  salvageValue: number
  serialNumber: string | null
  manufacturer: string | null
  model: string | null
  vendorName: string | null
  poNumber: string | null
  invoiceNumber: string | null
  insurancePolicy: string | null
  insuranceExpiry: string | null
  lastVerificationDate: string | null
  nextVerificationDate: string | null
  warrantyExpiry: string | null
  isComponent: boolean
  parentAssetId: string | null
  currency: string
  company: string
  createdBy: string
  createdAt: string
  modifiedAt: string
  notes: string | null
}

export interface FixedAssetComponent {
  id: string
  parentAssetId: string
  parentAssetNumber: string
  parentAssetName: string
  assetId: string
  assetNumber: string
  name: string
  acquisitionCost: number
  netBookValue: number
  status: AssetStatus
  capitalizationDate: string | null
  notes: string | null
}

export interface AssetAcquisition {
  id: string
  acquisitionNumber: string
  acquisitionDate: string
  acquisitionType: AcquisitionType
  assetName: string
  categoryId: string
  categoryName: string
  vendorName: string | null
  poNumber: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  amount: number
  gstAmount: number
  totalAmount: number
  currency: string
  status: AssetStatus
  assetId: string | null
  location: string
  plant: string
  department: string
  notes: string | null
  createdBy: string
  createdAt: string
}

export interface AssetCapitalization {
  id: string
  capitalizationNumber: string
  assetId: string
  assetNumber: string
  assetName: string
  categoryName: string
  capitalizationDate: string
  totalCost: number
  cwIpAmount: number
  additionalCosts: number
  status: CapitalizationStatus
  approvedBy: string | null
  approvedAt: string | null
  glAssetAccount: string
  notes: string | null
  createdBy: string
  createdAt: string
}

export interface DepreciationLine {
  id: string
  runId: string
  assetId: string
  assetNumber: string
  assetName: string
  categoryName: string
  method: DepreciationMethod
  period: string
  openingWDV: number
  depreciationAmount: number
  closingWDV: number
  accumulatedDepreciation: number
  netBookValue: number
}

export interface DepreciationRun {
  id: string
  runNumber: string
  period: string
  periodFrom: string
  periodTo: string
  runDate: string
  status: DepreciationRunStatus
  methodSummary: string
  totalDepreciation: number
  assetCount: number
  postedBy: string | null
  postedAt: string | null
  lines: DepreciationLine[]
  createdBy: string
  createdAt: string
}

export interface AssetTransfer {
  id: string
  transferNumber: string
  transferDate: string
  assetId: string
  assetNumber: string
  assetName: string
  fromLocation: string
  fromPlant: string
  fromDepartment: string
  fromCustodian: string
  toLocation: string
  toPlant: string
  toDepartment: string
  toCustodian: string
  status: TransferStatus
  reason: string
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string
  createdAt: string
}

export interface AssetMaintenance {
  id: string
  maintenanceNumber: string
  assetId: string
  assetNumber: string
  assetName: string
  maintenanceType: MaintenanceType
  status: MaintenanceStatus
  scheduledDate: string
  completedDate: string | null
  vendorName: string | null
  cost: number
  downtimeHours: number | null
  description: string
  notes: string | null
  createdBy: string
  createdAt: string
}

export interface AssetRevaluation {
  id: string
  revaluationNumber: string
  assetId: string
  assetNumber: string
  assetName: string
  revaluationDate: string
  previousNBV: number
  revaluedAmount: number
  surplusAmount: number
  status: RevaluationStatus
  reason: string
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string
  createdAt: string
}

export interface AssetImpairment {
  id: string
  impairmentNumber: string
  assetId: string
  assetNumber: string
  assetName: string
  impairmentDate: string
  carryingAmount: number
  recoverableAmount: number
  impairmentLoss: number
  status: ImpairmentStatus
  reason: string
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string
  createdAt: string
}

export interface AssetDisposal {
  id: string
  disposalNumber: string
  assetId: string
  assetNumber: string
  assetName: string
  disposalType: DisposalType
  disposalDate: string
  proceeds: number
  nbv: number
  gainLoss: number
  status: DisposalStatus
  buyerName: string | null
  reason: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdBy: string
  createdAt: string
}

export interface PhysicalVerificationLine {
  id: string
  verificationId: string
  assetId: string
  assetNumber: string
  assetName: string
  expectedLocation: string
  foundLocation: string | null
  status: VerificationLineStatus
  condition: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  remarks: string | null
}

export interface PhysicalVerification {
  id: string
  verificationNumber: string
  verificationDate: string
  plant: string
  department: string | null
  status: VerificationStatus
  totalAssets: number
  verifiedCount: number
  notFoundCount: number
  damagedCount: number
  lines: PhysicalVerificationLine[]
  conductedBy: string
  completedAt: string | null
  createdAt: string
}

export interface AssetLedgerEntry {
  id: string
  assetId: string
  assetNumber: string
  entryDate: string
  entryType: AssetLedgerEntryType
  reference: string
  narration: string
  debitAmount: number
  creditAmount: number
  runningNBV: number
  createdBy: string
}

// ─── Dashboard / setup / audit ────────────────────────────────────────────────

export interface FixedAssetsDashboardData {
  asOfDate: string
  companyName: string
  totalAssetValue: number
  netBookValue: number
  accumulatedDepreciation: number
  assetsUnderConstruction: number
  depreciationDue: number
  pendingCapitalization: number
  dueForVerification: number
  pendingDisposal: number
  statusSummary: Array<{ status: AssetStatus; count: number; nbv: number }>
  categorySummary: Array<{ categoryId: string; categoryName: string; count: number; nbv: number }>
  recentActivity: Array<{
    id: string
    type: string
    description: string
    date: string
    amount: number | null
    href: string
  }>
  alerts: Array<{ id: string; severity: 'info' | 'warning' | 'critical'; message: string; href?: string }>
  depreciationTrend: Array<{ month: string; amount: number }>
  nbvByCategory: Array<{ category: string; nbv: number }>
}

export interface FixedAssetsSetup {
  companyName: string
  defaultCurrency: string
  financialYearStartMonth: number
  assetNumberPrefix: string
  autoDepreciationEnabled: boolean
  depreciationRunDay: number
  requireDualApprovalAbove: number
  physicalVerificationFrequencyMonths: number
  allowNegativeNBV: boolean
  defaultDepreciationMethod: DepreciationMethod
  capitalizeFromCWIP: boolean
  notifyOnVerificationDue: boolean
  notifyOnInsuranceExpiry: boolean
  approvalWorkflowEnabled: boolean
}

export interface FixedAssetsAuditEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  details: string
  performedBy: string
  performedAt: string
  isDemo: boolean
}

export interface FixedAssetsReportCard {
  id: string
  name: string
  description: string
  category: 'Register' | 'Depreciation' | 'Compliance' | 'Analysis'
  lastGeneratedAt: string | null
}

// ─── Filters / previews / exports ─────────────────────────────────────────────

export interface FixedAssetsFilter {
  search: string
  categoryId: string
  status: AssetStatus | ''
  plant: string
  department: string
  location: string
  custodian: string
  depreciationMethod: DepreciationMethod | ''
  dateFrom: string
  dateTo: string
  amountMin: number | null
  amountMax: number | null
  isComponent: 'all' | 'yes' | 'no'
  financialYear: string
  workspaceTab: FixedAssetsWorkspaceTab
}

export interface DepreciationPreview {
  period: string
  periodFrom: string
  periodTo: string
  assetCount: number
  totalDepreciation: number
  lines: DepreciationLine[]
  message: string
}

export interface DisposalGainLossPreview {
  assetId: string
  assetNumber: string
  assetName: string
  disposalType: DisposalType
  nbv: number
  proceeds: number
  gainLoss: number
  isGain: boolean
  isPartial?: boolean
  disposeCostAmount?: number | null
  remainingCost?: number | null
  remainingNbv?: number | null
}

export interface FixedAssetsExportRequest {
  reportName: string
  format: 'csv' | 'xlsx' | 'pdf'
  filter: Partial<FixedAssetsFilter>
  includeAudit: boolean
}

export interface FixedAssetsPrintPreview {
  reportName: string
  generatedAt: string
  companyName: string
  filterSummary: string
  rows: Array<Record<string, string | number | null>>
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const ASSET_STATUSES: AssetStatus[] = [
  'Draft',
  'Under Construction',
  'Pending Capitalization',
  'Active',
  'Idle',
  'Under Maintenance',
  'Fully Depreciated',
  'Held for Disposal',
  'Disposed',
  'Written Off',
  'Sold',
]

export const DEPRECIATION_METHODS: DepreciationMethod[] = [
  'Straight Line',
  'WDV',
  'Units of Production',
  'Manual',
]

export const DISPOSAL_TYPES: DisposalType[] = ['Sale', 'Scrap', 'Write-off', 'Theft or Loss', 'Exchange']

export const ACQUISITION_TYPES: AcquisitionType[] = [
  'Purchase',
  'Capital Work in Progress',
  'Transfer In',
  'Donation',
  'Lease Capitalization',
  'Self Constructed',
]

export const FIXED_ASSETS_WORKSPACE_TABS: Array<{ id: FixedAssetsWorkspaceTab; label: string; path: string }> = [
  { id: 'overview', label: 'Overview', path: '/accounting/fixed-assets' },
  { id: 'register', label: 'Asset Register', path: '/accounting/fixed-assets/register' },
  { id: 'categories', label: 'Categories', path: '/accounting/fixed-assets/categories' },
  { id: 'acquisition', label: 'Acquisition', path: '/accounting/fixed-assets/acquisition' },
  { id: 'capitalization', label: 'Capitalization', path: '/accounting/fixed-assets/capitalization' },
  { id: 'depreciation', label: 'Depreciation', path: '/accounting/fixed-assets/depreciation' },
  { id: 'transfers', label: 'Transfers', path: '/accounting/fixed-assets/transfers' },
  { id: 'maintenance', label: 'Maintenance', path: '/accounting/fixed-assets/maintenance' },
  { id: 'revaluation', label: 'Revaluation', path: '/accounting/fixed-assets/revaluation' },
  { id: 'impairment', label: 'Impairment', path: '/accounting/fixed-assets/impairment' },
  { id: 'disposal', label: 'Disposal', path: '/accounting/fixed-assets/disposal' },
  { id: 'verification', label: 'Physical Verification', path: '/accounting/fixed-assets/verification' },
  { id: 'ledger', label: 'Asset Ledger', path: '/accounting/fixed-assets/ledger' },
  { id: 'reports', label: 'Reports', path: '/accounting/fixed-assets/reports' },
  { id: 'setup', label: 'Fixed Assets Setup', path: '/accounting/fixed-assets/setup' },
]

export const DEFAULT_FIXED_ASSETS_FILTER: FixedAssetsFilter = {
  search: '',
  categoryId: '',
  status: '',
  plant: '',
  department: '',
  location: '',
  custodian: '',
  depreciationMethod: '',
  dateFrom: '',
  dateTo: '',
  amountMin: null,
  amountMax: null,
  isComponent: 'all',
  financialYear: 'FY 2025-26',
  workspaceTab: 'overview',
}
