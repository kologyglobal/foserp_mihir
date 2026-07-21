import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { optionalUuid } from '../../../utils/zodHelpers.js'
import { PURCHASE_ERROR_MESSAGES, PURCHASE_ERROR_CODE } from '../shared/purchase-error-catalog.js'

export const PURCHASE_REQUISITION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PARTIALLY_CONVERTED',
  'CONVERTED_TO_PO',
  'CANCELLED',
  'CLOSED',
] as const

export const PURCHASE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'] as const

const optionalDate = z.preprocess(
  (v) => (v === '' ? null : v),
  z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().nullable(),
)

export const purchaseRequisitionLineInputSchema = z.object({
  id: z.string().uuid().optional(),
  lineNumber: z.number().int().positive().optional(),
  itemId: optionalUuid,
  itemCode: z.string().trim().max(64).optional().nullable().default(''),
  itemName: z.string().trim().max(300).optional().nullable().default(''),
  description: z.string().trim().optional().nullable(),
  requiredQuantity: z.number({
    required_error: PURCHASE_ERROR_MESSAGES[PURCHASE_ERROR_CODE.PR_QTY_INVALID],
    invalid_type_error: PURCHASE_ERROR_MESSAGES[PURCHASE_ERROR_CODE.PR_QTY_INVALID],
  }),
  uomId: optionalUuid,
  estimatedRate: z.number().nonnegative().optional().default(0),
  warehouseId: optionalUuid,
  binId: z.string().trim().max(36).optional().nullable(),
  preferredVendorId: optionalUuid,
  requiredDate: optionalDate,
  remarks: z.string().trim().optional().nullable(),
})

export const listPurchaseRequisitionsQuerySchema = paginationSchema.extend({
  status: z.enum(PURCHASE_REQUISITION_STATUSES).optional(),
  rfqRequired: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
  warehouseId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
})

export const createPurchaseRequisitionSchema = z.object({
  requisitionDate: optionalDate,
  departmentId: z.string().trim().max(36).optional().nullable(),
  requestedById: z.string().trim().max(36).optional().nullable(),
  warehouseId: optionalUuid,
  requiredDate: optionalDate,
  priority: z.enum(PURCHASE_PRIORITIES).optional().default('NORMAL'),
  purchasePurpose: z.string().trim().optional().nullable(),
  /** Draft may omit; submit workflow enforces a boolean selection. */
  rfqRequired: z.boolean({
    invalid_type_error: PURCHASE_ERROR_MESSAGES[PURCHASE_ERROR_CODE.PR_RFQ_REQUIRED_SELECTION],
  }).optional(),
  remarks: z.string().trim().optional().nullable(),
  lines: z.array(purchaseRequisitionLineInputSchema).optional().default([]),
})

export const updatePurchaseRequisitionSchema = createPurchaseRequisitionSchema.partial().extend({
  lines: z.array(purchaseRequisitionLineInputSchema).optional(),
})

export const rejectPurchaseRequisitionSchema = z.object({
  reason: z.string().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
})

export const sendBackPurchaseRequisitionSchema = z.object({
  reason: z.string().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
})

export const lifecycleRemarksSchema = z
  .object({
    remarks: z.string().trim().optional().nullable(),
  })
  .default({})

export type ListPurchaseRequisitionsQuery = z.infer<typeof listPurchaseRequisitionsQuerySchema>
export type CreatePurchaseRequisitionInput = z.infer<typeof createPurchaseRequisitionSchema>
export type UpdatePurchaseRequisitionInput = z.infer<typeof updatePurchaseRequisitionSchema>
export type PurchaseRequisitionLineInput = z.infer<typeof purchaseRequisitionLineInputSchema>
export type RejectPurchaseRequisitionInput = z.infer<typeof rejectPurchaseRequisitionSchema>
export type SendBackPurchaseRequisitionInput = z.infer<typeof sendBackPurchaseRequisitionSchema>
export type LifecycleRemarksInput = z.infer<typeof lifecycleRemarksSchema>
