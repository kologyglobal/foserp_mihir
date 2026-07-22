export type ExceptionCategory =
  | 'WORK_ORDER_OVERDUE'
  | 'MATERIAL_SHORTAGE'
  | 'CRITICAL_ISSUE'
  | 'QUALITY_PENDING'
  | 'NCR_OPEN'
  | 'JOB_WORK_OVERDUE'
  | 'SALES_ORDER_LINE_OVERDUE'
  | 'DISPATCH_REQUIREMENT_OVERDUE'
  | 'DISPATCH_REQUIREMENT_BLOCKED'
  | 'DISPATCH_RECONCILIATION_REQUIRED'
  | 'DISPATCH_PICK_SHORTAGE'
  | 'DISPATCH_PACKING_SHORTAGE'

export type ExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type ExceptionResolutionStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED'

/** A currently-open exception derived live from source tables (no persistence of the condition itself). */
export interface DerivedException {
  exceptionKey: string
  category: ExceptionCategory
  severity: ExceptionSeverity
  sourceType: string
  sourceId: string
  title: string
  detail: string
  ageDays: number
  referenceDate: string
  extra?: Record<string, unknown>
}

/** Derived exception merged with any persisted ack/assign/resolve action state. */
export interface ExceptionRow extends DerivedException {
  assignedTo: string | null
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  resolutionStatus: ExceptionResolutionStatus
  resolutionNote: string | null
  resolvedBy: string | null
  resolvedAt: string | null
}
