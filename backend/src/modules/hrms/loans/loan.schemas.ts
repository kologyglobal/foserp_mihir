import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const loanTypes = ['LOAN', 'SALARY_ADVANCE'] as const
export const loanStatuses = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'DISBURSED',
  'RECOVERING',
  'CLOSED',
  'CANCELLED',
] as const
export const loanDisbursementMethods = ['BANK', 'CASH'] as const
export const loanRepaymentMethods = ['BANK', 'CASH', 'OTHER'] as const

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const createLoanSchema = z.object({
  employeeId: z.string().uuid().optional(),
  type: z.enum(loanTypes),
  requestDate: dateOnly,
  requestedAmount: z.number().positive(),
  reason: z.string().trim().min(1).max(1000).optional(),
})

export const updateLoanDraftSchema = z.object({
  type: z.enum(loanTypes).optional(),
  requestDate: dateOnly.optional(),
  requestedAmount: z.number().positive().optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
})

export const approveLoanSchema = z.object({
  approvedAmount: z.number().positive().optional(),
  installmentAmount: z.number().positive().optional(),
  installmentCount: z.number().int().positive().optional(),
  recoveryStartYear: z.number().int().min(2000).max(2100),
  recoveryStartMonth: z.number().int().min(1).max(12),
})

export const rejectLoanSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const cancelLoanSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
})

export const disburseLoanSchema = z.object({
  treasuryAccountId: z.string().uuid(),
  method: z.enum(loanDisbursementMethods),
  paymentDate: dateOnly,
  reference: z.string().trim().max(120).optional(),
})

export const skipInstallmentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const partialRecoverSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().trim().min(1).max(500),
})

export const earlyRepaymentSchema = z.object({
  amount: z.number().positive(),
  date: dateOnly,
  method: z.enum(loanRepaymentMethods),
  treasuryAccountId: z.string().uuid().optional(),
  reference: z.string().trim().max(120).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
})

export const changeFutureInstallmentSchema = z.object({
  installmentAmount: z.number().positive(),
  reason: z.string().trim().min(1).max(500),
})

export const listLoansQuerySchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  type: z.enum(loanTypes).optional(),
  status: z.enum(loanStatuses).optional(),
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
})

export const listMyLoansQuerySchema = paginationSchema.extend({
  type: z.enum(loanTypes).optional(),
  status: z.enum(loanStatuses).optional(),
})

export const loanIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  loanId: z.string().uuid(),
})

export const loanScheduleIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  loanId: z.string().uuid(),
  scheduleId: z.string().uuid(),
})

export const loanAccountingQuerySchema = z.object({
  status: z.enum(['POSTED', 'PENDING']).optional(),
})

export type CreateLoanInput = z.infer<typeof createLoanSchema>
export type UpdateLoanDraftInput = z.infer<typeof updateLoanDraftSchema>
export type ApproveLoanInput = z.infer<typeof approveLoanSchema>
export type RejectLoanInput = z.infer<typeof rejectLoanSchema>
export type CancelLoanInput = z.infer<typeof cancelLoanSchema>
export type DisburseLoanInput = z.infer<typeof disburseLoanSchema>
export type SkipInstallmentInput = z.infer<typeof skipInstallmentSchema>
export type PartialRecoverInput = z.infer<typeof partialRecoverSchema>
export type EarlyRepaymentInput = z.infer<typeof earlyRepaymentSchema>
export type ChangeFutureInstallmentInput = z.infer<typeof changeFutureInstallmentSchema>
export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>
export type ListMyLoansQuery = z.infer<typeof listMyLoansQuerySchema>
export type LoanAccountingQuery = z.infer<typeof loanAccountingQuerySchema>
