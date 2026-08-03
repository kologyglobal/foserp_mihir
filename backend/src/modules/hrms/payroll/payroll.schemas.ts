import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const payrollPeriodStatuses = ['OPEN', 'PROCESSING', 'CLOSED'] as const
export const payrollRunStatuses = ['DRAFT', 'CALCULATED', 'REVIEWED', 'FINALIZED', 'CANCELLED'] as const
export const payrollEmployeeResultStatuses = ['PENDING', 'CALCULATED', 'EXCLUDED', 'ERROR', 'FINALIZED'] as const
export const payrollExceptionSeverities = ['BLOCKER', 'WARNING'] as const

const boolQueryFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'))

// ─── Periods ─────────────────────────────────────────────────────────────────

export const listPeriodsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: z.enum(payrollPeriodStatuses).optional(),
})

export const createPeriodSchema = z.object({
  legalEntityId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
})

export const periodIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  periodId: z.string().uuid(),
})

// ─── Runs ────────────────────────────────────────────────────────────────────

export const listRunsQuerySchema = paginationSchema.extend({
  payrollPeriodId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  status: z.enum(payrollRunStatuses).optional(),
})

export const createRunSchema = z.object({
  payrollPeriodId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  code: z.string().trim().min(1).max(32).optional(),
})

export const runIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  runId: z.string().uuid(),
})

// ─── Employee results & exceptions ──────────────────────────────────────────

export const listEmployeeResultsQuerySchema = paginationSchema.extend({
  status: z.enum(payrollEmployeeResultStatuses).optional(),
})

export const employeeResultIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  runId: z.string().uuid(),
  employeeResultId: z.string().uuid(),
})

export const listExceptionsQuerySchema = paginationSchema.extend({
  severity: z.enum(payrollExceptionSeverities).optional(),
  resolved: boolQueryFlag,
  code: z.string().trim().optional(),
})

export type ListPeriodsQuery = z.infer<typeof listPeriodsQuerySchema>
export type CreatePeriodInput = z.infer<typeof createPeriodSchema>
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>
export type CreateRunInput = z.infer<typeof createRunSchema>
export type ListEmployeeResultsQuery = z.infer<typeof listEmployeeResultsQuerySchema>
export type ListExceptionsQuery = z.infer<typeof listExceptionsQuerySchema>

// ─── Phase 9 — Payslips ──────────────────────────────────────────────────────

export const payslipPaymentStatuses = ['UNPAID', 'PARTIAL', 'PAID', 'FAILED'] as const

export const listPayslipsQuerySchema = paginationSchema.extend({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  paymentStatus: z.enum(payslipPaymentStatuses).optional(),
  payrollRunId: z.string().uuid().optional(),
})

export const listMyPayslipsQuerySchema = paginationSchema.extend({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  paymentStatus: z.enum(payslipPaymentStatuses).optional(),
  payrollRunId: z.string().uuid().optional(),
})

export const payslipIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  payslipId: z.string().uuid(),
})

export type ListPayslipsQuery = z.infer<typeof listPayslipsQuerySchema>
export type ListMyPayslipsQuery = z.infer<typeof listMyPayslipsQuerySchema>

// ─── Phase 9 — Salary payment batches ───────────────────────────────────────

export const salaryPaymentBatchStatuses = ['DRAFT', 'READY', 'APPROVED', 'PAID', 'CANCELLED'] as const

export const createPaymentBatchSchema = z.object({
  payrollRunId: z.string().uuid(),
  treasuryAccountId: z.string().uuid(),
  paymentDate: z.string().min(1),
  reference: z.string().trim().max(120).optional(),
  employeeIds: z.array(z.string().uuid()).optional(),
  skipInvalidEmployees: z.boolean().optional(),
})

export const listPaymentBatchesQuerySchema = paginationSchema.extend({
  payrollRunId: z.string().uuid().optional(),
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  status: z.enum(salaryPaymentBatchStatuses).optional(),
})

export const batchIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  batchId: z.string().uuid(),
})

export const confirmPaymentSchema = z.object({
  lineIds: z.array(z.string().uuid()).optional(),
  failedLineIds: z
    .array(
      z.object({
        id: z.string().uuid(),
        reason: z.string().trim().min(1).max(500),
      }),
    )
    .optional(),
})

export type CreatePaymentBatchInput = z.infer<typeof createPaymentBatchSchema>
export type ListPaymentBatchesQuery = z.infer<typeof listPaymentBatchesQuerySchema>
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>
