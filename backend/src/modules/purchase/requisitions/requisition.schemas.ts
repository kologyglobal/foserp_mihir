import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const REQUISITION_STATUS_VALUES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const
export const REQUISITION_SOURCE_VALUES = ['MANUAL', 'PRODUCTION_SHORTAGE', 'MRP', 'SALES_ORDER'] as const
export const REQUISITION_PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

export const requisitionLineInputSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  warehouseId: z.string().uuid().optional(),
  uomId: z.string().uuid().optional(),
  requiredDate: z.string().min(4).optional(),
  productionOrderId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  bomLineId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  salesOrderLineKey: z.string().trim().max(150).optional(),
  preferredVendorId: z.string().uuid().optional(),
  remarks: z.string().trim().max(2000).optional(),
})

export const updateRequisitionLineSchema = requisitionLineInputSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'At least one field must be provided' },
)

export const createRequisitionSchema = z.object({
  priority: z.enum(REQUISITION_PRIORITY_VALUES).default('MEDIUM'),
  purpose: z.string().trim().max(500).optional(),
  warehouseId: z.string().uuid().optional(),
  productionOrderId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  projectRef: z.string().trim().max(100).optional(),
  requiredByDate: z.string().min(4).optional(),
  notes: z.string().trim().max(5000).optional(),
  idempotencyKey: z.string().trim().max(150).optional(),
  lines: z.array(requisitionLineInputSchema).optional(),
})

export const updateRequisitionSchema = z
  .object({
    priority: z.enum(REQUISITION_PRIORITY_VALUES).optional(),
    purpose: z.string().trim().max(500).optional(),
    warehouseId: z.string().uuid().nullable().optional(),
    productionOrderId: z.string().uuid().nullable().optional(),
    salesOrderId: z.string().uuid().nullable().optional(),
    projectRef: z.string().trim().max(100).nullable().optional(),
    requiredByDate: z.string().min(4).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' })

export const fromProductionShortageSchema = z.object({
  productionOrderId: z.string().uuid(),
  salesOrderId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  departmentId: z.string().trim().max(36).optional(),
  requestedById: z.string().trim().max(36).optional(),
  priority: z.enum(REQUISITION_PRIORITY_VALUES).default('MEDIUM'),
  purpose: z.string().trim().max(500).optional(),
  projectRef: z.string().trim().max(100).optional(),
  requiredByDate: z.string().min(4).optional(),
  /** Gold path: planning-sheet → PO. Opt in to true when RFQ is required. */
  rfqRequired: z.boolean().optional(),
  submit: z.boolean().default(false),
  idempotencyKey: z.string().trim().max(150).optional(),
  lines: z.array(requisitionLineInputSchema).min(1),
})

export const rejectRequisitionSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
})

export const cancelRequisitionSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
})

export const listRequisitionsQuerySchema = paginationSchema.extend({
  status: z.enum(REQUISITION_STATUS_VALUES).optional(),
  source: z.enum(REQUISITION_SOURCE_VALUES).optional(),
  priority: z.enum(REQUISITION_PRIORITY_VALUES).optional(),
  productionOrderId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
})

export const lineIdParamSchema = z.object({
  lineId: z.string().uuid(),
})

export const productionOrderIdParamSchema = z.object({
  productionOrderId: z.string().uuid(),
})

export type RequisitionLineInput = z.infer<typeof requisitionLineInputSchema>
export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>
export type UpdateRequisitionInput = z.infer<typeof updateRequisitionSchema>
export type FromProductionShortageInput = z.infer<typeof fromProductionShortageSchema>
export type RejectRequisitionInput = z.infer<typeof rejectRequisitionSchema>
export type CancelRequisitionInput = z.infer<typeof cancelRequisitionSchema>
export type ListRequisitionsQuery = z.infer<typeof listRequisitionsQuerySchema>
export type UpdateRequisitionLineInput = z.infer<typeof updateRequisitionLineSchema>
