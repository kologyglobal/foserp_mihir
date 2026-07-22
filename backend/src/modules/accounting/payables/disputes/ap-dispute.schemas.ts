import { z } from 'zod'

export const apDisputeStatusSchema = z.enum([
  'OPEN',
  'UNDER_REVIEW',
  'AWAITING_VENDOR',
  'AWAITING_INTERNAL_TEAM',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
])

export const apDisputeTypeSchema = z.enum([
  'PRICE_DIFFERENCE',
  'QUANTITY_DIFFERENCE',
  'QUALITY_ISSUE',
  'DELIVERY_DELAY',
  'SHORT_SUPPLY',
  'TAX_ISSUE',
  'MISSING_DOCUMENT',
  'DUPLICATE_INVOICE',
  'COMMERCIAL_TERMS',
  'OTHER',
])

export const apDisputePrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

const amount = z.union([z.string(), z.number()]).transform(String)

export const listApDisputesQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  status: apDisputeStatusSchema.optional(),
  vendorId: z.string().uuid().optional(),
  vendorInvoiceId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const createApDisputeSchema = z.object({
  legalEntityId: z.string().uuid(),
  vendorInvoiceId: z.string().uuid(),
  disputeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  disputeType: apDisputeTypeSchema,
  disputedAmount: amount,
  description: z.string().min(1).max(4000),
  ownerName: z.string().min(1).max(200),
  responsibleDepartment: z.string().min(1).max(120),
  priority: apDisputePrioritySchema.default('MEDIUM'),
  targetResolutionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  debitNoteRequired: z.boolean().default(false),
  paymentHold: z.boolean().default(false),
  supportingDocuments: z.array(z.string().max(300)).max(20).optional(),
})

export const updateApDisputeSchema = z.object({
  disputeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  disputeType: apDisputeTypeSchema.optional(),
  disputedAmount: amount.optional(),
  description: z.string().min(1).max(4000).optional(),
  ownerName: z.string().min(1).max(200).optional(),
  responsibleDepartment: z.string().min(1).max(120).optional(),
  priority: apDisputePrioritySchema.optional(),
  targetResolutionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  debitNoteRequired: z.boolean().optional(),
  paymentHold: z.boolean().optional(),
  supportingDocuments: z.array(z.string().max(300)).max(20).optional(),
  updatedAt: z.string().datetime().optional(),
})

export const transitionApDisputeSchema = z.object({
  status: apDisputeStatusSchema,
  resolution: z.string().max(4000).nullable().optional(),
})

export type ListApDisputesQueryInput = z.infer<typeof listApDisputesQuerySchema>
export type CreateApDisputeInput = z.infer<typeof createApDisputeSchema>
export type UpdateApDisputeInput = z.infer<typeof updateApDisputeSchema>
export type TransitionApDisputeInput = z.infer<typeof transitionApDisputeSchema>
