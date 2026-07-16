/**
 * Manufacturing Accounting & Costing — frontend models (demo / UI only).
 * Indian discrete manufacturing (trailers / fabrication) context.
 * Does NOT post real GL, run production backend, or integrate with inventory engine.
 */

// ─── Enums / unions ───────────────────────────────────────────────────────────

export type CostingMethod = 'Standard' | 'Actual' | 'Weighted Average'

export type ProductionOrderStatus =
  | 'Planned'
  | 'Released'
  | 'In Progress'
  | 'Completed'
  | 'Closed'
  | 'Cancelled'

export type VarianceType =
  | 'Material Price'
  | 'Material Usage'
  | 'Labour Rate'
  | 'Labour Efficiency'
  | 'Machine'
  | 'Overhead'
  | 'Yield'
  | 'Scrap'
  | 'Subcontracting'

export type LedgerTxnType =
  | 'Material Issue'
  | 'Labour Booking'
  | 'Machine Booking'
  | 'Overhead'
  | 'FG Receipt'
  | 'Scrap'
  | 'Rework'
  | 'Subcontracting'
  | 'Variance'
  | 'Adjustment'

export type WIPStatus = 'Open' | 'Partially Absorbed' | 'Ready for FG' | 'Closed' | 'Written Off'

export type FGPostingStatus = 'Pending' | 'Posted' | 'Revalued' | 'Adjusted'

export type ScrapReworkType = 'Scrap' | 'Rework'

export type OverheadAllocationBasis = 'Machine Hours' | 'Labour Hours' | 'Material Value' | 'Units Produced'

export type ManufacturingAccountingWorkspaceTab =
  | 'overview'
  | 'material_consumption'
  | 'wip'
  | 'finished_goods'
  | 'production_costing'
  | 'variances'
  | 'subcontracting'
  | 'scrap_rework'
  | 'overhead'
  | 'cost_centres'
  | 'cost_sheet'
  | 'ledger'
  | 'reports'
  | 'setup'

// ─── Core row entities ────────────────────────────────────────────────────────

export interface MaterialConsumptionLine {
  id: string
  consumptionDate: string
  productionOrderId: string
  productionOrderNumber: string
  itemCode: string
  itemName: string
  materialCode: string
  materialName: string
  uom: string
  standardQty: number
  actualQty: number
  varianceQty: number
  standardRate: number
  actualRate: number
  standardValue: number
  actualValue: number
  varianceValue: number
  costCentre: string
  workCentre: string
  issueDocument: string
  issuedBy: string
}

export interface WorkInProgressRow {
  id: string
  productionOrderId: string
  productionOrderNumber: string
  finishedItemCode: string
  finishedItemName: string
  status: ProductionOrderStatus
  wipStatus: WIPStatus
  plannedQty: number
  completedQty: number
  materialIssued: number
  labourCost: number
  machineCost: number
  overheadCost: number
  subcontractingCost: number
  scrapReworkCost: number
  wipValue: number
  percentComplete: number
  costCentre: string
  startDate: string
  expectedCompletionDate: string
  lastUpdated: string
}

export interface FinishedGoodsValuationRow {
  id: string
  productionOrderId: string
  productionOrderNumber: string
  itemCode: string
  itemName: string
  receiptDate: string
  qty: number
  uom: string
  standardCostPerUnit: number
  actualCostPerUnit: number
  totalValue: number
  valuationMethod: CostingMethod
  postingStatus: FGPostingStatus
  costCentre: string
  warehouse: string
  grnNumber: string
}

export interface ProductionCostBreakup {
  rawMaterial: number
  components: number
  directLabour: number
  machineCost: number
  subcontracting: number
  factoryOverhead: number
  qualityCost: number
  scrapRecovery: number
  otherCost: number
  totalProductionCost: number
  costPerUnit: number
}

export interface ProductionCostingWorkbench {
  productionOrderId: string
  productionOrderNumber: string
  finishedItemCode: string
  finishedItemName: string
  status: ProductionOrderStatus
  plannedQty: number
  completedQty: number
  costingMethod: CostingMethod
  costCentre: string
  periodFrom: string
  periodTo: string
  costBreakup: ProductionCostBreakup
  standardCostPerUnit: number
  actualCostPerUnit: number
  varianceAmount: number
  variancePercent: number
  lastCostedAt: string
  costedBy: string
}

export interface ProductionVarianceRow {
  id: string
  varianceDate: string
  productionOrderId: string
  productionOrderNumber: string
  finishedItemCode: string
  finishedItemName: string
  varianceType: VarianceType
  standardAmount: number
  actualAmount: number
  varianceAmount: number
  isFavourable: boolean
  costCentre: string
  workCentre: string
  narration: string
  posted: boolean
}

