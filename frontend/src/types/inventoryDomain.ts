/** Inventory & Warehouse module domain types (Phase 1 — demo frontend) */

export type InventoryItemType =
  | 'raw_material'
  | 'component'
  | 'semi_finished'
  | 'finished_good'
  | 'consumable'
  | 'packing_material'
  | 'spare'
  | 'trading_item'
  | 'scrap'

export type InventoryItemStatus = 'active' | 'inactive' | 'blocked'

export type CostingMethod = 'standard' | 'average' | 'fifo' | 'specific'

export type PreferredSource = 'purchase' | 'production' | 'subcontract' | 'transfer'

export type QualityStockStatus = 'available' | 'quality_hold' | 'blocked' | 'reserved'

export interface ItemCategory {
  id: string
  categoryCode: string
  categoryName: string
  isActive: boolean
}

export interface UnitOfMeasure {
  id: string
  uomCode: string
  uomName: string
  isActive: boolean
}

export interface Warehouse {
  id: string
  warehouseCode: string
  warehouseName: string
  plantCode: string
  isActive: boolean
}

export interface WarehouseLocation {
  id: string
  locationCode: string
  locationName: string
  warehouseId: string
  isActive: boolean
}

/** Inventory-enriched item record (extends master item fields) */
export interface InventoryItem {
  id: string
  itemCode: string
  itemName: string
  itemType: InventoryItemType
  categoryId: string
  categoryName: string
  baseUomId: string
  baseUomCode: string
  defaultWarehouseId: string | null
  defaultWarehouseName: string | null
  status: InventoryItemStatus
  /** General */
  isInventoryItem: boolean
  allowNegativeStock: boolean
  minimumStock: number
  maximumStock: number
  safetyStock: number
  reorderLevel: number
  reorderQuantity: number
  /** Cost and tax */
  hsnCode: string
  gstRate: number
  costingMethod: CostingMethod
  standardCost: number
  averageCost: number
  lastPurchaseCost: number
  /** Tracking and quality */
  batchTracking: boolean
  serialTracking: boolean
  expiryTracking: boolean
  shelfLifeDays: number | null
  qualityInspectionRequired: boolean
  automaticBatchSelection: boolean
  /** Planning */
  reorderPlanningEnabled: boolean
  leadTimeDays: number
  preferredSource: PreferredSource
  minimumOrderQuantity: number
  maximumOrderQuantity: number
  /** Computed stock snapshot (register) */
  availableQuantity: number
  /** Audit */
  createdAt: string
  updatedAt: string
  createdBy: string
  modifiedBy: string
}

export interface InventoryItemInput {
  itemCode: string
  itemName: string
  itemType: InventoryItemType
  categoryId: string
  baseUomId: string
  defaultWarehouseId: string | null
  status: InventoryItemStatus
  isInventoryItem: boolean
  allowNegativeStock: boolean
  minimumStock: number
  maximumStock: number
  safetyStock: number
  reorderLevel: number
  reorderQuantity: number
  hsnCode: string
  gstRate: number
  costingMethod: CostingMethod
  standardCost: number
  averageCost: number
  lastPurchaseCost: number
  batchTracking: boolean
  serialTracking: boolean
  expiryTracking: boolean
  shelfLifeDays: number | null
  qualityInspectionRequired: boolean
  automaticBatchSelection: boolean
  reorderPlanningEnabled: boolean
  leadTimeDays: number
  preferredSource: PreferredSource
  minimumOrderQuantity: number
  maximumOrderQuantity: number
}

export interface StockBalance {
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  onHand: number
  qualityHold: number
  blocked: number
  reserved: number
  available: number
  expectedReceipt: number
  plannedIssue: number
  stockValue: number
}

export interface StockAvailability {
  itemId: string
  itemCode: string
  itemName: string
  itemType: InventoryItemType
  categoryName: string
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  plantCode: string
  batchNo: string | null
  serialNo: string | null
  onHand: number
  qualityHold: number
  blocked: number
  reserved: number
  available: number
  expectedReceipt: number
  plannedIssue: number
  stockValue: number
  reorderLevel: number
  status: QualityStockStatus
}

export interface InventoryBatch {
  id: string
  itemId: string
  batchNo: string
  warehouseId: string
  qty: number
  expiryDate: string | null
  status: QualityStockStatus
}

export interface InventorySerial {
  id: string
  itemId: string
  serialNo: string
  warehouseId: string
  status: QualityStockStatus
}

