import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const statutoryRuleTypes = ['PF', 'ESIC', 'PROFESSIONAL_TAX', 'TDS', 'LWF', 'BONUS', 'GRATUITY'] as const
export const statutoryRuleStatuses = ['DRAFT', 'ACTIVE', 'SUPERSEDED'] as const
export const statutoryRoundingModes = ['NONE', 'NEAREST', 'UP', 'DOWN'] as const
export const statutoryRegisterKinds = ['pf', 'esic', 'pt', 'tds', 'lwf'] as const

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const tenantRouteFields = {
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export const listRulesQuerySchema = paginationSchema.extend({
  type: z.enum(statutoryRuleTypes).optional(),
  legalEntityId: z.string().uuid().optional(),
  stateCode: z.string().trim().max(8).optional(),
  status: z.enum(statutoryRuleStatuses).optional(),
})

export const createRuleSchema = z.object({
  type: z.enum(statutoryRuleTypes),
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(150),
  legalEntityId: z.string().uuid().nullable().optional(),
  stateCode: z.string().trim().max(8).nullable().optional(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
  employeeRatePct: z.number().min(0).max(100).nullable().optional(),
  employerRatePct: z.number().min(0).max(100).nullable().optional(),
  wageCeiling: z.number().nonnegative().nullable().optional(),
  eligibilityWageCeiling: z.number().nonnegative().nullable().optional(),
  roundingMode: z.enum(statutoryRoundingModes).optional(),
  frequency: z.string().trim().max(16).nullable().optional(),
  employeeFixedAmount: z.number().nonnegative().nullable().optional(),
  employerFixedAmount: z.number().nonnegative().nullable().optional(),
  configJson: z.record(z.unknown()).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const updateRuleSchema = createRuleSchema.omit({ type: true }).partial()

export const ruleIdParamSchema = z.object({
  ...tenantRouteFields,
  ruleId: z.string().uuid(),
})

export const wageBasisLineInputSchema = z.object({
  componentCode: z.string().trim().min(1).max(32),
  salaryComponentId: z.string().uuid().nullable().optional(),
  sequence: z.number().int().min(0).max(9999).optional(),
  include: z.boolean().optional(),
})

export const putWageBasisSchema = z.object({
  lines: z.array(wageBasisLineInputSchema),
})

export const ptSlabInputSchema = z
  .object({
    fromAmount: z.number().nonnegative(),
    toAmount: z.number().nonnegative().nullable().optional(),
    taxAmount: z.number().nonnegative(),
    specialMonth: z.number().int().min(1).max(12).nullable().optional(),
    sequence: z.number().int().min(0).max(9999).optional(),
  })
  .refine((s) => s.toAmount == null || s.toAmount >= s.fromAmount, {
    message: 'toAmount must be greater than or equal to fromAmount',
  })

export const putPtSlabsSchema = z.object({
  slabs: z.array(ptSlabInputSchema),
})

// ─── Employee profile ────────────────────────────────────────────────────────

export const statutoryEmployeeIdParamSchema = z.object({
  ...tenantRouteFields,
  employeeId: z.string().uuid(),
})

export const updateEmployeeStatutoryProfileSchema = z
  .object({
    pfApplicable: z.boolean().nullable().optional(),
    esicApplicable: z.boolean().nullable().optional(),
    ptApplicable: z.boolean().nullable().optional(),
    tdsApplicable: z.boolean().nullable().optional(),
    lwfApplicable: z.boolean().nullable().optional(),
    taxRegime: z.enum(['OLD', 'NEW']).nullable().optional(),
    previousEmploymentIncome: z.number().nonnegative().nullable().optional(),
    declaredDeductions: z.number().nonnegative().nullable().optional(),
    taxAlreadyDeducted: z.number().nonnegative().nullable().optional(),
    tdsManualMonthly: z.number().nonnegative().nullable().optional(),
    tdsManualReason: z.string().trim().max(500).nullable().optional(),
    overrideReason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' })

// ─── Resolve helper ──────────────────────────────────────────────────────────

export const resolveRuleQuerySchema = z.object({
  type: z.enum(statutoryRuleTypes),
  employeeId: z.string().uuid(),
  date: isoDate.optional(),
})

// ─── Registers ───────────────────────────────────────────────────────────────

export const registerQuerySchema = paginationSchema.extend({
  payrollPeriodId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
})

export const registerKindParamSchema = z.object({
  ...tenantRouteFields,
  kind: z.enum(statutoryRegisterKinds),
})

export type ListRulesQuery = z.infer<typeof listRulesQuerySchema>
export type CreateRuleInput = z.infer<typeof createRuleSchema>
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>
export type WageBasisLineInput = z.infer<typeof wageBasisLineInputSchema>
export type PutWageBasisInput = z.infer<typeof putWageBasisSchema>
export type PtSlabInput = z.infer<typeof ptSlabInputSchema>
export type PutPtSlabsInput = z.infer<typeof putPtSlabsSchema>
export type UpdateEmployeeStatutoryProfileInput = z.infer<typeof updateEmployeeStatutoryProfileSchema>
export type ResolveRuleQuery = z.infer<typeof resolveRuleQuerySchema>
export type RegisterQuery = z.infer<typeof registerQuerySchema>
