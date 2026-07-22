import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const PLAN_STATUS_VALUES = [
  'DRAFT',
  'PLANNED',
  'WORK_ORDERS_CREATED',
  'CLOSED',
  'CANCELLED',
] as const

export const PLAN_SOURCE_VALUES = [
  'SALES_ORDER',
  'STOCK_REPLENISHMENT',
  'FORECAST',
  'MANUAL',
] as const

const dateInput = z
  .string()
  .datetime()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))

export const listPlansQuerySchema = paginationSchema.extend({
  status: z.enum(PLAN_STATUS_VALUES).optional(),
  sourceType: z.enum(PLAN_SOURCE_VALUES).optional(),
  search: z.string().trim().max(100).optional(),
})

export const planLineInputSchema = z.object({
  productItemId: z.string().uuid(),
  uomId: z.string().uuid().optional(),
  demandQuantity: z.coerce.number().positive(),
  safetyStockQuantity: z.coerce.number().min(0).optional().default(0),
  requiredDate: dateInput.optional(),
  salesOrderId: z.string().uuid().optional(),
  sourceDocumentId: z.string().uuid().optional(),
  sourceDocumentNo: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(2000).optional(),
  ignored: z.boolean().optional().default(false),
})

export const createPlanSchema = z.object({
  planName: z.string().trim().min(1).max(200),
  planDate: dateInput,
  sourceType: z.enum(PLAN_SOURCE_VALUES).default('MANUAL'),
  warehouseId: z.string().uuid().optional(),
  plantCode: z.string().trim().max(32).optional(),
  periodFrom: dateInput.optional(),
  periodTo: dateInput.optional(),
  notes: z.string().trim().max(4000).optional(),
  ownerUserId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().max(150).optional(),
  lines: z.array(planLineInputSchema).min(1).max(200),
})

export const updatePlanSchema = z.object({
  planName: z.string().trim().min(1).max(200).optional(),
  planDate: dateInput.optional(),
  sourceType: z.enum(PLAN_SOURCE_VALUES).optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  plantCode: z.string().trim().max(32).nullable().optional(),
  periodFrom: dateInput.nullable().optional(),
  periodTo: dateInput.nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  lines: z.array(planLineInputSchema).min(1).max(200).optional(),
})

export const cancelPlanSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const generateWorkOrdersSchema = z
  .object({
    lineIds: z.array(z.string().uuid()).optional(),
    idempotencyKey: z.string().trim().max(150).optional(),
  })
  .default({})

export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>
export type CreatePlanInput = z.infer<typeof createPlanSchema>
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>
export type CancelPlanInput = z.infer<typeof cancelPlanSchema>
export type GenerateWorkOrdersInput = z.infer<typeof generateWorkOrdersSchema>
export type PlanLineInput = z.infer<typeof planLineInputSchema>
