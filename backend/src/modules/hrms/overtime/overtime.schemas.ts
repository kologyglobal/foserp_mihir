import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { workerCategories } from '../leave/leave.schemas.js'

export const otRecordStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const
export const otSources = ['ATTENDANCE', 'MANUAL'] as const

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const boolQueryFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'))

// ─── Policies ──────────────────────────────────────────────────────────────

export const listOtPoliciesQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
})

export const createOtPolicySchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(150),
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  workerCategory: z.enum(workerCategories).nullable().optional(),
  enabled: z.boolean().optional(),
  minimumExtraMinutes: z.number().int().min(0).max(600).optional(),
  roundingMinutes: z.number().int().min(0).max(120).optional(),
  maxOtMinutesPerDay: z.number().int().positive().max(1440).nullable().optional(),
  maxOtMinutesPerMonth: z.number().int().positive().max(20000).nullable().optional(),
  weeklyOffOtAllowed: z.boolean().optional(),
  holidayOtAllowed: z.boolean().optional(),
  leaveDayOtAllowed: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
  isActive: z.boolean().optional(),
})

export const updateOtPolicySchema = createOtPolicySchema
  .partial()
  .omit({ legalEntityId: true, effectiveFrom: true })
  .extend({
    legalEntityId: z.string().uuid().optional(),
    effectiveFrom: isoDate.optional(),
  })

export const otPolicyIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  policyId: z.string().uuid(),
})

// ─── Records ───────────────────────────────────────────────────────────────

export const listOtQuerySchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
  status: z.enum(otRecordStatuses).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  mine: boolQueryFlag,
  /** Pending overtime for the caller's direct reports (manager inbox). */
  pendingTeam: boolQueryFlag,
})

export const otIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  otId: z.string().uuid(),
})

export const createManualOtSchema = z.object({
  employeeId: z.string().uuid(),
  attendanceDate: isoDate,
  minutes: z.number().int().positive().max(1440),
  reason: z.string().trim().min(1).max(1000),
})

export const approveOtSchema = z.object({
  approvedMinutes: z.number().int().min(0).max(1440),
  reason: z.string().trim().max(500).optional(),
  overrideLimit: z.boolean().optional(),
})

export const rejectOtSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const cancelOtSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
})

export const bulkOtActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().trim().max(500).optional(),
})

export const monthlySummaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
})

export const regenerateOtSchema = z.object({
  employeeId: z.string().uuid(),
  date: isoDate,
})

export type ListOtPoliciesQuery = z.infer<typeof listOtPoliciesQuerySchema>
export type CreateOtPolicyInput = z.infer<typeof createOtPolicySchema>
export type UpdateOtPolicyInput = z.infer<typeof updateOtPolicySchema>
export type ListOtQuery = z.infer<typeof listOtQuerySchema>
export type CreateManualOtInput = z.infer<typeof createManualOtSchema>
export type ApproveOtInput = z.infer<typeof approveOtSchema>
export type RejectOtInput = z.infer<typeof rejectOtSchema>
export type CancelOtInput = z.infer<typeof cancelOtSchema>
export type BulkOtActionInput = z.infer<typeof bulkOtActionSchema>
export type MonthlySummaryQuery = z.infer<typeof monthlySummaryQuerySchema>
export type RegenerateOtInput = z.infer<typeof regenerateOtSchema>
