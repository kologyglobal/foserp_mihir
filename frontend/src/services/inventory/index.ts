export {
  getInventoryDashboard,
  getItems,
  getItemById,
  createItem,
  updateItem,
  deactivateItem,
  duplicateItem,
  getStockDetails,
  getInventoryAuditTrail,
  InventoryServiceError,
} from './inventoryService'

export type { InventoryItemExtension } from './inventorySeed'

export {
  getInventoryPlanning,
  ignorePlanningSuggestion,
  updatePlanningQuantity,
  updatePlanningRequiredDate,
  createPurchaseRequisitionDraftDemo,
  createProductionRequestDraftDemo,
  createTransferDraftFromPlanningDemo,
} from './inventoryPlanningService'

export {
  getInventoryReports,
  getInventoryReportEntry,
  isInventoryReportId,
  runInventoryReport,
  exportInventoryData,
  getInventoryPrintPreview,
  getInventoryReportFilterOptions,
  getInventoryReportFilterOptionsAsync,
} from './inventoryReportsService'

export {
  getInventorySetup,
  updateInventorySetup,
  updateInventorySetupDemo,
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  getSavedInventoryViews,
  saveInventoryView,
  deleteInventoryView,
  resetInventorySetupForTests,
} from './inventorySetupService'

export {
  DEFAULT_INVENTORY_SETUP,
  INVENTORY_SETUP_TAB_LABELS,
  INVENTORY_SAVED_VIEW_PRESETS,
} from './inventorySetupSeed'

export * from './movementService'
export * from './transferAdjustmentReturnService'
export * from './stockCountService'
export * from './traceabilityService'

export {
  stockHealthStatus,
  listConsolidatedStock,
  getItemStock360,
  getItemReceiptSummary,
  listItemReceiptSummaries,
  listWarehouseOpsSummaries,
  listVendorOpsSummaries,
  getItemPurchaseSummary,
  listItemPurchaseSummaries,
  getOperationalAnalytics,
  searchItemOpsSnapshot,
} from './operationalViewsService'
export type { ConsolidatedStockFilter } from './operationalViewsService'

export { getStoreDashboard } from './storeOperationsService'
export type { StoreDashboardData, StoreDashKpi } from './storeOperationsService'
export { listPutAwayQueue } from './putAwayService'
export type { PutAwayCard, PutAwayQueueKind } from './putAwayService'
