/**
 * Human labels + status-chip tones for HR statuses across employee, exit,
 * loan, leave, overtime, payroll, and F&F domains. Centralised so every
 * register/detail page renders the same copy and colour for a given code.
 */

/** Mirrors the tone keys accepted by DynamicsStatusChip. */
export type DynamicsStatusChipTone = 'success' | 'warning' | 'critical' | 'info' | 'neutral' | 'live' | 'pending'

const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ON_NOTICE: 'On Notice',
  INACTIVE: 'Inactive',
  EXITED: 'Exited',
}

const EMPLOYEE_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  ON_NOTICE: 'warning',
  INACTIVE: 'neutral',
  EXITED: 'critical',
}

const EXIT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  CLEARANCE_PENDING: 'Clearance Pending',
  READY_FOR_SETTLEMENT: 'Ready for Settlement',
  SETTLED: 'Settled',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

const EXIT_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'info',
  CLEARANCE_PENDING: 'warning',
  READY_FOR_SETTLEMENT: 'info',
  SETTLED: 'success',
  CLOSED: 'success',
  CANCELLED: 'critical',
}

const LOAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DISBURSED: 'Disbursed',
  RECOVERING: 'Recovering',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

const LOAN_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'info',
  REJECTED: 'critical',
  DISBURSED: 'info',
  RECOVERING: 'pending',
  CLOSED: 'success',
  CANCELLED: 'critical',
}

const LEAVE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

const LEAVE_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'critical',
  CANCELLED: 'neutral',
}

const OVERTIME_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

const OVERTIME_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'critical',
  CANCELLED: 'neutral',
}

const PAYROLL_RUN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  CALCULATED: 'Calculated',
  REVIEWED: 'Reviewed',
  FINALIZED: 'Finalized',
  CANCELLED: 'Cancelled',
}

const PAYROLL_RUN_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  DRAFT: 'neutral',
  CALCULATED: 'info',
  REVIEWED: 'pending',
  FINALIZED: 'success',
  CANCELLED: 'critical',
}

const FNF_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  CALCULATED: 'Calculated',
  REVIEWED: 'Reviewed',
  APPROVED: 'Approved',
  POSTED: 'Posted',
  PAID: 'Paid',
  CLOSED: 'Closed',
}

const FNF_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  DRAFT: 'neutral',
  CALCULATED: 'info',
  REVIEWED: 'pending',
  APPROVED: 'info',
  POSTED: 'pending',
  PAID: 'success',
  CLOSED: 'success',
}

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LEAVE: 'On Leave',
  HALF_DAY: 'Half Day',
  WEEKLY_OFF: 'Weekly Off',
  HOLIDAY: 'Holiday',
  ON_DUTY: 'On Duty',
}

const ATTENDANCE_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  PRESENT: 'success',
  ABSENT: 'critical',
  LEAVE: 'info',
  HALF_DAY: 'warning',
  WEEKLY_OFF: 'neutral',
  HOLIDAY: 'neutral',
  ON_DUTY: 'info',
}

const ATTENDANCE_EXCEPTION_TYPE_LABELS: Record<string, string> = {
  PUNCH_ON_LEAVE: 'Punch on Leave',
  PUNCH_ON_HALF_DAY_LEAVE: 'Punch on Half-day Leave',
  OTHER: 'Other',
}

const SALARY_PAYMENT_BATCH_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  READY: 'Ready',
  APPROVED: 'Approved',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
}

const SALARY_PAYMENT_BATCH_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  DRAFT: 'neutral',
  READY: 'info',
  APPROVED: 'pending',
  PAID: 'success',
  CANCELLED: 'critical',
}

const PAYSLIP_STATUS_LABELS: Record<string, string> = {
  GENERATED: 'Generated',
  VOID: 'Void',
}

const PAYSLIP_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  GENERATED: 'success',
  VOID: 'critical',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
  PAID: 'Paid',
  FAILED: 'Failed',
  READY: 'Ready',
  PENDING: 'Pending',
  SKIPPED: 'Skipped',
}

const PAYMENT_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  UNPAID: 'neutral',
  PARTIAL: 'warning',
  PAID: 'success',
  FAILED: 'critical',
  READY: 'info',
  PENDING: 'pending',
  SKIPPED: 'neutral',
}

const LOAN_SCHEDULE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  RECOVERED: 'Recovered',
  PARTIAL: 'Partially Recovered',
  SKIPPED: 'Skipped',
}

const LOAN_SCHEDULE_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  PENDING: 'pending',
  RECOVERED: 'success',
  PARTIAL: 'warning',
  SKIPPED: 'neutral',
}

const CLEARANCE_LINE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CLEARED: 'Cleared',
  WAIVED: 'Waived',
}

const CLEARANCE_LINE_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  PENDING: 'pending',
  CLEARED: 'success',
  WAIVED: 'neutral',
}

const ASSET_LINE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  RETURNED: 'Returned',
  NOT_RETURNED: 'Not Returned',
  DAMAGED: 'Damaged',
  WAIVED: 'Waived',
}

const ASSET_LINE_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  PENDING: 'pending',
  RETURNED: 'success',
  NOT_RETURNED: 'critical',
  DAMAGED: 'critical',
  WAIVED: 'neutral',
}

