/** Job Work, Reports, Settings — Manufacturing Phase 4 (demo FE). */

export type JobWorkStatus =
  | 'draft'
  | 'material_sent'
  | 'partially_received'
  | 'received'
  | 'reconciliation_pending'
  | 'closed'
  | 'cancelled'

export type JobWorkRateBasis = 'per_piece' | 'per_kg' | 'per_hour' | 'per_batch' | 'fixed'

export type JobWorkInvoiceStatus = 'none' | 'linked' | 'pending'

export type JobWorkMaterialLineStatus =
  | 'pending'
  | 'partial'
  | 'sent'
  | 'reconciled'
  | 'difference'

export type JobWorkReconLineStatus =
  | 'reconciled'
  | 'material_with_vendor'
  | 'excess_consumption'
  | 'short_return'
  | 'difference'
  | 'under_review'

export interface JobWorkOrder {
  id: string
  jwNumber: string
  workOrderId: string
  workOrderNo: string
  vendorId: string
  vendorName: string
  vendorAddress?: string
  process: string
  itemId: string
  itemCode: string
  itemName: string
  uom: string
  orderedQty: number
  sentQty: number
  receivedQty: number
  acceptedQty: number
  rejectedQty: number
  reworkQty: number
  pendingQty: number
  materialBalance: number
  rate: number
  rateBasis: JobWorkRateBasis
  expectedCost: number
  expectedReturnDate: string
  status: JobWorkStatus
  invoiceStatus: JobWorkInvoiceStatus
  plantId: string
  plantName: string
  materialWarehouseId: string
  materialWarehouseName: string
  receiptWarehouseId: string
  receiptWarehouseName: string
  bomId?: string
  bomNumber?: string
  bomVersion?: string
  costCentre?: string
  qualityRequired: boolean
  vendorChallan?: string
  transporter?: string
  vehicle?: string
  deliveryAddress?: string
  drawingRevision?: string
  qualityInstructions?: string
  invoiceId?: string
  invoiceNo?: string
  invoiceAmount?: number
  differenceApproved?: boolean
  differenceReason?: string
  readOnly: boolean
  activity: JobWorkActivity[]
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface JobWorkActivity {
  id: string
  action: string
  userName: string
  at: string
  quantity?: number
  comment?: string
  relatedDocument?: string
}

export interface JobWorkMaterial {
  id: string
  jobWorkId: string
  materialItemId: string
  materialCode: string
  materialName: string
  requiredQty: number
  availableQty: number
  sentQty: number
  additionalSentQty: number
  consumedQty: number
  returnedQty: number
  scrapReturnedQty: number
  balanceWithVendor: number
  uom: string
  status: JobWorkMaterialLineStatus
  qualityHold?: boolean
  blocked?: boolean
  tracking: 'none' | 'batch' | 'serial'
}

export interface JobWorkDispatch {
  id: string
  jobWorkId: string
  dispatchAt: string
  lines: Array<{ materialId: string; qty: number; batchOrSerial?: string }>
  vendorChallan?: string
  vehicle?: string
  transporter?: string
  remarks?: string
  userName: string
}

export interface JobWorkReceipt {
  id: string
  jobWorkId: string
  receivedAt: string
  receivedQty: number
  acceptedQty: number
  rejectedQty: number
  reworkQty: number
  scrapReturned?: number
  unusedReturned?: number
  vendorChallan?: string
  batchOrSerial?: string
  userName: string
}

export interface JobWorkReconciliationLine {
  materialId: string
  materialCode: string
  sent: number
  additionalSent: number
  consumed: number
  returned: number
  scrapReturned: number
  processLoss: number
  expectedBalance: number
  actualBalance: number
  difference: number
  status: JobWorkReconLineStatus
}

export interface JobWorkReconciliation {
  jobWorkId: string
  lines: JobWorkReconciliationLine[]
  unexplainedDifference: number
  canClose: boolean
  warnings: string[]
}

export interface JobWorkInvoiceLink {
  jobWorkId: string
  vendorId: string
  vendorName: string
  processQty: number
  agreedRate: number
  expectedServiceAmount: number
  acceptedQty: number
  expectedJobWorkCost: number
  invoiceId?: string
  invoiceNo?: string
  invoiceAmount?: number
  difference: number
  gstPreview: number
  tdsPreview: number
  matchStatus: 'unlinked' | 'matched' | 'variance'
}

export interface JobWorkCostPreview {
  serviceCost: number
  freight: number
  materialLoss: number
  reworkCost: number
  rejectionCost: number
  scrapRecovery: number
  totalJobWorkCost: number
  costPerAcceptedUnit: number
}

export type JobWorkFilterTab =
  | 'all'
  | 'draft'
  | 'material_sent'
  | 'partially_received'
  | 'received'
  | 'reconciliation_pending'
  | 'closed'
  | 'cancelled'
  | 'overdue'

export interface JobWorkFilter {
  tab?: JobWorkFilterTab
  search?: string
  workOrder?: string
  vendor?: string
  process?: string
  item?: string
  expectedReturnFrom?: string
  expectedReturnTo?: string
  status?: JobWorkStatus | ''
  invoiceStatus?: JobWorkInvoiceStatus | ''
}

export interface JobWorkRegisterSummary {
  open: number
  materialWithVendors: number
  dueThisWeek: number
  overdue: number
  reconciliationDifference: number
  vendorInvoicePending: number
}

export interface ManufacturingSettings {
  general: {
    defaultPlantId: string
    defaultMaterialWarehouseId: string
    defaultFgWarehouseId: string
    defaultScrapWarehouseId: string
    productionPlanMandatory: boolean
    bomMandatory: boolean
    quickModeDefault: boolean
    allowManualWorkOrder: boolean
    allowPartialProduction: boolean
    allowOverproduction: boolean
    overproductionTolerancePct: number
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
    qualityHoldWarehouseId: string
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
    materialDifferenceTolerancePct: number
    processLossTolerancePct: number
    defaultVendorMaterialWarehouseId: string
    defaultJobWorkReceiptWarehouseId: string
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
    scrapRecoveryMethod: 'value' | 'none'
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

export interface ManufacturingSavedView {
  id: string
  name: string
  module: 'work_orders' | 'job_work' | 'reports'
  filtersJson: string
  createdAt: string
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
  name: string
  category: 'production' | 'material' | 'job_work' | 'cost'
  requiresCostPermission: boolean
  description: string
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

export const JW_STATUS_LABELS: Record<JobWorkStatus, string> = {
  draft: 'Draft',
  material_sent: 'Material Sent',
  partially_received: 'Partially Received',
  received: 'Received',
  reconciliation_pending: 'Reconciliation Pending',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export const JW_RATE_BASIS_LABELS: Record<JobWorkRateBasis, string> = {
  per_piece: 'Per Piece',
  per_kg: 'Per Kg',
  per_hour: 'Per Hour',
  per_batch: 'Per Batch',
  fixed: 'Fixed Amount',
}
