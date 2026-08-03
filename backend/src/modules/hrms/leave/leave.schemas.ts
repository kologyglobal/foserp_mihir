import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const leaveAccrualTypes = ['NONE', 'MONTHLY', 'YEARLY'] as const
export const leaveDurationTypes = ['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF'] as const
export const leaveRequestStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const
export const workerCategories = ['STAFF', 'WORKER', 'SUPERVISOR', 'MANAGEMENT'] as const

export const listLeaveTypesQuerySchema = paginationSchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  legalEntityId: z.string().uuid().optional(),
})

export const createLeaveTypeSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(150),
  legalEntityId: z.string().uuid().nullable().optional(),
  paid: z.boolean().optional(),
  allowHalfDay: z.boolean().optional(),
  allowNegativeBalance: z.boolean().optional(),
  carryForwardAllowed: z.boolean().optional(),
  maxCarryForward: z.number().nonnegative().nullable().optional(),
  accrualType: z.enum(leaveAccrualTypes).optional(),
  accrualValue: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial()

export const leaveTypeIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid(),
})

export const listPoliciesQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
})

export const createPolicySchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(150),
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  workerCategory: z.enum(workerCategories).nullable().optional(),
  excludeHolidays: z.boolean().optional(),
  excludeWeeklyOff: z.boolean().optional(),
  allowNegativeBalance: z.boolean().optional(),
  leaveTypeIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().optional(),
})

export const updatePolicySchema = createPolicySchema.partial().omit({ legalEntityId: true }).extend({
  legalEntityId: z.string().uuid().optional(),
})

export const policyIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  policyId: z.string().uuid(),
})

export const listBalancesQuerySchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  /** Resolves employeeId from the caller's linked HR employee record. */
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export const upsertBalanceSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  opening: z.number().optional(),
  accrued: z.number().optional(),
})

export const adjustBalanceSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  amount: z.number(),
  reason: z.string().trim().min(1).max(500),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** Controlled accrual posting — uses leave type accrualValue when amount omitted. */
export const postAccrualSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  amount: z.number().positive().optional(),
  reason: z.string().trim().min(1).max(500).optional(),
})

export const listRequestsQuerySchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid().optional(),
  status: z.enum(leaveRequestStatuses).optional(),
  departmentId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  pendingApprovals: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationType: z.enum(leaveDurationTypes).default('FULL_DAY'),
  reason: z.string().trim().min(1).max(1000),
})

export const updateLeaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  durationType: z.enum(leaveDurationTypes).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
})

export const previewLeaveSchema = z.object({
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationType: z.enum(leaveDurationTypes).default('FULL_DAY'),
})

export const rejectLeaveSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const cancelLeaveSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
})

export const leaveRequestIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  requestId: z.string().uuid(),
})

export const approvedLeaveQuerySchema = z.object({
  employeeId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>
export type CreatePolicyInput = z.infer<typeof createPolicySchema>
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>
export type ListBalancesQuery = z.infer<typeof listBalancesQuerySchema>
export type UpsertBalanceInput = z.infer<typeof upsertBalanceSchema>
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>
export type PostAccrualInput = z.infer<typeof postAccrualSchema>
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>
export type PreviewLeaveInput = z.infer<typeof previewLeaveSchema>
