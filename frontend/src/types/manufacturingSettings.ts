/** Simplified Manufacturing — Settings, reports, saved views (Phase 4). */

export interface ManufacturingSettings {
  general: {
    defaultPlantId: string
    defaultPlantName: string
    defaultMaterialWarehouseId: string
    defaultMaterialWarehouseName: string
    defaultFgWarehouseId: string
    defaultFgWarehouseName: string
    defaultScrapWarehouseId: string
    defaultScrapWarehouseName: string
    productionPlanMandatory: boolean
    bomMandatory: boolean
    quickModeDefault: boolean
    /** Auto-fill BOM when creating a work order (Quick Mode). */
    autoBomFill: boolean
    /** Auto-fill material / FG warehouses from defaults. */
    autoWarehouseFill: boolean
    /** Detect QC requirement from item master. */
    autoQcDetection: boolean
    allowManualWorkOrder: boolean
    allowPartialProduction: boolean
    allowOverproduction: boolean
    overproductionTolerancePercent: number
    allowUnderCompletion: boolean
    requireWorkOrderClosing: boolean
    /** Self-contained WO: inventory/QC/purchase warn instead of hard-block. */
    flexibleExecution: boolean
    /** Allow close when QC is still open / not required path. */
    allowCloseWithoutQc: boolean
  }
  numberSeries: {
    workOrderPrefix: string
    jobWorkPrefix: string
    reworkPrefix: string
  }
  materialConsumption: {
    consumptionMethod: 'bom_backflush' | 'actual'
    automaticConsumption: boolean
    manualMaterialIssue: boolean
    wipTransferRequired: boolean
    autoSelectBatch: boolean
    batchSelectionMethod: 'fifo' | 'fefo'
    fefoForExpiryItems: boolean
    allowPartialMaterialIssue: boolean
    allowMaterialReturn: boolean
    requireReservation: boolean
    blockStartOnShortage: boolean
    /** Allow start / production when material is incomplete. */
    allowProductionWithoutFullMaterial: boolean
    /** Warn (do not hard-block) on negative stock scenarios. */
    allowNegativeStockWarning: boolean
  }
  operations: {
    operationsEnabled: boolean
    jobCardsEnabled: boolean
    workstationsEnabled: boolean
    detailedLabourEntry: boolean
    detailedMachineEntry: boolean
    startStopTracking: boolean
    routingMandatory: boolean
  }
  quality: {
    qualityInspectionEnabled: boolean
    itemBasedQuality: boolean
    qualityHoldOnOutput: boolean
    /** Require QC clearance before WO close. */
    requireQcBeforeClose: boolean
    allowAcceptanceUnderDeviation: boolean
    reworkEnabled: boolean
    allowReject: boolean
    rejectionWarehouseId: string
    rejectionWarehouseName: string
    qualityHoldWarehouseId: string
    qualityHoldWarehouseName: string
  }
  jobWork: {
    jobWorkEnabled: boolean
    fullySubcontractedProduction: boolean
    mixedProduction: boolean
    materialDispatchRequired: boolean
    vendorChallanRequired: boolean
    allowPartialDispatch: boolean
    allowPartialReceipt: boolean
    allowAdditionalMaterial: boolean
    materialReconciliationRequired: boolean
    qualityOnJobWorkReceipt: boolean
    vendorInvoiceLinkRequiredBeforeClosing: boolean
    /** Show vendor invoice placeholder link on Job Work (no AP posting). */
    vendorInvoicePlaceholderEnabled: boolean
    materialDifferenceTolerancePercent: number
    processLossTolerancePercent: number
    defaultVendorMaterialWarehouseId: string
    defaultVendorMaterialWarehouseName: string
    defaultJobWorkReceiptWarehouseId: string
    defaultJobWorkReceiptWarehouseName: string
  }
  costing: {
    materialCostSource: 'bom' | 'actual'
    labourCostSource: 'standard' | 'actual'
    defaultLabourRate: number
    machineCostSource: 'standard' | 'actual'
    defaultMachineRate: number
    overheadMethod: 'percent' | 'fixed'
    overheadRate: number
    includeReworkCost: boolean
    includeJobWorkCost: boolean
    scrapRecoveryMethod: 'percent' | 'actual'
    costVisibilityByRole: boolean
  }
  approvals: {
    manualWorkOrderWithoutDemand: boolean
    materialShortageOverride: boolean
    negativeStockOverride: boolean
    componentSubstitution: boolean
    overproduction: boolean
    completionWithDifference: boolean
    highScrap: boolean
    jobWorkAdditionalMaterialAboveLimit: boolean
    jobWorkMaterialDifference: boolean
    closingWithOutstandingTransactions: boolean
  }
  advanced: {
    advancedMrp: boolean
    detailedRouting: boolean
    finiteCapacityScheduling: boolean
    machineScheduling: boolean
    operatorTimeBooking: boolean
    oee: boolean
    iotIntegration: boolean
    barcodeProduction: boolean
    coProducts: boolean
    byProducts: boolean
    productionCampaigns: boolean
    advancedBackflush: boolean
    vendorPortal: boolean
    multiVendorOperationRouting: boolean
    vendorToVendorTransfer: boolean
  }
}

