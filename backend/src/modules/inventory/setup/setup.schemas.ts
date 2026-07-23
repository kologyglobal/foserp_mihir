import { z } from 'zod'

const numberSeriesSchema = z.object({
  prefix: z.string().min(1).max(16),
  nextNumber: z.number().int().min(1),
  padding: z.number().int().min(1).max(10),
})

export const inventorySetupBodySchema = z.object({
  general: z
    .object({
      defaultWarehouseId: z.string().uuid().nullable().optional(),
      defaultReceiptLocationId: z.string().uuid().nullable().optional(),
      defaultIssueLocationId: z.string().uuid().nullable().optional(),
      defaultCostingMethod: z.enum(['standard', 'average', 'fifo', 'specific']).optional(),
      allowNegativeStock: z.boolean().optional(),
      requirePostingDate: z.boolean().optional(),
      requireSourceDocument: z.boolean().optional(),
      quickModeDefault: z.boolean().optional(),
      detailedModeEnabled: z.boolean().optional(),
      inventoryValueVisible: z.boolean().optional(),
    })
    .optional(),
  tracking: z
    .object({
      batchTrackingEnabled: z.boolean().optional(),
      serialTrackingEnabled: z.boolean().optional(),
      expiryTrackingEnabled: z.boolean().optional(),
      automaticBatchSelection: z.boolean().optional(),
      batchSelectionMethod: z.enum(['fifo', 'fefo', 'manual']).optional(),
      expiryWarningDays: z.number().int().min(0).max(3650).optional(),
      serialUniquenessRequired: z.boolean().optional(),
    })
    .optional(),
  quality: z
    .object({
      qualityInspectionEnabled: z.boolean().optional(),
      qualityHoldLocationId: z.string().uuid().nullable().optional(),
      quarantineLocationId: z.string().uuid().nullable().optional(),
      rejectedLocationId: z.string().uuid().nullable().optional(),
      deviationApprovalRequired: z.boolean().optional(),
    })
    .optional(),
  planning: z
    .object({
      reorderPlanningEnabled: z.boolean().optional(),
      defaultSafetyStock: z.number().min(0).optional(),
      defaultLeadTimeDays: z.number().int().min(0).max(3650).optional(),
      suggestedQuantityMethod: z.enum(['max_minus_projected', 'reorder_qty', 'safety_plus_lead']).optional(),
      createDraftRequirementOnly: z.boolean().optional(),
    })
    .optional(),
  approvals: z
    .object({
      adjustmentApprovalLimit: z.number().min(0).optional(),
      negativeStockOverrideApproval: z.boolean().optional(),
      highValueTransferApproval: z.number().min(0).optional(),
      stockCountVarianceLimit: z.number().min(0).optional(),
      qualityDeviationApproval: z.boolean().optional(),
    })
    .optional(),
  advancedWarehouse: z
    .object({
      binManagement: z.boolean().optional(),
      barcodeScanning: z.boolean().optional(),
      putAway: z.boolean().optional(),
      pickList: z.boolean().optional(),
      packing: z.boolean().optional(),
      wavePicking: z.boolean().optional(),
      mobileWarehouse: z.boolean().optional(),
      consignmentInventory: z.boolean().optional(),
    })
    .optional(),
  numberSeries: z
    .object({
      receipt: numberSeriesSchema.optional(),
      issue: numberSeriesSchema.optional(),
      transfer: numberSeriesSchema.optional(),
      adjustment: numberSeriesSchema.optional(),
      stockCount: numberSeriesSchema.optional(),
    })
    .optional(),
})

export type InventorySetupBody = z.infer<typeof inventorySetupBodySchema>

export const lookupQuerySchema = z.object({
  code: z.string().trim().min(1).max(120),
  warehouseId: z.string().uuid().optional(),
})
