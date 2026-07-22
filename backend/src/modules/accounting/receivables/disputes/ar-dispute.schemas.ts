import { z } from 'zod'

export const arDisputeStatusSchema = z.enum([
  'OPEN',
  'UNDER_REVIEW',
  'AWAITING_CUSTOMER',
  'AWAITING_INTERNAL_TEAM',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
])

export const arDisputeTypeSchema = z.enum([
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

export const arDisputePrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

const amount = z.union([z.string(), z.number()]).transform(String)

export const listArDisputesQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  status: arDisputeStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  salesInvoiceId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const createArDisputeSchema = z.object({
  legalEntityId: z.string().uuid(),
  salesInvoiceId: z.string().uuid(),
  disputeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  disputeType: arDisputeTypeSchema,
  disputedAmount: amount,
  description: z.string().min(1).max(4000),
  ownerName: z.string().min(1).max(200),
  responsibleDepartment: z.string().min(1).max(120),
  priority: arDisputePrioritySchema.default('MEDIUM'),
  targetResolutionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  creditNoteRequired: z.boolean().default(false),
  collectionHold: z.boolean().default(false),
  supportingDocuments: z.array(z.string().max(300)).max(20).optional(),
})

export const updateArDisputeSchema = z.object({
  disputeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  disputeType: arDisputeTypeSchema.optional(),
  disputedAmount: amount.optional(),
  description: z.string().min(1).max(4000).optional(),
  ownerName: z.string().min(1).max(200).optional(),
  responsibleDepartment: z.string().min(1).max(120).optional(),
  priority: arDisputePrioritySchema.optional(),
  targetResolutionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  creditNoteRequired: z.boolean().optional(),
  collectionHold: z.boolean().optional(),
  supportingDocuments: z.array(z.string().max(300)).max(20).optional(),
  updatedAt: z.string().datetime().optional(),
})

export const transitionArDisputeSchema = z.object({
  status: arDisputeStatusSchema,
  resolution: z.string().max(4000).nullable().optional(),
})

export type ListArDisputesQueryInput = z.infer<typeof listArDisputesQuerySchema>
export type CreateArDisputeInput = z.infer<typeof createArDisputeSchema>
export type UpdateArDisputeInput = z.infer<typeof updateArDisputeSchema>
export type TransitionArDisputeInput = z.infer<typeof transitionArDisputeSchema>
