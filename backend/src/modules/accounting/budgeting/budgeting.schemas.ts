import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const BUDGET_VERSION_STATUSES = [
  'DRAFT',
  'IN_PREPARATION',
  'PENDING_APPROVAL',
  'APPROVED',
  'LOCKED',
  'SUPERSEDED',
  'CANCELLED',
] as const

export const BUDGET_VERSION_KINDS = [
  'ORIGINAL',
  'REVISED',
  'FORECAST_1',
  'FORECAST_2',
  'BEST_CASE',
  'EXPECTED_CASE',
  'WORST_CASE',
] as const

const decimalString = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,4})?$/, 'Must be a decimal string')

const monthlyAmountsSchema = z.object({
  Apr: decimalString.default('0'),
  May: decimalString.default('0'),
  Jun: decimalString.default('0'),
  Jul: decimalString.default('0'),
  Aug: decimalString.default('0'),
  Sep: decimalString.default('0'),
  Oct: decimalString.default('0'),
  Nov: decimalString.default('0'),
  Dec: decimalString.default('0'),
  Jan: decimalString.default('0'),
  Feb: decimalString.default('0'),
  Mar: decimalString.default('0'),
})

export const overviewQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
})

export const listBudgetVersionsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  status: z.enum(BUDGET_VERSION_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
})

export const createBudgetVersionSchema = z.object({
  legalEntityId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/i, 'code must be alphanumeric with _ or -'),
  name: z.string().trim().min(2).max(200),
  kind: z.enum(BUDGET_VERSION_KINDS).default('ORIGINAL'),
  financialYearLabel: z.string().trim().min(4).max(16),
  fyStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fyEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currencyCode: z.string().trim().min(3).max(8).default('INR'),
  notes: z.string().trim().max(1000).nullable().optional(),
  isPrimary: z.boolean().optional(),
})

export const updateBudgetVersionSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  kind: z.enum(BUDGET_VERSION_KINDS).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  isPrimary: z.boolean().optional(),
  expectedUpdatedAt: z.string().datetime(),
})

export const budgetLifecycleSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  note: z.string().trim().max(500).optional(),
})

export const createBudgetLineSchema = z.object({
  accountId: z.string().uuid(),
  costCentreId: z.string().uuid().nullable().optional(),
  months: monthlyAmountsSchema,
  notes: z.string().trim().max(500).nullable().optional(),
})

export const updateBudgetLineSchema = z.object({
  costCentreId: z.string().uuid().nullable().optional(),
  months: monthlyAmountsSchema.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

export const listBudgetLinesQuerySchema = paginationSchema.extend({})

export const budgetVsActualQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  versionId: z.string().uuid(),
})

export type OverviewQuery = z.infer<typeof overviewQuerySchema>
export type ListBudgetVersionsQuery = z.infer<typeof listBudgetVersionsQuerySchema>
export type CreateBudgetVersionInput = z.infer<typeof createBudgetVersionSchema>
export type UpdateBudgetVersionInput = z.infer<typeof updateBudgetVersionSchema>
export type BudgetLifecycleInput = z.infer<typeof budgetLifecycleSchema>
export type CreateBudgetLineInput = z.infer<typeof createBudgetLineSchema>
export type UpdateBudgetLineInput = z.infer<typeof updateBudgetLineSchema>
export type BudgetVsActualQuery = z.infer<typeof budgetVsActualQuerySchema>
export type MonthlyAmountsInput = z.infer<typeof monthlyAmountsSchema>
