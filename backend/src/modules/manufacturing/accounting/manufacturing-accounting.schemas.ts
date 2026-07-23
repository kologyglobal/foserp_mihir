import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listAccountingEventsQuerySchema = paginationSchema.extend({
  productionOrderId: z.string().uuid().optional(),
  eventType: z
    .enum([
      'MATERIAL_RESERVED',
      'MATERIAL_ISSUED',
      'MATERIAL_RETURNED',
      'MATERIAL_CONSUMED',
      'WIP_MOVED',
      'SEMI_FINISHED_RECEIVED',
      'PRODUCTION_COMPLETED',
      'FINISHED_GOODS_RECEIVED',
      'SCRAP_RECORDED',
      'PRODUCTION_ORDER_CLOSED',
      'LABOUR_ABSORPTION',
      'MACHINE_ABSORPTION',
      'OVERHEAD_ABSORPTION',
      'JOB_WORK_RECEIPT_COST',
      'PRODUCTION_VARIANCE',
      'MANUFACTURING_REVERSAL',
    ])
    .optional(),
})

export type ListAccountingEventsQuery = z.infer<typeof listAccountingEventsQuerySchema>

export const FINANCE_FEATURE_KEYS = [
  'RECEIVABLES',
  'PAYABLES',
  'BANK_RECONCILIATION',
  'GST',
  'TDS',
  'FIXED_ASSETS',
  'MANUFACTURING_ACCOUNTING',
  'BUDGETING',
  'MULTI_CURRENCY',
  'COST_CENTRES',
  'PROJECT_ACCOUNTING',
  'APPROVALS',
] as const

export const listFeatureControlsQuerySchema = z.object({
  featureKey: z.enum(FINANCE_FEATURE_KEYS).optional(),
})

export const featureControlParamsSchema = z.object({
  legalEntityId: z.string().uuid(),
})

export const putFeatureControlSchema = z.object({
  isEnabled: z.boolean(),
  /** Required `true` on every enable request — inventory reconciliation sign-off. */
  inventoryReconcileConfirmed: z.boolean().optional(),
  inventoryReconcileRemarks: z.string().trim().max(1000).optional(),
  inventoryReconcileScope: z
    .object({
      plantId: z.string().uuid().optional(),
      warehouseIds: z.array(z.string().uuid()).max(100).optional(),
      workOrderIds: z.array(z.string().uuid()).max(100).optional(),
      productIds: z.array(z.string().uuid()).max(100).optional(),
    })
    .optional(),
  /** Optional reference to a reconciliation report / workspace export. */
  inventoryReconcileReportRef: z.string().trim().max(200).optional(),
  /** Required `true` on every enable request — pilot Finance sign-off. */
  pilotSignOff: z.boolean().optional(),
  pilotSignOffRemarks: z.string().trim().max(1000).optional(),
  pilotScope: z
    .object({
      plantId: z.string().uuid().optional(),
      finishedItemIds: z.array(z.string().uuid()).max(100).optional(),
      warehouseIds: z.array(z.string().uuid()).max(100).optional(),
      sampleWorkOrderId: z.string().uuid().optional(),
      samplePostingPreviewReviewed: z.boolean().optional(),
    })
    .optional(),
  /** @deprecated prefer inventoryReconcileRemarks / pilotSignOffRemarks */
  signOffNote: z.string().trim().max(500).optional(),
})

export const readinessQuerySchema = z.object({
  legalEntityId: z.string().uuid().optional(),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  includeTechnicalDetails: z.enum(['true', '1', 'false', '0']).optional(),
})

export const inventorySignOffBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  inventoryReconcileConfirmed: z.literal(true),
  remarks: z.string().trim().max(1000).optional(),
  scope: z
    .object({
      plantId: z.string().uuid().optional(),
      warehouseIds: z.array(z.string().uuid()).max(100).optional(),
      workOrderIds: z.array(z.string().uuid()).max(100).optional(),
      productIds: z.array(z.string().uuid()).max(100).optional(),
    })
    .optional(),
  reportRef: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().trim().max(150).optional(),
})

export const financePilotSignOffBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  pilotSignOff: z.literal(true),
  remarks: z.string().trim().max(1000).optional(),
  scope: z
    .object({
      plantId: z.string().uuid().optional(),
      finishedItemIds: z.array(z.string().uuid()).max(100).optional(),
      warehouseIds: z.array(z.string().uuid()).max(100).optional(),
      sampleWorkOrderId: z.string().uuid().optional(),
      samplePostingPreviewReviewed: z.boolean().optional(),
    })
    .optional(),
  idempotencyKey: z.string().trim().max(150).optional(),
})

export const enableBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  inventoryReconcileConfirmed: z.literal(true),
  pilotSignOff: z.literal(true),
  confirmationNote: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().trim().max(150).optional(),
})

export const disableBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  reason: z.string().trim().min(5).max(1000),
})

export type ReadinessQuery = z.infer<typeof readinessQuerySchema>
export type InventorySignOffBody = z.infer<typeof inventorySignOffBodySchema>
export type FinancePilotSignOffBody = z.infer<typeof financePilotSignOffBodySchema>
export type EnableBody = z.infer<typeof enableBodySchema>
export type DisableBody = z.infer<typeof disableBodySchema>

export type ListFeatureControlsQuery = z.infer<typeof listFeatureControlsQuerySchema>
export type PutFeatureControlInput = z.infer<typeof putFeatureControlSchema>
