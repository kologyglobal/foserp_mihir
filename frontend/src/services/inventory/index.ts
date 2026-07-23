export {
  getInventoryDashboard,
  getItems,
  getItemById,
  createItem,
  updateItem,
  deactivateItem,
  duplicateItem,
  getStockAvailability,
  getStockDetails,
  getInventoryAuditTrail,
  InventoryServiceError,
  resetInventoryServiceForTests,
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
  resetInventoryPlanningForTests,
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
