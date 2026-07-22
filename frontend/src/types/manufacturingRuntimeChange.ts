export const RUNTIME_CHANGE_TYPES = [
  'QUANTITY_CHANGE', 'DUE_DATE_CHANGE', 'PRIORITY_CHANGE', 'SUPERVISOR_CHANGE', 'OPERATOR_CHANGE',
  'MACHINE_CHANGE', 'WORK_CENTRE_CHANGE', 'ADD_OPERATION', 'REPEAT_OPERATION', 'SKIP_OPERATION',
  'CONVERT_TO_JOB_WORK', 'WORK_ORDER_HOLD', 'WORK_ORDER_RESUME', 'STAGE_HOLD', 'STAGE_RESUME',
] as const
export type RuntimeChangeType = (typeof RUNTIME_CHANGE_TYPES)[number]

export const RUNTIME_CHANGE_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED', 'FAILED'] as const
export type RuntimeChangeStatus = (typeof RUNTIME_CHANGE_STATUSES)[number]

export const RUNTIME_CHANGE_TYPE_LABELS: Record<RuntimeChangeType, string> = {
  QUANTITY_CHANGE: 'Change quantity', DUE_DATE_CHANGE: 'Change due date', PRIORITY_CHANGE: 'Change priority',
  SUPERVISOR_CHANGE: 'Change supervisor', OPERATOR_CHANGE: 'Change operator', MACHINE_CHANGE: 'Change machine',
  WORK_CENTRE_CHANGE: 'Change work centre', ADD_OPERATION: 'Add operation', REPEAT_OPERATION: 'Repeat operation',
  SKIP_OPERATION: 'Skip operation', CONVERT_TO_JOB_WORK: 'Convert to job work', WORK_ORDER_HOLD: 'Hold work order',
  WORK_ORDER_RESUME: 'Resume work order', STAGE_HOLD: 'Hold stage', STAGE_RESUME: 'Resume stage',
}
export const RUNTIME_CHANGE_STATUS_LABELS: Record<RuntimeChangeStatus, string> = {
  DRAFT: 'Draft', PENDING_APPROVAL: 'Pending approval', APPROVED: 'Approved', REJECTED: 'Rejected',
  APPLIED: 'Applied', CANCELLED: 'Cancelled', FAILED: 'Failed',
}

export type RuntimeChangeInput = {
  changeType: RuntimeChangeType
  reason: string
  stageId?: string
  operationId?: string
  assignmentId?: string
  businessJustification?: string
  effectiveDate?: string
  proposedValue: Record<string, unknown>
  idempotencyKey?: string
}

export interface RuntimeChange {
  id: string
  changeNumber: string
  productionOrderId: string
  stageId: string | null
  operationId: string | null
  assignmentId: string | null
  changeType: RuntimeChangeType
  status: RuntimeChangeStatus
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  approvalRequired: boolean
  requestedBy: string | null
  requestedAt: string | null
  reason: string
  businessJustification: string | null
  effectiveDate: string | null
  proposedValueJson: Record<string, unknown>
  originalValueJson: Record<string, unknown>
  impactSummaryJson: RuntimeChangeImpact | null
  rejectionReason: string | null
  failureReason: string | null
  approvedBy: string | null
  approvedAt: string | null
  appliedBy: string | null
  appliedAt: string | null
  createdAt: string
  updatedAt: string
  stage?: { id: string; name: string } | null
  operation?: { id: string; name: string } | null
}

export interface RuntimeChangeImpact {
  summary?: string
  warnings?: string[]
  affectedStages?: number
  [key: string]: unknown
}

export interface RuntimeChangePreview {
  changeType: RuntimeChangeType
  impact: RuntimeChangeImpact
  risk: { riskLevel: RuntimeChange['riskLevel']; approvalRequired: boolean; ruleSource?: string }
  original: Record<string, unknown>
  proposed: Record<string, unknown>
}
