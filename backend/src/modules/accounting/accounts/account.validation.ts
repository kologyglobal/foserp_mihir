import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../legal-entities/legal-entity.validation.js'

export const listAccountsQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema).extend({
  category: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (typeof v === 'boolean') return v
      return v === 'true' || v === '1'
    }),
})

export const accountTreeQuerySchema = legalEntityIdQuerySchema.extend({
  includeInactive: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
})

const accountBaseSchema = z.object({
  legalEntityId: z.string().uuid(),
  accountCode: z.string().trim().min(1).max(32),
  accountName: z.string().trim().min(1).max(200),
  parentAccountId: z.string().uuid().nullable().optional(),
  category: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  accountType: z
    .enum([
      'GENERAL', 'BANK', 'CASH', 'CUSTOMER_RECEIVABLE', 'VENDOR_PAYABLE',
      'RAW_MATERIAL_INVENTORY', 'WIP_INVENTORY', 'FINISHED_GOODS_INVENTORY',
      'FIXED_ASSET', 'ACCUMULATED_DEPRECIATION', 'GST_INPUT', 'GST_OUTPUT',
      'TDS_RECEIVABLE', 'TDS_PAYABLE', 'SALES', 'SALES_RETURN', 'PURCHASE',
      'PURCHASE_RETURN', 'EXPENSE', 'OTHER_INCOME', 'PRODUCTION_VARIANCE', 'RETAINED_EARNINGS',
    ])
    .default('GENERAL'),
  isGroup: z.boolean().default(false),
  isControlAccount: z.boolean().optional(),
  allowManualPosting: z.boolean().optional(),
  normalBalance: z.enum(['DEBIT', 'CREDIT']).default('DEBIT'),
  currencyCode: z.string().trim().max(8).optional(),
  requiresParty: z.boolean().optional(),
  requiresReconciliation: z.boolean().optional(),
  description: z.string().trim().max(5000).optional(),
})

export const createAccountSchema = accountBaseSchema
export const updateAccountSchema = accountBaseSchema.partial().omit({ legalEntityId: true })

export const applyTemplateSchema = z.object({
  legalEntityId: z.string().uuid(),
  templateId: z.enum(['MANUFACTURING', 'TRADING', 'SERVICE', 'JOB_WORK']),
})

export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>
export type AccountTreeQuery = z.infer<typeof accountTreeQuerySchema>
export type CreateAccountInput = z.infer<typeof createAccountSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>
