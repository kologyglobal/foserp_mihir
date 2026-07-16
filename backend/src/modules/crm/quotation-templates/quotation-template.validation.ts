import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const sectionSchema = z.object({
  sectionType: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(300),
  content: z.string().optional(),
  sequenceNo: z.coerce.number().int().min(0),
  editable: z.boolean().optional(),
  contentFormat: z.enum(['richtext', 'spec_table', 'key_value_list']).optional(),
  specRows: z.array(z.record(z.unknown())).optional(),
  masterCode: z.string().nullable().optional(),
}).passthrough()

const printLayoutSchema = z
  .object({
    pageSize: z.enum(['A4', 'Letter']).optional(),
    marginMm: z.coerce.number().optional(),
    fontScale: z.coerce.number().optional(),
    headerStyle: z.enum(['standard', 'minimal', 'cover']).optional(),
    showLogo: z.boolean().optional(),
    showCompanyHeader: z.boolean().optional(),
    showCustomerBlock: z.boolean().optional(),
    showPageFooter: z.boolean().optional(),
    showSignatureBlock: z.boolean().optional(),
    pageBreakBefore: z.array(z.string()).optional(),
  })
  .passthrough()
  .optional()
  .nullable()

export const listQuotationTemplatesQuerySchema = paginationSchema.extend({
  productFamily: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().optional(),
})

export const createQuotationTemplateSchema = z.object({
  code: z.string().trim().min(1).max(64).optional(),
  templateName: z.string().trim().min(1).max(200),
  productFamily: z.string().trim().min(1).max(100).default('Custom'),
  version: z.coerce.number().int().min(1).optional(),
  sections: z.array(sectionSchema).optional(),
  defaultTerms: z.string().optional(),
  defaultWarranty: z.string().optional(),
  defaultExclusions: z.string().optional(),
  printLayout: printLayoutSchema,
  isActive: z.boolean().optional(),
  sourceTemplateId: z.string().uuid().optional(),
})

export const updateQuotationTemplateSchema = z.object({
  templateName: z.string().trim().min(1).max(200).optional(),
  productFamily: z.string().trim().min(1).max(100).optional(),
  version: z.coerce.number().int().min(1).optional(),
  sections: z.array(sectionSchema).optional(),
  defaultTerms: z.string().optional(),
  defaultWarranty: z.string().optional(),
  defaultExclusions: z.string().optional(),
  printLayout: printLayoutSchema,
  isActive: z.boolean().optional(),
})

export const duplicateQuotationTemplateSchema = z.object({
  templateName: z.string().trim().min(1).max(200).optional(),
})

export type ListQuotationTemplatesQuery = z.infer<typeof listQuotationTemplatesQuerySchema>
export type CreateQuotationTemplateInput = z.infer<typeof createQuotationTemplateSchema>
export type UpdateQuotationTemplateInput = z.infer<typeof updateQuotationTemplateSchema>
export type DuplicateQuotationTemplateInput = z.infer<typeof duplicateQuotationTemplateSchema>