export interface InventoryReservation {
  id: string
  itemId: string
  itemCode: string
  warehouseId: string
  warehouseName: string
  qty: number
  demandType: 'SO' | 'WO'
  referenceNo: string
  status: 'active' | 'fulfilled' | 'cancelled'
  createdAt: string
}

export interface InventoryFilter {
  search?: string
  itemType?: InventoryItemType | 'all'
  categoryId?: string
  baseUomId?: string
  defaultWarehouseId?: string
  batchTracking?: boolean
  serialTracking?: boolean
  inspectionRequired?: boolean
  reorderEnabled?: boolean
  status?: InventoryItemStatus | 'all'
  tab?: string
}

export interface StockAvailabilityFilter {
  search?: string
  itemId?: string
  categoryId?: string
  itemType?: InventoryItemType | 'all'
  warehouseId?: string
  plantCode?: string
  batchNo?: string
  serialNo?: string
  lowStock?: boolean
  outOfStock?: boolean
  expiring?: boolean
  negativeStock?: boolean
  reorderRequired?: boolean
}

export interface InventoryAuditEntry {
  id: string
  itemId: string
  action: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  userId: string
  userName: string
  timestamp: string
}

export interface InventoryDashboardKpi {
  id: string
  label: string
  value: number | string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  href: string
}

export interface InventoryDashboardData {
  kpis: InventoryDashboardKpi[]
  pendingActions: Array<{ id: string; label: string; count: number; href: string }>
  lowStockItems: Array<{ itemId: string; itemCode: string; itemName: string; onHand: number; reorderLevel: number; href: string }>
  outOfStockItems: Array<{ itemId: string; itemCode: string; itemName: string; href: string }>
  qualityHoldItems: Array<{ itemId: string; itemCode: string; itemName: string; qty: number; href: string }>
  recentMovements: Array<{ id: string; movementNo: string; itemCode: string; type: string; qty: number; date: string; href: string }>
  warehouseStock: Array<{ warehouseId: string; warehouseName: string; skuCount: number; value: number; href: string }>
  categoryValue: Array<{ categoryName: string; value: number; href: string }>
}

export interface StockDetailsData {
  itemId: string
  itemCode: string
  itemName: string
  summary: StockBalance
  warehouses: StockBalance[]
  batches: InventoryBatch[]
  serials: InventorySerial[]
  reservations: InventoryReservation[]
  recentMovements: Array<{ movementNo: string; type: string; qty: number; date: string; warehouseName: string }>
  valuation: { standardCost: number; averageCost: number; stockValue: number; lastPurchaseCost: number }
  planning: { reorderLevel: number; reorderQuantity: number; leadTimeDays: number; suggestedOrderQty: number }
}

/* -------------------------------------------------------------------------- */
/* Phase 2 — Inventory movements (receipts & issues)                          */
/* -------------------------------------------------------------------------- */

export type ReceiptSourceType =
  | 'purchase_order'
  | 'production_output'
  | 'transfer_receipt'
  | 'customer_return'
  | 'job_work_receipt'
  | 'direct_receipt'

export type IssueSourceType =
  | 'production_order'
  | 'sales_order'
  | 'maintenance'
  | 'subcontract_issue'
  | 'transfer_issue'
  | 'direct_issue'

export type ReceiptDocumentStatus =
  | 'draft'
  | 'pending_receipt'
  | 'quality_hold'
  | 'partially_received'
  | 'posted'
  | 'rejected'
  | 'cancelled'

export type IssueDocumentStatus =
  | 'draft'
  | 'pending_issue'
  | 'partially_issued'
  | 'posted'
  | 'reversed'
  | 'cancelled'

export type BatchSelectionMethod = 'fifo' | 'fefo' | 'manual'

export type QualityDisposition = 'available' | 'quality_hold' | 'quarantine' | 'rejected' | 'blocked'

