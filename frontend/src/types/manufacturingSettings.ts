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
    allowManualWorkOrder: boolean
    allowPartialProduction: boolean
    allowOverproduction: boolean
    overproductionTolerancePercent: number
    allowUnderCompletion: boolean
    requireWorkOrderClosing: boolean
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
    allowAcceptanceUnderDeviation: boolean
    reworkEnabled: boolean
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
  | 'work_order_register'
  | 'production_status'
  | 'production_output'
  | 'material_consumption'
  | 'material_shortage'
  | 'material_return'
  | 'production_delay'
  | 'work_in_progress'
  | 'finished_goods_output'
  | 'scrap_and_rejection'
  | 'rework_register'
  | 'production_cost_summary'
  | 'production_variance'
  | 'job_work_register'
  | 'material_sent_to_vendor'
  | 'material_with_vendor'
  | 'job_work_receipt'
  | 'job_work_ageing'
  | 'job_work_reconciliation'
  | 'job_work_cost'
  | 'vendor_invoice_link_status'

export interface ManufacturingReportDefinition {
  id: ManufacturingReportId
  label: string
  category: 'production' | 'material' | 'job_work' | 'cost'
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
    allowManualWorkOrder: true,
    allowPartialProduction: true,
    allowOverproduction: true,
    overproductionTolerancePercent: 5,
    allowUnderCompletion: true,
    requireWorkOrderClosing: true,
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
  },
  operations: {
    operationsEnabled: false,
    jobCardsEnabled: false,
    workstationsEnabled: false,
    detailedLabourEntry: false,
    detailedMachineEntry: false,
    startStopTracking: false,
    routingMandatory: false,
  },
  quality: {
    qualityInspectionEnabled: true,
    itemBasedQuality: true,
    qualityHoldOnOutput: true,
    allowAcceptanceUnderDeviation: true,
    reworkEnabled: true,
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
  { id: 'work_order_register', label: 'Work Order Register', category: 'production', requiresCostPermission: false },
  { id: 'production_status', label: 'Production Status', category: 'production', requiresCostPermission: false },
  { id: 'production_output', label: 'Production Output', category: 'production', requiresCostPermission: false },
  { id: 'material_consumption', label: 'Material Consumption', category: 'material', requiresCostPermission: false },
  { id: 'material_shortage', label: 'Material Shortage', category: 'material', requiresCostPermission: false },
  { id: 'material_return', label: 'Material Return', category: 'material', requiresCostPermission: false },
  { id: 'production_delay', label: 'Production Delay', category: 'production', requiresCostPermission: false },
  { id: 'work_in_progress', label: 'Work in Progress', category: 'production', requiresCostPermission: false },
  { id: 'finished_goods_output', label: 'Finished Goods Output', category: 'production', requiresCostPermission: false },
  { id: 'scrap_and_rejection', label: 'Scrap and Rejection', category: 'production', requiresCostPermission: false },
  { id: 'rework_register', label: 'Rework Register', category: 'production', requiresCostPermission: false },
  { id: 'production_cost_summary', label: 'Production Cost Summary', category: 'cost', requiresCostPermission: true },
  { id: 'production_variance', label: 'Production Variance', category: 'cost', requiresCostPermission: true },
  { id: 'job_work_register', label: 'Job Work Register', category: 'job_work', requiresCostPermission: false },
  { id: 'material_sent_to_vendor', label: 'Material Sent to Vendor', category: 'job_work', requiresCostPermission: false },
  { id: 'material_with_vendor', label: 'Material with Vendor', category: 'job_work', requiresCostPermission: false },
  { id: 'job_work_receipt', label: 'Job Work Receipt', category: 'job_work', requiresCostPermission: false },
  { id: 'job_work_ageing', label: 'Job Work Ageing', category: 'job_work', requiresCostPermission: false },
  { id: 'job_work_reconciliation', label: 'Job Work Reconciliation', category: 'job_work', requiresCostPermission: false },
  { id: 'job_work_cost', label: 'Job Work Cost', category: 'cost', requiresCostPermission: true },
  { id: 'vendor_invoice_link_status', label: 'Vendor Invoice Link Status', category: 'job_work', requiresCostPermission: false },
]
