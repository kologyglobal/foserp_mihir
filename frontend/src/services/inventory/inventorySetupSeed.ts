import type { InventorySetup, InventoryWarehouseRecord } from '../../types/inventoryDomain'

export const DEFAULT_INVENTORY_SETUP: InventorySetup = {
  general: {
    defaultWarehouseId: null,
    defaultReceiptLocationId: null,
    defaultIssueLocationId: null,
    defaultCostingMethod: 'standard',
    allowNegativeStock: false,
    requirePostingDate: true,
    requireSourceDocument: true,
    quickModeDefault: true,
    detailedModeEnabled: true,
    inventoryValueVisible: true,
  },
  tracking: {
    batchTrackingEnabled: true,
    serialTrackingEnabled: false,
    expiryTrackingEnabled: true,
    automaticBatchSelection: true,
    batchSelectionMethod: 'fefo',
    expiryWarningDays: 30,
    serialUniquenessRequired: true,
  },
  quality: {
    qualityInspectionEnabled: true,
    qualityHoldLocationId: null,
    quarantineLocationId: null,
    rejectedLocationId: null,
    deviationApprovalRequired: true,
  },
  planning: {
    reorderPlanningEnabled: true,
    defaultSafetyStock: 0,
    defaultLeadTimeDays: 7,
    suggestedQuantityMethod: 'max_minus_projected',
    createDraftRequirementOnly: true,
  },
  approvals: {
    adjustmentApprovalLimit: 10_000,
    negativeStockOverrideApproval: true,
    highValueTransferApproval: 50_000,
    stockCountVarianceLimit: 500,
    qualityDeviationApproval: true,
  },
  advancedWarehouse: {
    binManagement: false,
    barcodeScanning: false,
    putAway: false,
    pickList: false,
    packing: false,
    wavePicking: false,
    mobileWarehouse: false,
    consignmentInventory: false,
  },
  numberSeries: {
    receipt: { prefix: 'GRN', nextNumber: 1001, padding: 5 },
    issue: { prefix: 'MI', nextNumber: 2001, padding: 5 },
    transfer: { prefix: 'TRF', nextNumber: 3001, padding: 5 },
    adjustment: { prefix: 'ADJ', nextNumber: 4001, padding: 5 },
    stockCount: { prefix: 'SC', nextNumber: 5001, padding: 5 },
  },
}

export const INVENTORY_SETUP_TAB_LABELS: Record<string, string> = {
  general: 'General',
  warehouses: 'Warehouses',
  item_categories: 'Item Categories',
  uom: 'Units of Measure',
  number_series: 'Number Series',
  tracking: 'Tracking',
  quality: 'Quality',
  planning: 'Planning',
  approvals: 'Approvals',
  permissions: 'Permissions',
  advanced_warehouse: 'Advanced Warehouse',
}

export const INVENTORY_SAVED_VIEW_PRESETS: Array<{
  name: string
  workspace: string
  filters: Record<string, string>
}> = [
  { name: 'Low Stock', workspace: '/inventory/stock', filters: { lowStock: '1' } },
  { name: 'Out of Stock', workspace: '/inventory/stock', filters: { outOfStock: '1' } },
  { name: 'Quality Hold', workspace: '/inventory/stock', filters: { status: 'quality_hold' } },
  { name: 'Pending Receipts', workspace: '/inventory/movements/receipts', filters: { status: 'pending_receipt' } },
  { name: 'Production Issues Pending', workspace: '/inventory/movements/issues', filters: { sourceType: 'production_order', status: 'pending_issue' } },
  { name: 'Transfers in Transit', workspace: '/inventory/movements/transfers', filters: { status: 'in_transit' } },
  { name: 'High-Value Adjustments', workspace: '/inventory/movements/adjustments', filters: { highValue: '1' } },
  { name: 'Expiring in 30 Days', workspace: '/inventory/stock', filters: { expiring: '30' } },
  { name: 'Stock Count Variances', workspace: '/inventory/stock-count', filters: { hasVariance: '1' } },
  { name: 'Reorder Required', workspace: '/inventory/planning', filters: { reorderRequired: '1' } },
]

export function mapMasterWarehouseToSetup(
  wh: { id: string; warehouseCode: string; warehouseName: string; plantCode: string; isActive: boolean },
  idx: number,
): InventoryWarehouseRecord {
  const types: InventoryWarehouseRecord['warehouseType'][] = ['raw', 'wip', 'finished', 'general', 'transit']
  return {
    id: wh.id,
    warehouseCode: wh.warehouseCode,
    warehouseName: wh.warehouseName,
    warehouseType: types[idx % types.length] ?? 'general',
    plantCode: wh.plantCode,
    location: `${wh.plantCode} — Main`,
    warehouseManager: idx === 0 ? 'Ramesh Patil' : 'Suresh Kulkarni',
    defaultReceiptLocationId: null,
    defaultIssueLocationId: null,
    qualityHoldLocationId: null,
    quarantineLocationId: null,
    rejectedLocationId: null,
    scrapLocationId: null,
    transitLocationId: null,
    binManagementEnabled: false,
    isActive: wh.isActive,
  }
}
