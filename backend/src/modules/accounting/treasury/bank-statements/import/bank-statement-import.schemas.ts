import { z } from 'zod'
import {
  bankStatementMappingConfigSchema,
  bankStatementParsingConfigSchema,
} from '../bank-statement.schemas.js'

export const createImportBatchBodySchema = z.object({
  treasuryAccountId: z.string().uuid(),
  importFormat: z.enum(['CSV', 'XLSX', 'MT940', 'CAMT_053', 'AUTO_DETECT']),
  mappingTemplateId: z.string().uuid().optional(),
})

export const inspectImportBatchSchema = z.object({
  expectedUpdatedAt: z.string().datetime().optional(),
  parsingConfig: bankStatementParsingConfigSchema.optional(),
  mappingConfig: bankStatementMappingConfigSchema.optional(),
})

export const previewImportBatchSchema = inspectImportBatchSchema.extend({
  statementReference: z.string().trim().max(64).optional(),
  headerOverrides: z
    .object({
      openingBalance: z.coerce.number().optional(),
      closingBalance: z.coerce.number().optional(),
      statementReference: z.string().trim().max(64).optional(),
    })
    .optional(),
})

export const executeImportBatchSchema = previewImportBatchSchema.extend({
  allowPartial: z.boolean().default(false),
  confirmPartialImport: z.boolean().default(false),
  duplicatePolicy: z.enum(['BLOCK', 'WARN', 'ALLOW_WITH_REVIEW']).optional(),
})

export const importBatchLifecycleSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  reason: z.string().trim().max(500).optional(),
})

export type CreateImportBatchBody = z.infer<typeof createImportBatchBodySchema>
export type InspectImportBatchInput = z.infer<typeof inspectImportBatchSchema>
export type PreviewImportBatchInput = z.infer<typeof previewImportBatchSchema>
export type ExecuteImportBatchInput = z.infer<typeof executeImportBatchSchema>
export type ImportBatchLifecycleInput = z.infer<typeof importBatchLifecycleSchema>
