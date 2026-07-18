import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { optionalUuid } from '../../../utils/zodHelpers.js'
import { OPPORTUNITY_PRIORITIES, OPPORTUNITY_STAGES, OPPORTUNITY_STATUSES } from './opportunity.constants.js'

const lineInputSchema = z
  .object({
  lineNo: z.coerce.number().int().min(1).optional(),
  productId: z.string().uuid().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
  itemCode: z.string().trim().max(64).optional(),
  productOrItem: z.string().trim().min(1).max(300),
  description: z.string().trim().optional(),
  productFamily: z.string().trim().max(100).optional(),
  itemType: z.string().trim().max(64).optional(),
  qty: z.coerce.number().min(0).optional(),
  uom: z.string().trim().max(16).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  taxableValue: z.coerce.number().min(0).optional(),
  taxPct: z.coerce.number().min(0).max(100).optional(),
  gstAmount: z.coerce.number().min(0).optional(),
  lineTotal: z.coerce.number().min(0).optional(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
  remarks: z.string().trim().optional(),
})
  .superRefine((line, ctx) => {
    const hasProduct = Boolean(line.productOrItem?.trim())
    if (hasProduct && (line.unitPrice == null || line.unitPrice <= 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unit Price is required', path: ['unitPrice'] })
    }
    if (hasProduct && (line.qty == null || line.qty <= 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Quantity must be greater than zero', path: ['qty'] })
    }
  })

export const listOpportunitiesQuerySchema = paginationSchema.extend({
  customerId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  stage: z.enum(OPPORTUNITY_STAGES).optional(),
  status: z.union([z.enum(OPPORTUNITY_STATUSES), z.enum(['open', 'won', 'lost', 'on_hold', 'archived'])]).optional(),
  priority: z.enum(OPPORTUNITY_PRIORITIES).optional(),
})

export const createOpportunitySchema = z.object({
  opportunityNo: z.string().trim().max(32).optional(),
  opportunityName: z.string().trim().min(1).max(300),
  customerId: z.string().uuid(),
  contactId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid().optional(),
  stage: z.enum(OPPORTUNITY_STAGES).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  value: z.coerce.number().min(0).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  productRequirement: z.string().trim().optional(),
  priority: z.enum(OPPORTUNITY_PRIORITIES).optional(),
  status: z.union([z.enum(OPPORTUNITY_STATUSES), z.enum(['open', 'won', 'lost', 'on_hold'])]).optional(),
  healthScore: z.coerce.number().int().min(0).max(100).optional(),
  locationId: optionalUuid,
  competitor: z.string().trim().max(200).optional(),
  lines: z.array(lineInputSchema).optional(),
})

export const updateOpportunitySchema = createOpportunitySchema.partial().extend({
  customerId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
})

export const winOpportunitySchema = z.object({
  winReason: z.string().trim().optional(),
  stageId: z.string().uuid().optional(),
})

export const loseOpportunitySchema = z.object({
  lostReason: z.string().trim().min(1),
  stageId: z.string().uuid().optional(),
})

export const reopenOpportunitySchema = z.object({
  stageId: z.string().uuid().optional(),
  reason: z.string().trim().optional(),
})

export const assignOpportunitySchema = z.object({
  ownerId: z.string().uuid(),
  notes: z.string().trim().optional(),
})

export const moveStageOpportunitySchema = z.object({
  stageId: z.string().uuid(),
  reason: z.string().trim().optional(),
})

export type ListOpportunitiesQuery = z.infer<typeof listOpportunitiesQuerySchema>
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>
export type WinOpportunityInput = z.infer<typeof winOpportunitySchema>
export type LoseOpportunityInput = z.infer<typeof loseOpportunitySchema>
export type ReopenOpportunityInput = z.infer<typeof reopenOpportunitySchema>
export type AssignOpportunityInput = z.infer<typeof assignOpportunitySchema>
export type MoveStageOpportunityInput = z.infer<typeof moveStageOpportunitySchema>
export type LineInput = z.infer<typeof lineInputSchema>
