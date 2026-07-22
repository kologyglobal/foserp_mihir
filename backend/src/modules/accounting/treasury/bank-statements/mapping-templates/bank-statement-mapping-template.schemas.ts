import { z } from 'zod'
import { paginationSchema } from '../../../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../../../legal-entities/legal-entity.validation.js'
import {
  bankStatementMappingConfigSchema,
  bankStatementParsingConfigSchema,
} from '../bank-statement.schemas.js'

export const createMappingTemplateSchema = z.object({
  legalEntityId: z.string().uuid(),
  treasuryAccountId: z.string().uuid().nullable().optional(),
  bankNameKey: z.string().trim().max(200).optional(),
  name: z.string().trim().min(1).max(120),
  importFormat: z.enum(['CSV', 'XLSX', 'MANUAL']),
  isDefault: z.boolean().default(false),
  sheetNamePattern: z.string().trim().max(120).optional(),
  headerRowNumber: z.coerce.number().int().min(1).optional(),
  dataStartRowNumber: z.coerce.number().int().min(1).optional(),
  delimiter: z.string().max(8).optional(),
  encoding: z.string().max(32).optional(),
  mappingConfig: bankStatementMappingConfigSchema,
  parsingConfig: bankStatementParsingConfigSchema.optional(),
})

export const updateMappingTemplateSchema = createMappingTemplateSchema
  .omit({ legalEntityId: true })
  .partial()
  .extend({ expectedUpdatedAt: z.string().datetime() })

export const mappingTemplateLifecycleSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
})

export const listMappingTemplatesQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema).extend({
  treasuryAccountId: z.string().uuid().optional(),
  importFormat: z.enum(['CSV', 'XLSX', 'MANUAL']).optional(),
  isActive: z.coerce.boolean().optional(),
})

export type CreateMappingTemplateInput = z.infer<typeof createMappingTemplateSchema>
export type UpdateMappingTemplateInput = z.infer<typeof updateMappingTemplateSchema>
export type ListMappingTemplatesQuery = z.infer<typeof listMappingTemplatesQuerySchema>