export type ManufacturingReportId =
  | 'work_order_status'
  | 'daily_production'
  | 'material_consumption'
  | 'scrap_rework'
  | 'qc_pending'
  | 'job_work_pending'
  | 'delayed_work_orders'
  | 'production_efficiency'

export interface ManufacturingReportDefinition {
  id: ManufacturingReportId
  label: string
  description: string
  category: 'production' | 'material' | 'quality' | 'job_work'
  requiresCostPermission: boolean
}

export interface ManufacturingReportFilter {
  dateFrom?: string
  dateTo?: string
  workOrder?: string
  finishedItem?: string
  plant?: string
  warehouse?: string
  productionMethod?: string
  customer?: string
  salesOrder?: string
  vendor?: string
  jobWorkOrder?: string
  status?: string
  item?: string
}

export interface ManufacturingReportRow {
  id: string
  cells: Record<string, string | number>
}

export interface ManufacturingReportResult {
  reportId: ManufacturingReportId
  columns: string[]
  rows: ManufacturingReportRow[]
  generatedAt: string
}

export interface ManufacturingSavedView {
  id: string
  name: string
  scope: 'work_orders' | 'job_work' | 'bom' | 'reports'
  filterJson: string
  createdAt: string
  createdBy: string
}

export const DEFAULT_MANUFACTURING_SETTINGS: ManufacturingSettings = {
  general: {
    defaultPlantId: 'plant-vasant',
    defaultPlantName: 'Vasant Plant',
    defaultMaterialWarehouseId: 'wh-rm',
    defaultMaterialWarehouseName: 'RM Stores',
    defaultFgWarehouseId: 'wh-fg',
    defaultFgWarehouseName: 'FG Stores',
    defaultScrapWarehouseId: 'wh-scrap',
    defaultScrapWarehouseName: 'Scrap Yard',
    productionPlanMandatory: false,
    bomMandatory: true,
    quickModeDefault: true,
    autoBomFill: true,
    autoWarehouseFill: true,
    autoQcDetection: true,
    allowManualWorkOrder: true,
    allowPartialProduction: true,
    allowOverproduction: true,
    overproductionTolerancePercent: 5,
    allowUnderCompletion: true,
    requireWorkOrderClosing: true,
    flexibleExecution: true,
    allowCloseWithoutQc: true,
  },
  numberSeries: {
    workOrderPrefix: 'WO-MFG-',
    jobWorkPrefix: 'JWO-MFG-',
    reworkPrefix: 'RW-MFG-',
  },
  materialConsumption: {
    consumptionMethod: 'bom_backflush',
    automaticConsumption: true,
    manualMaterialIssue: false,
    wipTransferRequired: false,
    autoSelectBatch: true,
    batchSelectionMethod: 'fifo',
    fefoForExpiryItems: true,
    allowPartialMaterialIssue: true,
    allowMaterialReturn: true,
    requireReservation: false,
    blockStartOnShortage: false,
    allowProductionWithoutFullMaterial: true,
    allowNegativeStockWarning: true,
  },
  operations: {
    operationsEnabled: true,
    jobCardsEnabled: false,
    workstationsEnabled: true,
    detailedLabourEntry: false,
    detailedMachineEntry: false,
    startStopTracking: true,
    routingMandatory: false,
  },
  quality: {
    qualityInspectionEnabled: true,
    itemBasedQuality: true,
    qualityHoldOnOutput: true,
    requireQcBeforeClose: true,
    allowAcceptanceUnderDeviation: true,
    reworkEnabled: true,
    allowReject: true,
    rejectionWarehouseId: 'wh-rej',
    rejectionWarehouseName: 'Rejection Store',
    qualityHoldWarehouseId: 'wh-qh',
    qualityHoldWarehouseName: 'Quality Hold',
  },
  jobWork: {
    jobWorkEnabled: true,
    fullySubcontractedProduction: false,
    mixedProduction: true,
    materialDispatchRequired: true,
    vendorChallanRequired: false,
    allowPartialDispatch: true,
    allowPartialReceipt: true,
    allowAdditionalMaterial: true,
    materialReconciliationRequired: true,
    qualityOnJobWorkReceipt: true,
    vendorInvoiceLinkRequiredBeforeClosing: false,
    vendorInvoicePlaceholderEnabled: true,
    materialDifferenceTolerancePercent: 2,
    processLossTolerancePercent: 1,
    defaultVendorMaterialWarehouseId: 'wh-vendor',
    defaultVendorMaterialWarehouseName: 'Vendor Material',
    defaultJobWorkReceiptWarehouseId: 'wh-fg',
    defaultJobWorkReceiptWarehouseName: 'FG Stores',
  },
  costing: {
    materialCostSource: 'bom',
    labourCostSource: 'standard',
    defaultLabourRate: 450,
    machineCostSource: 'standard',
    defaultMachineRate: 800,
    overheadMethod: 'percent',
    overheadRate: 8,
    includeReworkCost: true,
    includeJobWorkCost: true,
    scrapRecoveryMethod: 'percent',
    costVisibilityByRole: true,
  },
  approvals: {
    manualWorkOrderWithoutDemand: false,
    materialShortageOverride: true,
    negativeStockOverride: true,
    componentSubstitution: true,
    overproduction: true,
    completionWithDifference: true,
    highScrap: true,
    jobWorkAdditionalMaterialAboveLimit: true,
    jobWorkMaterialDifference: true,
    closingWithOutstandingTransactions: true,
  },
  advanced: {
    advancedMrp: false,
    detailedRouting: false,
    finiteCapacityScheduling: false,
    machineScheduling: false,
    operatorTimeBooking: false,
    oee: false,
    iotIntegration: false,
    barcodeProduction: false,
    coProducts: false,
    byProducts: false,
    productionCampaigns: false,
    advancedBackflush: false,
    vendorPortal: false,
    multiVendorOperationRouting: false,
    vendorToVendorTransfer: false,
  },
}

