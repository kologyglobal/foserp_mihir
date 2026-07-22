import { z } from 'zod'
import { paginationSchema } from '../../../../../utils/pagination.js'
import {
  gstTreatmentSchema,
  tdsTreatmentSchema,
  treasuryAdjustmentLineTypeSchema,
  treasuryAdjustmentTypeSchema,
} from '../treasury-adjustment.schemas.js'

export const bankStatementLineDirectionSchema = z.enum(['DEBIT', 'CREDIT'])

/** Offset-line template for the single generated line — amount is always the statement line's amount at classify time. */
export const lineTemplateSchema = z.object({
  lineType: treasuryAdjustmentLineTypeSchema,
  accountId: z.string().uuid().nullable().optional(),
  mappingKey: z.string().trim().max(64).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  gstTreatment: gstTreatmentSchema.default('GST_NOT_APPLICABLE'),
  gstRate: z.union([z.string(), z.number()]).nullable().optional(),
  gstAccountId: z.string().uuid().nullable().optional(),
  gstMappingKey: z.string().trim().max(64).nullable().optional(),
  tdsTreatment: tdsTreatmentSchema.default('TDS_NOT_APPLICABLE'),
  tdsRate: z.union([z.string(), z.number()]).nullable().optional(),
  tdsAccountId: z.string().uuid().nullable().optional(),
  tdsMappingKey: z.string().trim().max(64).nullable().optional(),
  narration: z.string().trim().max(500).nullable().optional(),
})

const baseBankPostingRuleSchema = z.object({
  legalEntityId: z.string().uuid(),
  treasuryAccountId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().int().min(1).max(9999).default(100),
  direction: bankStatementLineDirectionSchema.nullable().optional(),
  keywordPatterns: z.array(z.string().trim().min(1).max(200)).min(1, 'At least one keyword is required'),
  minAmount: z.union([z.string(), z.number()]).nullable().optional(),
  maxAmount: z.union([z.string(), z.number()]).nullable().optional(),
  adjustmentType: treasuryAdjustmentTypeSchema,
  lineTemplate: lineTemplateSchema,
})

export const createBankPostingRuleSchema = baseBankPostingRuleSchema
export const updateBankPostingRuleSchema = baseBankPostingRuleSchema.extend({ expectedUpdatedAt: z.string().datetime() })

export const listBankPostingRulesQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
  treasuryAccountId: z.string().uuid().optional(),
})

export const classifyStatementLineSchema = z.object({
  legalEntityId: z.string().uuid(),
})

export type CreateBankPostingRuleInput = z.infer<typeof createBankPostingRuleSchema>
export type UpdateBankPostingRuleInput = z.infer<typeof updateBankPostingRuleSchema>
export type ListBankPostingRulesQuery = z.infer<typeof listBankPostingRulesQuerySchema>
export type ClassifyStatementLineInput = z.infer<typeof classifyStatementLineSchema>
export type LineTemplateInput = z.infer<typeof lineTemplateSchema>
