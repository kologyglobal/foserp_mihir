import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { PRODUCTION_PRIORITY_VALUES } from '../demands/demand.schemas.js'

export const WORK_ORDER_STATUS_VALUES = ['DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED'] as const
export const WORK_ORDER_HEALTH_VALUES = ['ON_TRACK', 'ATTENTION', 'BLOCKED', 'DELAYED'] as const
export const HOLD_REASON_CATEGORY_VALUES = ['MATERIAL', 'MACHINE', 'QUALITY', 'DRAWING', 'CUSTOMER', 'PLANNING', 'OTHER'] as const

export const listWorkOrdersQuerySchema = paginationSchema.extend({
  status: z.enum(WORK_ORDER_STATUS_VALUES).optional(),
  healthStatus: z.enum(WORK_ORDER_HEALTH_VALUES).optional(),
  productItemId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  supervisorId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
})

export const createManualWorkOrderSchema = z.object({
  productItemId: z.string().uuid(),
  plannedQuantity: z.coerce.number().positive(),
  requiredCompletionDate: z.string().min(4),
  plannedStartDate: z.string().min(4).optional(),
  priority: z.enum(PRODUCTION_PRIORITY_VALUES).default('MEDIUM'),
  plantCode: z.string().trim().max(32).optional(),
  managerId: z.string().uuid().optional(),
  supervisorId: z.string().uuid().optional(),
  jobNumber: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(2000).optional(),
  /** Optional overrides for this WO (defaults come from the manufacturing profile). */
  manufacturingProfileId: z.string().uuid().optional(),
  bomVersionId: z.string().uuid().optional(),
  routingVersionId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().max(150).optional(),
})

export const startWorkOrderSchema = z.object({
  stageId: z.string().uuid().optional(),
})

export const holdWorkOrderSchema = z.object({
  reasonCategory: z.enum(HOLD_REASON_CATEGORY_VALUES),
  remarks: z.string().trim().max(2000).optional(),
  expectedResumeAt: z.string().optional(),
})

export const resumeWorkOrderSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
})

export const cancelWorkOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const splitWorkOrderSchema = z.object({
  quantity: z.coerce.number().positive(),
  reason: z.string().trim().max(500).optional(),
})

const quantityField = z.coerce.number().min(0).default(0)

export const recordProgressSchema = z
  .object({
    stageId: z.string().uuid(),
    operationId: z.string().uuid().optional(),
    goodQuantity: quantityField,
    reworkQuantity: quantityField,
    rejectedQuantity: quantityField,
    scrapQuantity: quantityField,
    remarks: z.string().trim().max(2000).optional(),
    idempotencyKey: z.string().trim().max(150).optional(),
  })
  .refine((v) => v.goodQuantity + v.reworkQuantity + v.rejectedQuantity + v.scrapQuantity > 0, {
    message: 'At least one of goodQuantity, reworkQuantity, rejectedQuantity, scrapQuantity must be greater than zero',
  })

export const completeStageSchema = z.object({
  stageId: z.string().uuid(),
  remarks: z.string().trim().max(2000).optional(),
  /** Skip QC_PENDING gate and complete the stage (flexible execution / authorised override). */
  skipQcGate: z.boolean().optional(),
  /** Force QC even when the stage is not marked qualityRequired (shopfloor popup). */
  requireQc: z.boolean().optional(),
  /** Required when skipping a qualityRequired stage gate (stored on activity). */
  qcOverrideReason: z.string().trim().min(1).max(2000).optional(),
})

export const correctProgressSchema = z.object({
  ledgerEntryId: z.string().uuid(),
  goodQuantity: quantityField,
  reworkQuantity: quantityField,
  rejectedQuantity: quantityField,
  scrapQuantity: quantityField,
  reason: z.string().trim().min(1).max(500),
})

export const completeWorkOrderSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
})

export type ListWorkOrdersQuery = z.infer<typeof listWorkOrdersQuerySchema>
export type CreateManualWorkOrderInput = z.infer<typeof createManualWorkOrderSchema>
export type StartWorkOrderInput = z.infer<typeof startWorkOrderSchema>
export type HoldWorkOrderInput = z.infer<typeof holdWorkOrderSchema>
export type ResumeWorkOrderInput = z.infer<typeof resumeWorkOrderSchema>
export type CancelWorkOrderInput = z.infer<typeof cancelWorkOrderSchema>
export type SplitWorkOrderInput = z.infer<typeof splitWorkOrderSchema>
export type RecordProgressInput = z.infer<typeof recordProgressSchema>
export type CompleteStageInput = z.infer<typeof completeStageSchema>
export type CorrectProgressInput = z.infer<typeof correctProgressSchema>
export type CompleteWorkOrderInput = z.infer<typeof completeWorkOrderSchema>