export interface SubcontractingCostRow {
  id: string
  jobWorkDate: string
  productionOrderId: string
  productionOrderNumber: string
  vendorName: string
  serviceDescription: string
  challanNumber: string
  invoiceNumber: string | null
  qty: number
  uom: string
  rate: number
  amount: number
  gstAmount: number
  totalAmount: number
  costCentre: string
  status: 'Pending' | 'Received' | 'Invoiced' | 'Posted'
}

export interface ScrapReworkCostRow {
  id: string
  recordDate: string
  type: ScrapReworkType
  productionOrderId: string
  productionOrderNumber: string
  itemCode: string
  itemName: string
  qty: number
  uom: string
  costAmount: number
  recoveryAmount: number
  netCost: number
  reason: string
  costCentre: string
  workCentre: string
  disposition: string
}

export interface OverheadAllocationRow {
  id: string
  allocationDate: string
  period: string
  overheadPool: string
  allocationBasis: OverheadAllocationBasis
  basisQuantity: number
  ratePerUnit: number
  totalOverhead: number
  productionOrderId: string | null
  productionOrderNumber: string | null
  costCentre: string
  workCentre: string
  allocatedAmount: number
  status: 'Draft' | 'Allocated' | 'Posted'
}

export interface CostCentreRow {
  id: string
  code: string
  name: string
  department: string
  plant: string
  manager: string
  wipValue: number
  fgValue: number
  materialConsumption: number
  labourCost: number
  machineCost: number
  overheadCost: number
  totalCost: number
  budgetAmount: number
  varianceAmount: number
  activeOrders: number
  active: boolean
}

export interface ProductCostSheetBomLine {
  id: string
  materialCode: string
  materialName: string
  qty: number
  uom: string
  rate: number
  amount: number
}

export interface ProductCostSheetRoutingLine {
  id: string
  operation: string
  workCentre: string
  labourHours: number
  labourRate: number
  machineHours: number
  machineRate: number
  amount: number
}

export interface ProductCostSheet {
  id: string
  itemCode: string
  itemName: string
  revision: string
  effectiveFrom: string
  costingMethod: CostingMethod
  bomLines: ProductCostSheetBomLine[]
  routingLines: ProductCostSheetRoutingLine[]
  bomMaterialCost: number
  routingLabourCost: number
  routingMachineCost: number
  subcontractCost: number
  variableOverhead: number
  fixedOverhead: number
  packingCost: number
  totalStandardCost: number
  suggestedSellingPrice: number
  marginPercent: number
  lastUpdated: string
  updatedBy: string
  status: 'Draft' | 'Active' | 'Superseded'
}

export interface ProductionLedgerEntry {
  id: string
  postingDate: string
  productionOrderId: string
  productionOrderNumber: string
  itemCode: string
  itemName: string
  txnType: LedgerTxnType
  accountCode: string
  accountName: string
  debit: number
  credit: number
  costCentre: string
  workCentre: string
  sourceDocument: string
  narration: string
  createdBy: string
}

// ─── Dashboard / setup / reports ──────────────────────────────────────────────

export interface ManufacturingCostDashboard {
  asOfDate: string
  companyName: string
  financialYear: string
  wipValue: number
  fgInventoryValue: number
  materialConsumptionMtd: number
  productionVarianceMtd: number
  openProductionOrders: number
  completedProductionOrders: number
  averageCostPerTrailer: number
  costingMethod: CostingMethod
  costSummary: ProductionCostBreakup
  statusSummary: Array<{ status: ProductionOrderStatus; count: number; wipValue: number }>
  varianceByType: Array<{ type: VarianceType; amount: number; isFavourable: boolean }>
  costCentreSummary: Array<{ costCentre: string; totalCost: number; budget: number }>
  recentActivity: Array<{
    id: string
    type: string
    description: string
    date: string
    amount: number | null
    href: string
  }>
  alerts: Array<{ id: string; severity: 'info' | 'warning' | 'critical'; message: string; href?: string }>
  wipTrend: Array<{ month: string; wipValue: number; fgValue: number }>
  consumptionTrend: Array<{ month: string; material: number; labour: number; overhead: number }>
}

