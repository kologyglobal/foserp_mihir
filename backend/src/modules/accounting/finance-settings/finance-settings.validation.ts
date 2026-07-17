import { z } from 'zod'
import { legalEntityIdQuerySchema } from '../legal-entities/legal-entity.validation.js'

export const financeSettingsQuerySchema = legalEntityIdQuerySchema

export const upsertFinanceSettingsSchema = z.object({
  legalEntityId: z.string().uuid(),
  baseCurrency: z.string().trim().min(3).max(8).optional(),
  dateFormat: z.string().trim().max(32).optional(),
  amountPrecision: z.coerce.number().int().min(0).max(6).optional(),
  quantityPrecision: z.coerce.number().int().min(0).max(6).optional(),
  roundingMethod: z.enum(['ROUND_HALF_UP', 'ROUND_HALF_EVEN', 'ROUND_DOWN', 'ROUND_UP']).optional(),
  roundingTolerance: z.coerce.number().min(0).optional(),
  allowBackdatedPosting: z.boolean().optional(),
  backdatedDaysLimit: z.coerce.number().int().min(0).optional(),
  requireAttachmentAbove: z.coerce.number().min(0).nullable().optional(),
  receiptApprovalLimit: z.coerce.number().min(0).nullable().optional(),
  paymentApprovalLimit: z.coerce.number().min(0).nullable().optional(),
  journalApprovalLimit: z.coerce.number().min(0).nullable().optional(),
  writeOffTolerance: z.coerce.number().min(0).nullable().optional(),
  bankChargeTolerance: z.coerce.number().min(0).nullable().optional(),
  allowManualControlAccountPosting: z.boolean().optional(),
})

export const activateFinanceSchema = z.object({
  legalEntityId: z.string().uuid(),
})

export type FinanceSettingsQuery = z.infer<typeof financeSettingsQuerySchema>
export type UpsertFinanceSettingsInput = z.infer<typeof upsertFinanceSettingsSchema>
export type ActivateFinanceInput = z.infer<typeof activateFinanceSchema>

export type SetupMissingItem = {
  key: string
  label: string
  count: number
  route: string
}
