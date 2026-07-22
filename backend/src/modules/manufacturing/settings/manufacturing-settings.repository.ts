import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'

export const SERVER_DEFAULT = {
  general: {
    defaultPlantId: 'plant-vasant', defaultPlantName: 'Vasant Plant',
    defaultMaterialWarehouseId: 'wh-rm', defaultMaterialWarehouseName: 'RM Stores',
    defaultFgWarehouseId: 'wh-fg', defaultFgWarehouseName: 'FG Stores',
    defaultScrapWarehouseId: 'wh-scrap', defaultScrapWarehouseName: 'Scrap Yard',
    productionPlanMandatory: false, bomMandatory: true, quickModeDefault: true,
    autoBomFill: true, autoWarehouseFill: true, autoQcDetection: true,
    allowManualWorkOrder: true, allowPartialProduction: true, allowOverproduction: true,
    overproductionTolerancePercent: 5, allowUnderCompletion: true,
    requireWorkOrderClosing: true, allowCloseWithoutQc: false,
  },
  numberSeries: { workOrderPrefix: 'WO-MFG-', jobWorkPrefix: 'JWO-MFG-', reworkPrefix: 'RW-MFG-' },
  materialConsumption: {
    consumptionMethod: 'bom_backflush', automaticConsumption: true, manualMaterialIssue: false,
    wipTransferRequired: false, autoSelectBatch: true, batchSelectionMethod: 'fifo',
    fefoForExpiryItems: true, allowPartialMaterialIssue: true, allowMaterialReturn: true,
    requireReservation: false, blockStartOnShortage: false,
    allowProductionWithoutFullMaterial: true, allowNegativeStockWarning: true,
  },
  operations: {
    operationsEnabled: true, jobCardsEnabled: false, workstationsEnabled: true,
    detailedLabourEntry: false, detailedMachineEntry: false, startStopTracking: true,
    routingMandatory: false,
  },
  quality: {
    qualityInspectionEnabled: true, itemBasedQuality: true, qualityHoldOnOutput: true,
    requireQcBeforeClose: true, allowAcceptanceUnderDeviation: true, reworkEnabled: true,
    allowReject: true, rejectionWarehouseId: 'wh-rej', rejectionWarehouseName: 'Rejection Store',
    qualityHoldWarehouseId: 'wh-qh', qualityHoldWarehouseName: 'Quality Hold',
  },
  jobWork: {
    jobWorkEnabled: true, fullySubcontractedProduction: false, mixedProduction: true,
    materialDispatchRequired: true, vendorChallanRequired: false, allowPartialDispatch: true,
    allowPartialReceipt: true, allowAdditionalMaterial: true, materialReconciliationRequired: true,
    qualityOnJobWorkReceipt: true, vendorInvoiceLinkRequiredBeforeClosing: false,
    vendorInvoicePlaceholderEnabled: true, materialDifferenceTolerancePercent: 2,
    processLossTolerancePercent: 1, defaultVendorMaterialWarehouseId: 'wh-vendor',
    defaultVendorMaterialWarehouseName: 'Vendor Material',
    defaultJobWorkReceiptWarehouseId: 'wh-fg', defaultJobWorkReceiptWarehouseName: 'FG Stores',
  },
  costing: {
    materialCostSource: 'bom', labourCostSource: 'standard', defaultLabourRate: 450,
    machineCostSource: 'standard', defaultMachineRate: 800, overheadMethod: 'percent',
    overheadRate: 8, includeReworkCost: true, includeJobWorkCost: true,
    scrapRecoveryMethod: 'percent', costVisibilityByRole: true,
  },
  approvals: {
    manualWorkOrderWithoutDemand: false, materialShortageOverride: true,
    negativeStockOverride: true, componentSubstitution: true, overproduction: true,
    completionWithDifference: true, highScrap: true, jobWorkAdditionalMaterialAboveLimit: true,
    jobWorkMaterialDifference: true, closingWithOutstandingTransactions: true,
  },
  advanced: {
    advancedMrp: false, detailedRouting: false, finiteCapacityScheduling: false,
    machineScheduling: false, operatorTimeBooking: false, oee: false, iotIntegration: false,
    barcodeProduction: false, coProducts: false, byProducts: false,
    productionCampaigns: false, advancedBackflush: false, vendorPortal: false,
    multiVendorOperationRouting: false, vendorToVendorTransfer: false,
  },
} satisfies Record<string, unknown>

export function find(tenantId: string, tx: Prisma.TransactionClient = prisma) {
  return tx.manufacturingSettings.findUnique({ where: { tenantId } })
}

export function create(
  tenantId: string,
  actorId: string,
  data: Omit<Prisma.ManufacturingSettingsUncheckedCreateInput, 'id' | 'tenantId' | 'createdBy' | 'updatedBy' | 'version'>,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.manufacturingSettings.create({
    data: { ...data, tenantId, createdBy: actorId, updatedBy: actorId, version: 1 },
  })
}

export async function update(
  tenantId: string,
  actorId: string,
  expectedVersion: number,
  data: Prisma.ManufacturingSettingsUncheckedUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const result = await tx.manufacturingSettings.updateMany({
    where: { tenantId, version: expectedVersion },
    data: { ...data, updatedBy: actorId, version: { increment: 1 } },
  })
  if (result.count === 0) return null
  return find(tenantId, tx)
}
