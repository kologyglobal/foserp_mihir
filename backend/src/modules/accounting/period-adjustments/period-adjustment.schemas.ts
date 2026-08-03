import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const PERIOD_ADJUSTMENT_KINDS = ['ACCRUAL', 'PREPAID'] as const
export const PERIOD_ADJUSTMENT_STATUSES = [
  'DRAFT',
  'READY_TO_POST',
  'POSTED',
  'PARTIALLY_RECOGNISED',
  'FULLY_RECOGNISED',
  'REVERSED',
  'CANCELLED',
] as const

const amountSchema = z
  .union([z.number(), z.string()])
  .transform((value) => String(value))
  .refine((value) => /^\d+(\.\d{1,4})?$/.test(value), 'Amount must be a positive number with up to 4 decimals')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero')

export const listPeriodAdjustmentsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  kind: z.enum(PERIOD_ADJUSTMENT_KINDS).optional(),
  status: z.enum(PERIOD_ADJUSTMENT_STATUSES).optional(),
  periodId: z.string().uuid().optional(),
})

const baseAdjustmentSchema = z.object({
  legalEntityId: z.string().uuid(),
  periodId: z.string().uuid(),
  description: z.string().trim().min(1).max(300),
  narration: z.string().trim().max(500).optional(),
  totalAmount: amountSchema,
  expenseAccountId: z.string().uuid(),
  /** Accrual liability / prepaid asset account. Falls back to the default account mapping. */
  balanceSheetAccountId: z.string().uuid().optional(),
  costCentreId: z.string().uuid().optional(),
  departmentReference: z.string().trim().max(64).optional(),
  projectReference: z.string().trim().max(64).optional(),
})

export const createPeriodAdjustmentSchema = z
  .discriminatedUnion('kind', [
    baseAdjustmentSchema.extend({
      kind: z.literal('ACCRUAL'),
      autoReverse: z.boolean().optional(),
    }),
    baseAdjustmentSchema.extend({
      kind: z.literal('PREPAID'),
      numberOfPeriods: z.coerce.number().int().min(1).max(120),
    }),
  ])

export const updatePeriodAdjustmentSchema = z.object({
  description: z.string().trim().min(1).max(300).optional(),
  narration: z.string().trim().max(500).nullable().optional(),
  totalAmount: amountSchema.optional(),
  expenseAccountId: z.string().uuid().optional(),
  balanceSheetAccountId: z.string().uuid().optional(),
  costCentreId: z.string().uuid().nullable().optional(),
  departmentReference: z.string().trim().max(64).nullable().optional(),
  projectReference: z.string().trim().max(64).nullable().optional(),
  periodId: z.string().uuid().optional(),
  autoReverse: z.boolean().optional(),
  numberOfPeriods: z.coerce.number().int().min(1).max(120).optional(),
})

export const cancelPeriodAdjustmentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export const reversePeriodAdjustmentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  /** Defaults to the first day of the following accounting period. */
  reversalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'reversalDate must be YYYY-MM-DD')
    .optional(),
})

export const recognisePrepaidScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
})

export type ListPeriodAdjustmentsQuery = z.infer<typeof listPeriodAdjustmentsQuerySchema>
export type CreatePeriodAdjustmentInput = z.infer<typeof createPeriodAdjustmentSchema>
export type UpdatePeriodAdjustmentInput = z.infer<typeof updatePeriodAdjustmentSchema>
export type CancelPeriodAdjustmentInput = z.infer<typeof cancelPeriodAdjustmentSchema>
export type ReversePeriodAdjustmentInput = z.infer<typeof reversePeriodAdjustmentSchema>
export type RecognisePrepaidScheduleInput = z.infer<typeof recognisePrepaidScheduleSchema>