export interface MovementDocumentHeader {
  id: string
  documentNumber: string
  movementType: 'receipt' | 'issue'
  documentDate: string
  postingDate: string
  sourceType: ReceiptSourceType | IssueSourceType
  sourceDocumentId: string | null
  sourceDocumentNo: string | null
  warehouseId: string
  warehouseName: string
  plantCode: string
  status: ReceiptDocumentStatus | IssueDocumentStatus
  createdBy: string
  approvedBy: string | null
  postedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface MovementLine {
  id: string
  lineNo: number
  itemId: string
  itemCode: string
  itemName: string
  uomCode: string
  pendingQty: number
  receivedQty: number
  acceptedQty: number
  rejectedQty: number
  quarantineQty: number
  issuedQty: number
  availableQty: number
  batchNo: string | null
  serialNo: string | null
  expiryDate: string | null
  rate: number
  warehouseId: string
  locationId: string | null
  qualityStatus: QualityDisposition
  batchTracking: boolean
  serialTracking: boolean
  expiryTracking: boolean
  remarks: string
}

export interface MovementCostPreview {
  lines: Array<{ itemCode: string; qty: number; rate: number; amount: number }>
  subtotal: number
  gstAmount: number
  total: number
}

export interface MovementAccountingPreview {
  debitAccount: string
  creditAccount: string
  amount: number
  narration: string
}

export interface MovementAttachment {
  id: string
  fileName: string
  uploadedAt: string
  uploadedBy: string
}

export interface MovementAuditEntry {
  id: string
  action: string
  userName: string
  timestamp: string
  remarks: string | null
}

export interface InventoryReceipt extends MovementDocumentHeader {
  movementType: 'receipt'
  status: ReceiptDocumentStatus
  sourceType: ReceiptSourceType
  vendorName: string | null
  gateEntryNo: string | null
  vehicleNo: string | null
  lrNo: string | null
  lines: MovementLine[]
  mode: 'quick' | 'detailed'
  costPreview: MovementCostPreview | null
  accountingPreview: MovementAccountingPreview | null
  attachments: MovementAttachment[]
  auditHistory: MovementAuditEntry[]
}

export interface InventoryIssue extends MovementDocumentHeader {
  movementType: 'issue'
  status: IssueDocumentStatus
  sourceType: IssueSourceType
  department: string | null
  costCentre: string | null
  batchMethod: BatchSelectionMethod
  lines: MovementLine[]
  mode: 'quick' | 'detailed'
  costPreview: MovementCostPreview | null
  accountingPreview: MovementAccountingPreview | null
  attachments: MovementAttachment[]
  auditHistory: MovementAuditEntry[]
}

export interface InventoryReceiptListRow {
  id: string
  documentNumber: string
  documentDate: string
  sourceType: ReceiptSourceType
  sourceDocumentNo: string | null
  warehouseName: string
  status: ReceiptDocumentStatus
  lineCount: number
  totalReceivedQty: number
  vendorName: string | null
  createdBy: string
}

export interface InventoryIssueListRow {
  id: string
  documentNumber: string
  documentDate: string
  sourceType: IssueSourceType
  sourceDocumentNo: string | null
  warehouseName: string
  status: IssueDocumentStatus
  lineCount: number
  totalIssuedQty: number
  department: string | null
  createdBy: string
}

export interface MovementSourceDocument {
  id: string
  documentNo: string
  documentDate: string
  sourceType: ReceiptSourceType | IssueSourceType
  partyName: string | null
  warehouseId: string
  warehouseName: string
  pendingLineCount: number
  pendingQty: number
  isOpen: boolean
}

export interface MovementSourceDetails {
  sourceDocumentId: string
  sourceDocumentNo: string
  sourceType: ReceiptSourceType | IssueSourceType
  warehouseId: string
  warehouseName: string
  plantCode: string
  partyName: string | null
  lines: MovementLine[]
}

export interface BatchSelectionPreviewLine {
  itemId: string
  itemCode: string
  batchNo: string
  expiryDate: string | null
  availableQty: number
  selectedQty: number
}

export interface ReceiptDraftInput {
  sourceType: ReceiptSourceType
  sourceDocumentId: string | null
  warehouseId: string
  documentDate: string
  postingDate: string
  lines: Array<Partial<MovementLine> & Pick<MovementLine, 'itemId' | 'receivedQty'>>
  mode?: 'quick' | 'detailed'
}

export interface IssueDraftInput {
  sourceType: IssueSourceType
  sourceDocumentId: string | null
  warehouseId: string
  documentDate: string
  postingDate: string
  batchMethod?: BatchSelectionMethod
  lines: Array<Partial<MovementLine> & Pick<MovementLine, 'itemId' | 'issuedQty'>>
  mode?: 'quick' | 'detailed'
}

/* -------------------------------------------------------------------------- */
/* Phase 3 — Transfers, adjustments & returns                               */
/* -------------------------------------------------------------------------- */

export type TransferType =
  | 'warehouse_to_warehouse'
  | 'plant_to_plant'
  | 'bin_to_bin'
  | 'quality_to_available'
  | 'available_to_quarantine'
  | 'production_to_warehouse'
  | 'warehouse_to_production'

export type TransferStatus =
  | 'draft'
  | 'dispatched'
  | 'in_transit'
  | 'partially_received'
  | 'received'
  | 'cancelled'

export type AdjustmentType =
  | 'found_stock'
  | 'shortage'
  | 'damage'
  | 'scrap'
  | 'expiry'
  | 'wrong_batch'
  | 'wrong_warehouse'
  | 'opening_stock'
  | 'quality_reclassification'
  | 'cost_adjustment'
  | 'other'

export type AdjustmentStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'posted'
  | 'rejected'
  | 'cancelled'

export type InventoryReturnType =
  | 'purchase_return'
  | 'sales_return'
  | 'production_material_return'
  | 'transfer_return'
  | 'job_work_return'

export type InventoryReturnStatus = 'draft' | 'posted' | 'cancelled'

export type SalesReturnCondition = 'accept' | 'repair' | 'reject' | 'scrap'

export interface TransferLine {
  id: string
  lineNo: number
  itemId: string
  itemCode: string
  itemName: string
  uomCode: string
  fromWarehouseId: string
  toWarehouseId: string
  fromLocationId: string | null
  toLocationId: string | null
  transferQty: number
  dispatchedQty: number
  receivedQty: number
  shortQty: number
  damagedQty: number
  shortReason: string | null
  availableQty: number
  batchNo: string | null
  serialNo: string | null
  rate: number
  batchTracking: boolean
  serialTracking: boolean
  remarks: string
}

export interface InventoryTransfer {
  id: string
  documentNumber: string
  transferDate: string
  transferType: TransferType
  fromWarehouseId: string
  fromWarehouseName: string
  toWarehouseId: string
  toWarehouseName: string
  fromPlantCode: string
  toPlantCode: string
  status: TransferStatus
  expectedReceiptDate: string | null
  vehicleNo: string | null
  transporter: string | null
  reference: string | null
  remarks: string | null
  itemCount: number
  transferQty: number
  dispatchedQty: number
  receivedQty: number
  approvalRequired: boolean
  lines: TransferLine[]
  mode: 'quick' | 'detailed'
  costPreview: MovementCostPreview | null
  accountingPreview: MovementAccountingPreview | null
  auditHistory: MovementAuditEntry[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface InventoryTransferListRow {
  id: string
  documentNumber: string
  transferDate: string
  transferType: TransferType
  fromWarehouseName: string
  toWarehouseName: string
  itemCount: number
  transferQty: number
  dispatchedQty: number
  receivedQty: number
  expectedReceiptDate: string | null
  status: TransferStatus
}

export interface TransferDraftInput {
  transferType: TransferType
  fromWarehouseId: string
  toWarehouseId: string
  transferDate: string
  expectedReceiptDate?: string | null
  vehicleNo?: string | null
  transporter?: string | null
  reference?: string | null
  remarks?: string | null
  lines: Array<Partial<TransferLine> & Pick<TransferLine, 'itemId' | 'transferQty'>>
  mode?: 'quick' | 'detailed'
}

export interface AdjustmentLine {
  id: string
  lineNo: number
  itemId: string
  itemCode: string
  itemName: string
  uomCode: string
  warehouseId: string
  currentQty: number
  adjustmentQty: number
  newQty: number
  unitCost: number
  adjustmentValue: number
  batchNo: string | null
  serialNo: string | null
  batchTracking: boolean
  serialTracking: boolean
  remarks: string
}

export interface InventoryAdjustment {
  id: string
  documentNumber: string
  adjustmentDate: string
  adjustmentType: AdjustmentType
  warehouseId: string
  warehouseName: string
  plantCode: string
  reason: string
  status: AdjustmentStatus
  approvalStatus: 'not_required' | 'pending' | 'approved' | 'rejected'
  postingStatus: 'not_posted' | 'posted'
  itemCount: number
  quantityDifference: number
  adjustmentValue: number
  approvalRequired: boolean
  approvalThreshold: number
  lines: AdjustmentLine[]
  costPreview: MovementCostPreview | null
  accountingPreview: MovementAccountingPreview | null
  auditHistory: MovementAuditEntry[]
  createdBy: string
  approvedBy: string | null
  postedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface InventoryAdjustmentListRow {
  id: string
  documentNumber: string
  adjustmentDate: string
  adjustmentType: AdjustmentType
  warehouseName: string
  itemCount: number
  quantityDifference: number
  adjustmentValue: number
  reason: string
  approvalStatus: InventoryAdjustment['approvalStatus']
  postingStatus: InventoryAdjustment['postingStatus']
  status: AdjustmentStatus
}

export interface AdjustmentDraftInput {
  adjustmentType: AdjustmentType
  warehouseId: string
  adjustmentDate: string
  reason: string
  lines: Array<Partial<AdjustmentLine> & Pick<AdjustmentLine, 'itemId' | 'adjustmentQty'>>
}

export interface ReturnLine {
  id: string
  lineNo: number
  itemId: string
  itemCode: string
  itemName: string
  uomCode: string
  warehouseId: string
  eligibleQty: number
  returnQty: number
  unitCost: number
  returnValue: number
  batchNo: string | null
  serialNo: string | null
  batchTracking: boolean
  serialTracking: boolean
  reason: string | null
  condition: SalesReturnCondition | null
  remarks: string
}

export interface InventoryReturn {
  id: string
  documentNumber: string
  returnDate: string
  returnType: InventoryReturnType
  sourceDocumentId: string
  sourceDocumentNo: string
  partyOrDepartment: string | null
  warehouseId: string
  warehouseName: string
  status: InventoryReturnStatus
  itemCount: number
  returnQty: number
  returnValue: number
  lines: ReturnLine[]
  auditHistory: MovementAuditEntry[]
  createdBy: string
  postedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface InventoryReturnListRow {
  id: string
  documentNumber: string
  returnDate: string
  returnType: InventoryReturnType
  sourceDocumentNo: string
  partyOrDepartment: string | null
  warehouseName: string
  itemCount: number
  returnQty: number
  returnValue: number
  status: InventoryReturnStatus
}

export interface ReturnSourceDocument {
  id: string
  documentNo: string
  documentDate: string
  returnType: InventoryReturnType
  partyOrDepartment: string | null
  warehouseId: string
  warehouseName: string
  eligibleLineCount: number
  eligibleQty: number
  isEligible: boolean
}

export interface ReturnSourceDetails {
  sourceDocumentId: string
  sourceDocumentNo: string
  returnType: InventoryReturnType
  partyOrDepartment: string | null
  warehouseId: string
  warehouseName: string
  lines: ReturnLine[]
}

export interface ReturnDraftInput {
  returnType: InventoryReturnType
  sourceDocumentId: string
  returnDate: string
  lines: Array<Partial<ReturnLine> & Pick<ReturnLine, 'itemId' | 'returnQty'>>
}

/* -------------------------------------------------------------------------- */
/* Phase 6 — Planning, Reports, Setup, Saved Views                          */
/* -------------------------------------------------------------------------- */

export type PlanningSuggestedSource = 'purchase' | 'production' | 'transfer' | 'no_action'

export type PlanningSuggestionStatus = 'active' | 'ignored' | 'draft_created'

export interface InventoryPlanningRow {
  id: string
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string
  warehouseName: string
  availableStock: number
  minimumStock: number
  safetyStock: number
  maximumStock: number
  reservedDemand: number
  openPurchaseOrders: number
  openProductionOrders: number
  plannedConsumption: number
  expectedReceipts: number
  projectedStock: number
  suggestedQuantity: number
  suggestedSource: PlanningSuggestedSource
  requiredDate: string
  status: PlanningSuggestionStatus
}

export interface InventoryPlanningFilter {
  search?: string
  warehouseId?: string
  categoryId?: string
  itemType?: InventoryItemType | 'all'
  suggestedSource?: PlanningSuggestedSource | 'all'
  includeIgnored?: boolean
}

export type InventoryReportId =
  | 'stock-summary'
  | 'warehouse-wise-stock'
  | 'item-ledger'
  | 'inventory-valuation'
  | 'receipt-register'
  | 'issue-register'
  | 'transfer-register'
  | 'adjustment-register'
  | 'return-register'
  | 'batch-register'
  | 'serial-register'
  | 'quality-hold-stock'
  | 'blocked-stock'
  | 'low-stock'
  | 'out-of-stock'
  | 'negative-stock'
  | 'stock-ageing'
  | 'slow-moving'
  | 'non-moving'
  | 'expiry'
  | 'physical-count-variance'
  | 'reorder-planning'

export interface InventoryReportCatalogEntry {
  id: InventoryReportId
  title: string
  description: string
  categoryId: string
  categoryLabel: string
  /** Link to existing operational report route when applicable */
  externalPath?: string
  requiresCost?: boolean
}

export interface InventoryReportCategoryGroup {
  id: string
  label: string
  description: string
  reports: InventoryReportCatalogEntry[]
}

export interface InventoryReportFilters {
  dateFrom: string
  dateTo: string
  itemId: string
  categoryId: string
  itemType: string
  warehouseId: string
  plantCode: string
  batchNo: string
  status: string
  movementType: string
  sourceModule: string
  search: string
}

export type InventoryReportColumnFormat = 'text' | 'number' | 'currency' | 'date'

export interface InventoryReportColumn {
  key: string
  label: string
  format?: InventoryReportColumnFormat
  align?: 'left' | 'right'
}

export interface InventoryReportRow {
  [key: string]: string | number | null | undefined
}

export interface InventoryReportResult {
  reportId: InventoryReportId
  title: string
  description: string
  generatedAt: string
  columns: InventoryReportColumn[]
  rows: InventoryReportRow[]
  summary?: Array<{ label: string; value: string | number }>
  hideCost: boolean
}

export type InventorySetupTabId =
  | 'general'
  | 'warehouses'
  | 'item_categories'
  | 'uom'
  | 'number_series'
  | 'tracking'
  | 'quality'
  | 'planning'
  | 'approvals'
  | 'permissions'
  | 'advanced_warehouse'

export type InventoryBatchSelectionMethod = 'fifo' | 'fefo' | 'manual'
export type InventoryCostingMethodDefault = CostingMethod
export type InventorySuggestedQtyMethod = 'max_minus_projected' | 'reorder_qty' | 'safety_plus_lead'

export interface InventorySetupGeneral {
  defaultWarehouseId: string | null
  defaultReceiptLocationId: string | null
  defaultIssueLocationId: string | null
  defaultCostingMethod: InventoryCostingMethodDefault
  allowNegativeStock: boolean
  requirePostingDate: boolean
  requireSourceDocument: boolean
  quickModeDefault: boolean
  detailedModeEnabled: boolean
  inventoryValueVisible: boolean
}

export interface InventorySetupTracking {
  batchTrackingEnabled: boolean
  serialTrackingEnabled: boolean
  expiryTrackingEnabled: boolean
  automaticBatchSelection: boolean
  batchSelectionMethod: InventoryBatchSelectionMethod
  expiryWarningDays: number
  serialUniquenessRequired: boolean
}

export interface InventorySetupQuality {
  qualityInspectionEnabled: boolean
  qualityHoldLocationId: string | null
  quarantineLocationId: string | null
  rejectedLocationId: string | null
  deviationApprovalRequired: boolean
}

export interface InventorySetupPlanning {
  reorderPlanningEnabled: boolean
  defaultSafetyStock: number
  defaultLeadTimeDays: number
  suggestedQuantityMethod: InventorySuggestedQtyMethod
  createDraftRequirementOnly: boolean
}

export interface InventorySetupApprovals {
  adjustmentApprovalLimit: number
  negativeStockOverrideApproval: boolean
  highValueTransferApproval: number
  stockCountVarianceLimit: number
  qualityDeviationApproval: boolean
}

export interface InventorySetupAdvancedWarehouse {
  binManagement: boolean
  barcodeScanning: boolean
  putAway: boolean
  pickList: boolean
  packing: boolean
  wavePicking: boolean
  mobileWarehouse: boolean
  consignmentInventory: boolean
}

export interface InventoryNumberSeriesConfig {
  prefix: string
  nextNumber: number
  padding: number
}

export interface InventorySetupNumberSeries {
  receipt: InventoryNumberSeriesConfig
  issue: InventoryNumberSeriesConfig
  transfer: InventoryNumberSeriesConfig
  adjustment: InventoryNumberSeriesConfig
  stockCount: InventoryNumberSeriesConfig
}

export interface InventorySetup {
  general: InventorySetupGeneral
  tracking: InventorySetupTracking
  quality: InventorySetupQuality
  planning: InventorySetupPlanning
  approvals: InventorySetupApprovals
  advancedWarehouse: InventorySetupAdvancedWarehouse
  numberSeries: InventorySetupNumberSeries
}

export type InventoryWarehouseType = 'raw' | 'wip' | 'finished' | 'consumable' | 'transit' | 'general'

export interface InventoryWarehouseRecord {
  id: string
  warehouseCode: string
  warehouseName: string
  warehouseType: InventoryWarehouseType
  plantCode: string
  location: string
  warehouseManager: string
  defaultReceiptLocationId: string | null
  defaultIssueLocationId: string | null
  qualityHoldLocationId: string | null
  quarantineLocationId: string | null
  rejectedLocationId: string | null
  scrapLocationId: string | null
  transitLocationId: string | null
  binManagementEnabled: boolean
  isActive: boolean
}

export interface InventoryWarehouseInput {
  warehouseCode: string
  warehouseName: string
  warehouseType: InventoryWarehouseType
  plantCode: string
  location: string
  warehouseManager: string
  defaultReceiptLocationId: string | null
  defaultIssueLocationId: string | null
  qualityHoldLocationId: string | null
  quarantineLocationId: string | null
  rejectedLocationId: string | null
  scrapLocationId: string | null
  transitLocationId: string | null
  binManagementEnabled: boolean
  isActive: boolean
}

export interface InventorySavedView {
  id: string
  name: string
  workspace: string
  filters: Record<string, string>
  columns: string[]
  sortOrder: string
  isSystem: boolean
  createdAt: string
}

export interface InventoryExportOptions {
  format: 'csv' | 'xlsx' | 'pdf'
  reportId: InventoryReportId
  filters: InventoryReportFilters
}

export interface InventoryPrintPreview {
  title: string
  html: string
  generatedAt: string
}

/* -------------------------------------------------------------------------- */
/* Phase 4 — Batch / serial / reservations / ledger / traceability            */
/* -------------------------------------------------------------------------- */

export type BatchQualityStatus =
  | 'available'
  | 'quality_hold'
  | 'quarantine'
  | 'blocked'
  | 'expired'
  | 'rejected'
  | 'consumed'
  | 'closed'

export type InventorySerialStatus =
  | 'available'
  | 'reserved'
  | 'issued'
  | 'in_production'
  | 'sold'
  | 'under_repair'
  | 'returned'
  | 'scrapped'

export type ReservationStatus =
  | 'reserved'
  | 'partially_reserved'
  | 'released'
  | 'consumed'
  | 'cancelled'

export type ReservationSource = 'SO' | 'PO' | 'TRANSFER' | 'MAINTENANCE' | 'PROJECT'

export interface InventoryBatchRecord {
  id: string
  batchNo: string
  supplierBatchNo: string | null
  itemId: string
  itemCode: string
  itemName: string
  manufacturingDate: string | null
  expiryDate: string | null
  receiptDate: string
  warehouseId: string
  warehouseName: string
  availableQty: number
  reservedQty: number
  qualityStatus: BatchQualityStatus
  sourceDocumentType: string
  sourceDocumentNo: string
}

export interface InventorySerialRecord {
  id: string
  serialNo: string
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string
  warehouseName: string
  status: InventorySerialStatus
  sourceDocumentType: string | null
  sourceDocumentNo: string | null
  receiptDate: string | null
}

export interface InventoryReservationRecord {
  id: string
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string
  warehouseName: string
  batchId: string | null
  batchNo: string | null
  qty: number
  reservedQty: number
  source: ReservationSource
  referenceNo: string
  priority: number
  status: ReservationStatus
  reservationMode: 'auto' | 'manual'
  createdAt: string
  createdBy: string
}

export type ItemLedgerTransactionType =
  | 'opening_balance'
  | 'receipt'
  | 'issue'
  | 'transfer_in'
  | 'transfer_out'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'return_in'
  | 'return_out'
  | 'production_consume'
  | 'production_output'
  | 'reservation'
  | 'reservation_release'

export interface ItemLedgerEntry {
  id: string
  itemId: string
  transactionDate: string
  transactionType: ItemLedgerTransactionType
  documentNo: string
  documentType: string
  documentHref: string | null
  warehouseId: string
  warehouseName: string
  batchNo: string | null
  serialNo: string | null
  qtyIn: number
  qtyOut: number
  balance: number
  unitCost: number
  value: number
  userId: string
  userName: string
  remarks: string
}

export interface ItemLedgerFilter {
  warehouseId?: string
  batchNo?: string
  serialNo?: string
  transactionType?: ItemLedgerTransactionType | 'all'
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface BatchFilter {
  itemId?: string
  warehouseId?: string
  search?: string
  qualityStatus?: BatchQualityStatus | 'all'
  expiringWithinDays?: number
}

export interface SerialFilter {
  itemId?: string
  warehouseId?: string
  search?: string
  status?: InventorySerialStatus | 'all'
  sourceDocumentNo?: string
}

export interface ReservationFilter {
  itemId?: string
  warehouseId?: string
  source?: ReservationSource | 'all'
  status?: ReservationStatus | 'all'
  referenceNo?: string
}

export interface TraceabilityEvent {
  id: string
  eventDate: string
  eventType: string
  eventLabel: string
  documentNo: string
  documentHref: string | null
  warehouseName: string | null
  qty: number | null
  userName: string
  status: string | null
}

export interface InventoryTraceabilityResult {
  entityType: 'item' | 'batch' | 'serial'
  entityId: string
  entityLabel: string
  events: TraceabilityEvent[]
}

export interface CreateReservationInput {
  itemId: string
  warehouseId: string
  batchId?: string | null
  qty: number
  source: ReservationSource
  referenceNo: string
  priority?: number
  reservationMode?: 'auto' | 'manual'
}

export interface ChangeReservationInput {
  warehouseId?: string
  batchId?: string | null
  qty?: number
  priority?: number
}

/* -------------------------------------------------------------------------- */
/* Phase 5 — Stock count & physical verification                              */
/* -------------------------------------------------------------------------- */

export type StockCountType =
  | 'full_physical'
  | 'warehouse'
  | 'category'
  | 'item'
  | 'bin'
  | 'batch'
  | 'cycle'

export type StockCountStatus =
  | 'draft'
  | 'counting'
  | 'recount_required'
  | 'under_review'
  | 'approved'
  | 'posted'
  | 'cancelled'

export type StockCountLineStatus =
  | 'pending'
  | 'counted'
  | 'variance'
  | 'recount_required'
  | 'accepted'
  | 'rejected'

export interface StockCountScope {
  countType: StockCountType
  warehouseId: string
  warehouseName: string
  categoryId: string | null
  categoryName: string | null
  itemId: string | null
  itemCode: string | null
  binLocationId: string | null
  binCode: string | null
  batchNo: string | null
  countDate: string
  assignedTeam: string[]
  blindCount: boolean
}

export interface StockCountLine {
  id: string
  lineNo: number
  itemId: string
  itemCode: string
  itemName: string
  batchNo: string | null
  binCode: string | null
  snapshotSystemQty: number
  systemQty: number
  countedQty: number | null
  recountQty: number | null
  variance: number
  unitCost: number
  differenceValue: number
  reason: string
  lineStatus: StockCountLineStatus
  previousCountQty: number | null
  previousCountDate: string | null
  movementAfterSnapshot: number
  systemQtyRevealed: boolean
  revealReason: string | null
}

export interface StockCountAuditEntry {
  id: string
  action: string
  userName: string
  timestamp: string
  remarks: string | null
  snapshotData?: Record<string, unknown>
}

export interface StockAdjustmentPreviewLine {
  itemCode: string
  itemName: string
  batchNo: string | null
  binCode: string | null
  adjustmentQty: number
  unitCost: number
  adjustmentValue: number
  debitAccount: string
  creditAccount: string
}

export interface StockAdjustmentPreview {
  countId: string
  countNumber: string
  lines: StockAdjustmentPreviewLine[]
  totalQtyImpact: number
  totalValueImpact: number
  narration: string
  demoOnly: true
}

export interface StockCount {
  id: string
  countNumber: string
  scope: StockCountScope
  status: StockCountStatus
  currentStep: number
  lines: StockCountLine[]
  itemCount: number
  countedItems: number
  differenceItems: number
  differenceValue: number
  assignedTo: string
  snapshotAt: string | null
  submittedAt: string | null
  approvedAt: string | null
  approvedBy: string | null
  postedAt: string | null
  postedBy: string | null
  varianceApprovalRequired: boolean
  varianceApproved: boolean
  varianceRejected: boolean
  adjustmentPreview: StockAdjustmentPreview | null
  auditHistory: StockCountAuditEntry[]
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface StockCountListRow {
  id: string
  countNumber: string
  countType: StockCountType
  warehouseName: string
  countDate: string
  itemCount: number
  countedItems: number
  differenceItems: number
  differenceValue: number
  assignedTo: string
  status: StockCountStatus
  blindCount: boolean
}

export interface StockCountFilter {
  search?: string
  status?: StockCountStatus | 'all'
  countType?: StockCountType | 'all'
  warehouseId?: string
  tab?: string
}

export interface StockCountScopeInput {
  countType: StockCountType
  warehouseId: string
  categoryId?: string | null
  itemId?: string | null
  binLocationId?: string | null
  binCode?: string | null
  batchNo?: string | null
  countDate: string
  assignedTeam: string[]
  blindCount: boolean
}

export interface StockCountLineInput {
  lineId: string
  countedQty: number
  reason?: string
}

export interface StockCountRecountInput {
  lineId: string
  recountQty: number
  reason?: string
}
