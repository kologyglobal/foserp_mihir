import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'
import { lineTemplateSchema } from '../adjustments/classification/bank-posting-rule.schemas.js'
import { treasuryAdjustmentDirectionSchema, treasuryAdjustmentTypeSchema } from '../adjustments/treasury-adjustment.schemas.js'

const isoDateString = z.string().trim().min(8).max(32)

export const frequencySchema = z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'])
export const amountModeSchema = z.enum(['FIXED', 'VARIABLE'])
export const standingInstructionStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED'])

const baseStandingInstructionSchema = z
  .object({
    legalEntityId: z.string().uuid(),
    branchId: z.string().uuid().nullable().optional(),
    treasuryAccountId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    adjustmentType: treasuryAdjustmentTypeSchema,
    direction: treasuryAdjustmentDirectionSchema,
    frequency: frequencySchema,
    amountMode: amountModeSchema,
    fixedAmount: z.union([z.string(), z.number()]).nullable().optional(),
    startDate: isoDateString,
    endDate: isoDateString.nullable().optional(),
    lineTemplate: lineTemplateSchema,
    narrationTemplate: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amountMode === 'FIXED' && data.fixedAmount == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fixedAmount'], message: 'fixedAmount is required when amountMode is FIXED' })
    }
  })

export const createStandingInstructionSchema = baseStandingInstructionSchema
export const updateStandingInstructionSchema = baseStandingInstructionSchema.and(z.object({ expectedUpdatedAt: z.string().datetime() }))

export const listStandingInstructionsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  status: standingInstructionStatusSchema.optional(),
  treasuryAccountId: z.string().uuid().optional(),
})

export const expectedUpdatedAtSchema = z.object({ expectedUpdatedAt: z.string().datetime() })
export const pauseStandingInstructionSchema = expectedUpdatedAtSchema
export const resumeStandingInstructionSchema = expectedUpdatedAtSchema
export const cancelStandingInstructionSchema = expectedUpdatedAtSchema.extend({ reason: z.string().trim().min(1).max(500) })

export const generateDueDraftsSchema = z.object({
  legalEntityId: z.string().uuid(),
  asOfDate: isoDateString.optional(),
  standingInstructionId: z.string().uuid().optional(),
  amountOverrides: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
})

export type CreateStandingInstructionInput = z.infer<typeof createStandingInstructionSchema>
export type UpdateStandingInstructionInput = z.infer<typeof updateStandingInstructionSchema>
export type ListStandingInstructionsQuery = z.infer<typeof listStandingInstructionsQuerySchema>
export type PauseStandingInstructionInput = z.infer<typeof pauseStandingInstructionSchema>
export type ResumeStandingInstructionInput = z.infer<typeof resumeStandingInstructionSchema>
export type CancelStandingInstructionInput = z.infer<typeof cancelStandingInstructionSchema>
export type GenerateDueDraftsInput = z.infer<typeof generateDueDraftsSchema>
