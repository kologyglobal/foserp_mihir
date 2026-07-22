import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const readinessEnum = z.enum([
  'NOT_READY',
  'WAITING_FOR_PRODUCTION',
  'WAITING_FOR_QUALITY',
  'WAITING_FOR_STOCK',
  'PARTIALLY_READY',
  'READY_TO_DISPATCH',
  'ALREADY_IN_DRAFT_DISPATCH',
  'ON_HOLD',
  'BLOCKED',
  'FULLY_FULFILLED',
  'CANCELLED',
  'RECONCILIATION_REQUIRED',
])

export const listRequirementsQuerySchema = paginationSchema.extend({
  readinessStatus: z.union([readinessEnum, z.array(readinessEnum)]).optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'FULFILLED', 'CANCELLED', 'RECONCILIATION_REQUIRED']).optional(),
  customerId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  overdueOnly: z.coerce.boolean().optional(),
  search: z.string().trim().max(100).optional(),
  refresh: z.coerce.boolean().optional(),
  tab: z
    .enum(['ready', 'waiting_production', 'waiting_quality', 'waiting_stock', 'overdue', 'blocked', 'all'])
    .optional(),
})

export const synchroniseRequirementsSchema = z.object({
  salesOrderId: z.string().uuid().optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
})

export const holdRequirementSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const readinessPreviewSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1).max(100),
})

export const createDraftFromRequirementsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1).max(50),
  lines: z
    .array(
      z.object({
        requirementId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
        warehouseId: z.string().uuid().optional(),
      }),
    )
    .optional(),
  plannedDispatchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferredWarehouseId: z.string().uuid().optional(),
  remarks: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
  planBeforeStockAllowed: z.boolean().optional(),
  sourceFingerprintByRequirement: z.record(z.string().uuid(), z.string().min(8).max(128)).optional(),
})

export const workbenchSummaryQuerySchema = z.object({
  refresh: z.coerce.boolean().optional(),
})

export type ListRequirementsQuery = z.infer<typeof listRequirementsQuerySchema>
export type CreateDraftFromRequirementsInput = z.infer<typeof createDraftFromRequirementsSchema>