export interface ManufacturingCostingSetup {
  companyName: string
  defaultCurrency: string
  financialYearStartMonth: number
  valuationMethod: CostingMethod
  standardCostingEnabled: boolean
  labourRateSource: 'Routing Master' | 'Payroll Average' | 'Manual'
  machineHourRate: number
  overheadAllocationBasis: OverheadAllocationBasis
  wipAccount: string
  fgAccount: string
  materialConsumptionAccount: string
  directLabourAccount: string
  machineCostAccount: string
  factoryOverheadAccount: string
  scrapAccount: string
  varianceAccount: string
  purchaseVarianceAccount: string
  cogsAccount: string
  autoPostFGReceipt: boolean
  autoAllocateOverhead: boolean
  requireCostSheetApproval: boolean
  scrapRecoveryEnabled: boolean
}

export interface ManufacturingCostReportCard {
  id: string
  name: string
  description: string
  category: 'Costing' | 'WIP' | 'Variance' | 'Analysis'
  lastGeneratedAt: string | null
}

// ─── Filters / exports ────────────────────────────────────────────────────────

export interface ManufacturingAccountingFilter {
  search: string
  productionOrderId: string
  itemCode: string
  costCentre: string
  workCentre: string
  status: ProductionOrderStatus | ''
  wipStatus: WIPStatus | ''
  varianceType: VarianceType | ''
  costingMethod: CostingMethod | ''
  txnType: LedgerTxnType | ''
  dateFrom: string
  dateTo: string
  financialYear: string
  plant: string
  workspaceTab: ManufacturingAccountingWorkspaceTab
}

export interface ManufacturingCostExportRequest {
  reportName: string
  format: 'csv' | 'xlsx' | 'pdf'
  filter: Partial<ManufacturingAccountingFilter>
}

export interface ManufacturingCostPrintPreview {
  reportName: string
  generatedAt: string
  companyName: string
  filterSummary: string
  rows: Array<Record<string, string | number | null>>
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const COSTING_METHODS: CostingMethod[] = ['Standard', 'Actual', 'Weighted Average']

export const PRODUCTION_ORDER_STATUSES: ProductionOrderStatus[] = [
  'Planned',
  'Released',
  'In Progress',
  'Completed',
  'Closed',
  'Cancelled',
]

export const VARIANCE_TYPES: VarianceType[] = [
  'Material Price',
  'Material Usage',
  'Labour Rate',
  'Labour Efficiency',
  'Machine',
  'Overhead',
  'Yield',
  'Scrap',
  'Subcontracting',
]

export const LEDGER_TXN_TYPES: LedgerTxnType[] = [
  'Material Issue',
  'Labour Booking',
  'Machine Booking',
  'Overhead',
  'FG Receipt',
  'Scrap',
  'Rework',
  'Subcontracting',
  'Variance',
  'Adjustment',
]

export const MANUFACTURING_ACCOUNTING_WORKSPACE_TABS: Array<{
  id: ManufacturingAccountingWorkspaceTab
  label: string
  path: string
}> = [
  { id: 'overview', label: 'Overview', path: '/accounting/manufacturing' },
  { id: 'material_consumption', label: 'Material Consumption', path: '/accounting/manufacturing/material-consumption' },
  { id: 'wip', label: 'Work in Progress', path: '/accounting/manufacturing/wip' },
  { id: 'finished_goods', label: 'Finished Goods', path: '/accounting/manufacturing/finished-goods' },
  { id: 'production_costing', label: 'Production Costing', path: '/accounting/manufacturing/production-costing' },
  { id: 'variances', label: 'Variances', path: '/accounting/manufacturing/variances' },
  { id: 'subcontracting', label: 'Subcontracting', path: '/accounting/manufacturing/subcontracting' },
  { id: 'scrap_rework', label: 'Scrap & Rework', path: '/accounting/manufacturing/scrap-rework' },
  { id: 'overhead', label: 'Overhead Allocation', path: '/accounting/manufacturing/overhead' },
  { id: 'cost_centres', label: 'Cost Centres', path: '/accounting/manufacturing/cost-centres' },
  { id: 'cost_sheet', label: 'Product Cost Sheet', path: '/accounting/manufacturing/cost-sheet' },
  { id: 'ledger', label: 'Production Ledger', path: '/accounting/manufacturing/ledger' },
  { id: 'reports', label: 'Reports', path: '/accounting/manufacturing/reports' },
  { id: 'setup', label: 'Costing Setup', path: '/accounting/manufacturing/setup' },
]

export const DEFAULT_MANUFACTURING_ACCOUNTING_FILTER: ManufacturingAccountingFilter = {
  search: '',
  productionOrderId: '',
  itemCode: '',
  costCentre: '',
  workCentre: '',
  status: '',
  wipStatus: '',
  varianceType: '',
  costingMethod: '',
  txnType: '',
  dateFrom: '',
  dateTo: '',
  financialYear: 'FY 2025-26',
  plant: '',
  workspaceTab: 'overview',
}
