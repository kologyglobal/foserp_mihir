import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../legal-entities/legal-entity.validation.js'

export const tallyConfigQuerySchema = legalEntityIdQuerySchema

export const upsertTallyConfigSchema = z.object({
  legalEntityId: z.string().uuid(),
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  configJson: z
    .object({
      companyName: z.string().trim().max(200).optional(),
      gstin: z.string().trim().max(20).optional(),
      hostHint: z.string().trim().max(200).optional(),
      portHint: z.coerce.number().int().min(1).max(65535).optional(),
      exportVoucherTypes: z.array(z.string().trim().max(32)).max(20).optional(),
    })
    .passthrough()
    .optional(),
})

export const tallyLifecycleSchema = z.object({
  legalEntityId: z.string().uuid(),
})

export const listTallyMappingsQuerySchema = legalEntityIdQuerySchema

export const upsertTallyMappingsSchema = z.object({
  legalEntityId: z.string().uuid(),
  items: z
    .array(
      z.object({
        accountId: z.string().uuid(),
        tallyLedgerName: z.string().trim().min(1).max(300),
        tallyParentGroup: z.string().trim().max(200).nullable().optional(),
        tallyGuid: z.string().trim().max(64).nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(500),
})

export const listTallyOutboxQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema).extend({
  status: z.enum(['PENDING', 'RENDERING', 'READY', 'EXPORTED', 'FAILED', 'CANCELLED']).optional(),
})

export const enqueueTallyOutboxSchema = z.object({
  legalEntityId: z.string().uuid(),
  voucherIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  postingDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  postingDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  voucherType: z.enum(['JOURNAL']).optional().default('JOURNAL'),
})

export type UpsertTallyConfigInput = z.infer<typeof upsertTallyConfigSchema>
export type UpsertTallyMappingsInput = z.infer<typeof upsertTallyMappingsSchema>
export type EnqueueTallyOutboxInput = z.infer<typeof enqueueTallyOutboxSchema>
export type ListTallyOutboxQuery = z.infer<typeof listTallyOutboxQuerySchema>