const SALARY_STRUCTURE_VERSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  SUPERSEDED: 'Superseded',
}

const SALARY_STRUCTURE_VERSION_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  SUPERSEDED: 'neutral',
}

const STATUTORY_RULE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  SUPERSEDED: 'Superseded',
}

const STATUTORY_RULE_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  SUPERSEDED: 'neutral',
}

const PAYROLL_PERIOD_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  PROCESSING: 'Processing',
  CLOSED: 'Closed',
}

const PAYROLL_PERIOD_STATUS_TONES: Record<string, DynamicsStatusChipTone> = {
  OPEN: 'success',
  PROCESSING: 'pending',
  CLOSED: 'neutral',
}

export type HrStatusDomain =
  | 'employee'
  | 'exit'
  | 'loan'
  | 'leave'
  | 'overtime'
  | 'payrollRun'
  | 'fnf'
  | 'attendance'
  | 'salaryPaymentBatch'
  | 'payslip'
  | 'paymentStatus'
  | 'loanSchedule'
  | 'clearanceLine'
  | 'assetLine'
  | 'salaryStructureVersion'
  | 'statutoryRule'
  | 'payrollPeriod'

const LABEL_MAPS: Record<HrStatusDomain, Record<string, string>> = {
  employee: EMPLOYEE_STATUS_LABELS,
  exit: EXIT_STATUS_LABELS,
  loan: LOAN_STATUS_LABELS,
  leave: LEAVE_STATUS_LABELS,
  overtime: OVERTIME_STATUS_LABELS,
  payrollRun: PAYROLL_RUN_STATUS_LABELS,
  fnf: FNF_STATUS_LABELS,
  attendance: ATTENDANCE_STATUS_LABELS,
  salaryPaymentBatch: SALARY_PAYMENT_BATCH_STATUS_LABELS,
  payslip: PAYSLIP_STATUS_LABELS,
  paymentStatus: PAYMENT_STATUS_LABELS,
  loanSchedule: LOAN_SCHEDULE_STATUS_LABELS,
  clearanceLine: CLEARANCE_LINE_STATUS_LABELS,
  assetLine: ASSET_LINE_STATUS_LABELS,
  salaryStructureVersion: SALARY_STRUCTURE_VERSION_STATUS_LABELS,
  statutoryRule: STATUTORY_RULE_STATUS_LABELS,
  payrollPeriod: PAYROLL_PERIOD_STATUS_LABELS,
}

const TONE_MAPS: Record<HrStatusDomain, Record<string, DynamicsStatusChipTone>> = {
  employee: EMPLOYEE_STATUS_TONES,
  exit: EXIT_STATUS_TONES,
  loan: LOAN_STATUS_TONES,
  leave: LEAVE_STATUS_TONES,
  overtime: OVERTIME_STATUS_TONES,
  payrollRun: PAYROLL_RUN_STATUS_TONES,
  fnf: FNF_STATUS_TONES,
  attendance: ATTENDANCE_STATUS_TONES,
  salaryPaymentBatch: SALARY_PAYMENT_BATCH_STATUS_TONES,
  payslip: PAYSLIP_STATUS_TONES,
  paymentStatus: PAYMENT_STATUS_TONES,
  loanSchedule: LOAN_SCHEDULE_STATUS_TONES,
  clearanceLine: CLEARANCE_LINE_STATUS_TONES,
  assetLine: ASSET_LINE_STATUS_TONES,
  salaryStructureVersion: SALARY_STRUCTURE_VERSION_STATUS_TONES,
  statutoryRule: STATUTORY_RULE_STATUS_TONES,
  payrollPeriod: PAYROLL_PERIOD_STATUS_TONES,
}

/** Human label for an attendance exception type code. */
export function hrExceptionTypeLabel(type: string | null | undefined): string {
  if (!type) return '—'
  if (ATTENDANCE_EXCEPTION_TYPE_LABELS[type]) return ATTENDANCE_EXCEPTION_TYPE_LABELS[type]
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Human-readable label for a status code — falls back to a title-cased version of the code. */
export function hrStatusLabel(status: string | null | undefined, domain: HrStatusDomain = 'employee'): string {
  if (!status) return '—'
  const map = LABEL_MAPS[domain]
  if (map[status]) return map[status]
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Status-chip tone for a status code — falls back to neutral. */
export function hrStatusTone(status: string | null | undefined, domain: HrStatusDomain = 'employee'): DynamicsStatusChipTone {
  if (!status) return 'neutral'
  return TONE_MAPS[domain][status] ?? 'neutral'
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  PERMANENT: 'Permanent',
  PROBATION: 'Probation',
  CONTRACT: 'Contract',
  TRAINEE: 'Trainee',
  INTERN: 'Intern',
  TEMPORARY: 'Temporary',
}

export const WORKER_CATEGORY_LABELS: Record<string, string> = {
  STAFF: 'Staff',
  WORKER: 'Worker',
  SUPERVISOR: 'Supervisor',
  MANAGEMENT: 'Management',
}

export const GENDER_LABELS: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
}