export const MANUFACTURING_REPORTS: ManufacturingReportDefinition[] = [
  {
    id: 'work_order_status',
    label: 'Work Order Status Report',
    description: 'WO progress, pending qty, due date and delay days',
    category: 'production',
    requiresCostPermission: false,
  },
  {
    id: 'daily_production',
    label: 'Daily Production Report',
    description: 'Planned vs good / scrap / rework / reject by day and line',
    category: 'production',
    requiresCostPermission: false,
  },
  {
    id: 'material_consumption',
    label: 'Material Consumption Report',
    description: 'Required vs consumed raw material with variance',
    category: 'material',
    requiresCostPermission: false,
  },
  {
    id: 'scrap_rework',
    label: 'Scrap & Rework Report',
    description: 'Scrap, rework and rejection quantities by work order',
    category: 'quality',
    requiresCostPermission: false,
  },
  {
    id: 'qc_pending',
    label: 'QC Pending Report',
    description: 'Work orders waiting for quality inspection',
    category: 'quality',
    requiresCostPermission: false,
  },
  {
    id: 'job_work_pending',
    label: 'Job Work Pending Report',
    description: 'Open outside-processing documents with vendor balances',
    category: 'job_work',
    requiresCostPermission: false,
  },
  {
    id: 'delayed_work_orders',
    label: 'Delayed Work Orders Report',
    description: 'Past-due work orders still open on the floor',
    category: 'production',
    requiresCostPermission: false,
  },
  {
    id: 'production_efficiency',
    label: 'Production Efficiency Report',
    description: 'Yield and efficiency % by work order / line',
    category: 'production',
    requiresCostPermission: false,
  },
]
