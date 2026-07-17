import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../legal-entities/legal-entity.validation.js'

export const listApprovalRulesQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema).extend({
  documentType: z.string().trim().max(64).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (typeof v === 'boolean') return v
      return v === 'true' || v === '1'
    }),
})

export const createApprovalRuleSchema = z.object({
  legalEntityId: z.string().uuid(),
  documentType: z.string().trim().min(1).max(64),
  ruleName: z.string().trim().min(1).max(200),
  amountFrom: z.coerce.number().min(0).default(0),
  amountTo: z.coerce.number().min(0).nullable().optional(),
  conditionJson: z.record(z.unknown()).optional(),
  approverRoleId: z.string().uuid().nullable().optional(),
  approverUserId: z.string().uuid().nullable().optional(),
  approvalLevel: z.coerce.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
})

export const updateApprovalRuleSchema = createApprovalRuleSchema.partial().omit({ legalEntityId: true })

export type ListApprovalRulesQuery = z.infer<typeof listApprovalRulesQuerySchema>
export type CreateApprovalRuleInput = z.infer<typeof createApprovalRuleSchema>
export type UpdateApprovalRuleInput = z.infer<typeof updateApprovalRuleSchema>
