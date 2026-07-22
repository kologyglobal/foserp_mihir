import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const PRODUCTION_PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export const DEMAND_SOURCE_TYPE_VALUES = [
  'SALES_ORDER',
  'MANUAL',
  'STOCK_REPLENISHMENT',
  'PROJECT',
  'REWORK',
  'PRODUCTION_PLAN',
] as const
export const DEMAND_STATUS_VALUES = ['OPEN', 'PARTIALLY_CONVERTED', 'FULLY_CONVERTED', 'CANCELLED'] as const

export const listDemandsQuerySchema = paginationSchema.extend({
  status: z.enum(DEMAND_STATUS_VALUES).optional(),
  sourceType: z.enum(DEMAND_SOURCE_TYPE_VALUES).optional(),
  productItemId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
})

export const createManualDemandSchema = z.object({
  productItemId: z.string().uuid(),
  requestedQuantity: z.coerce.number().positive(),
  uomId: z.string().uuid(),
  requiredDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  priority: z.enum(PRODUCTION_PRIORITY_VALUES).default('MEDIUM'),
  plantCode: z.string().trim().max(32).optional(),
  customerId: z.string().uuid().optional(),
  projectRef: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().trim().max(150).optional(),
})

export const cancelDemandSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const convertSalesOrderLineSchema = z.object({
  quantity: z.coerce.number().positive(),
  requiredDate: z
    .string()
    .datetime()
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  priority: z.enum(PRODUCTION_PRIORITY_VALUES).optional(),
  plantCode: z.string().trim().max(32).optional(),
  supervisorId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().max(150).optional(),
})

export type ListDemandsQuery = z.infer<typeof listDemandsQuerySchema>
export type CreateManualDemandInput = z.infer<typeof createManualDemandSchema>
export type CancelDemandInput = z.infer<typeof cancelDemandSchema>
export type ConvertSalesOrderLineInput = z.infer<typeof convertSalesOrderLineSchema>
