import { z } from 'zod'
import { optionalUuid } from '../../../utils/zodHelpers.js'

export const PLANNING_STATUSES = [
  'PENDING_PLANNING',
  'UNDER_REVIEW',
  'VENDOR_SELECTED',
  'APPROVED',
  'PO_PENDING',
  'PO_CREATED',
  'PARTIALLY_ORDERED',
  'ON_HOLD',
  'CANCELLED',
  'COMPLETED',
] as const

export const PLANNING_PURCHASE_TYPES = ['DIRECT_PURCHASE', 'RFQ_BASED', 'RATE_CONTRACT', 'OTHER'] as const

export const PLANNING_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'] as const

export const PLANNING_SORT_FIELDS = [
  'planningDate',
  'requiredDate',
  'planningNumber',
  'status',
  'priority',
  'estimatedAmount',
  'netPurchaseQuantity',
  'createdAt',
  'updatedAt',
] as const

const optionalDate = z.preprocess(
  (v) => (v === '' ? null : v),
  z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().nullable(),
)

const boolQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined
    return v === true || v === 'true' || v === '1'
  })

const upperStatus = z.preprocess(
  (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  z.enum(PLANNING_STATUSES),
)
const upperPriority = z.preprocess(
  (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  z.enum(PLANNING_PRIORITIES),
)
const upperPurchaseType = z.preprocess(
  (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  z.enum(PLANNING_PURCHASE_TYPES),
)

export const listPlanningSheetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  planningNumber: z.string().trim().optional(),
  purchaseRequisitionNumber: z.string().trim().optional(),
  status: upperStatus.optional(),
  departmentId: z.string().trim().max(36).optional(),
  itemId: z.string().uuid().optional(),
  selectedVendorId: z.string().uuid().optional(),
  buyerId: z.string().trim().max(36).optional(),
  priority: upperPriority.optional(),
  purchaseType: upperPurchaseType.optional(),
  planningDateFrom: optionalDate,
  planningDateTo: optionalDate,
  requiredDateFrom: optionalDate,
  requiredDateTo: optionalDate,
  overdue: boolQuery,
  poPending: boolQuery,
  sortBy: z.enum(PLANNING_SORT_FIELDS).default('planningDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).transform((q) => ({
  ...q,
  limit: q.pageSize ?? q.limit ?? 20,
}))

export const updatePlanningRowSchema = z.object({
  selectedVendorId: optionalUuid,
  expectedRate: z.number().nonnegative().optional(),
  negotiatedRate: z.number().nonnegative().optional().nullable(),
  requiredDate: optionalDate,
  purchaseType: upperPurchaseType.optional(),
  buyerId: z.string().trim().max(36).optional().nullable(),
  priority: upperPriority.optional(),
  actionMessage: z.boolean().optional(),
  remarks: z.string().trim().optional().nullable(),
  status: upperStatus.optional(),
})

export const bulkAssignBuyerSchema = z.object({
  rowIds: z.array(z.string().uuid()).min(1),
  buyerId: z.string().trim().min(1).max(36),
})

export const bulkSelectVendorSchema = z.object({
  rowIds: z.array(z.string().uuid()).min(1),
  vendorId: z.string().uuid(),
  expectedRate: z.number().nonnegative().optional().nullable(),
  negotiatedRate: z.number().nonnegative().optional().nullable(),
})

export const bulkStatusSchema = z.object({
  rowIds: z.array(z.string().uuid()).min(1),
  status: upperStatus,
  reason: z.string().trim().optional().nullable(),
})

export const recalculatePlanningSchema = z
  .object({
    rowIds: z.array(z.string().uuid()).default([]),
  })
  .default({ rowIds: [] })

export const createPoFromPlanningSchema = z.object({
  rowIds: z.array(z.string().uuid()).min(1, 'Select at least one eligible Planning row.'),
})

export type ListPlanningSheetQuery = z.infer<typeof listPlanningSheetQuerySchema>
export type UpdatePlanningRowInput = z.infer<typeof updatePlanningRowSchema>
export type BulkAssignBuyerInput = z.infer<typeof bulkAssignBuyerSchema>
export type BulkSelectVendorInput = z.infer<typeof bulkSelectVendorSchema>
export type BulkStatusInput = z.infer<typeof bulkStatusSchema>
export type RecalculatePlanningInput = z.infer<typeof recalculatePlanningSchema>
export type CreatePoFromPlanningInput = z.infer<typeof createPoFromPlanningSchema>
