/**
 * Manufacturing Phase 2B — Assignments, operator my-work, daily production, issues.
 * Mirrors backend mappers in assignment/issue/daily-production controllers.
 */

export const ASSIGNMENT_STATUS_VALUES = [
  'ASSIGNED',
  'ACCEPTED',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
] as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS_VALUES)[number]

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In Progress',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const ISSUE_TYPE_VALUES = [
  'MATERIAL_SHORTAGE',
  'MACHINE_BREAKDOWN',
  'TOOL_UNAVAILABLE',
  'POWER_FAILURE',
  'QUALITY_HOLD',
  'OPERATOR_UNAVAILABLE',
  'DRAWING_ISSUE',
  'SPECIFICATION_ISSUE',
  'MAINTENANCE_REQUIRED',
  'VENDOR_DELAY',
  'SAFETY_CONCERN',
  'OTHER',
] as const
export type IssueType = (typeof ISSUE_TYPE_VALUES)[number]

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  MATERIAL_SHORTAGE: 'Material Shortage',
  MACHINE_BREAKDOWN: 'Machine Breakdown',
  TOOL_UNAVAILABLE: 'Tool Unavailable',
  POWER_FAILURE: 'Power Failure',
  QUALITY_HOLD: 'Quality Hold',
  OPERATOR_UNAVAILABLE: 'Operator Unavailable',
  DRAWING_ISSUE: 'Drawing Issue',
  SPECIFICATION_ISSUE: 'Specification Issue',
  MAINTENANCE_REQUIRED: 'Maintenance Required',
  VENDOR_DELAY: 'Vendor Delay',
  SAFETY_CONCERN: 'Safety Concern',
  OTHER: 'Other',
}

export const ISSUE_STATUS_VALUES = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'] as const
export type IssueStatus = (typeof ISSUE_STATUS_VALUES)[number]

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CANCELLED: 'Cancelled',
}

export const ISSUE_SEVERITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export type IssueSeverity = (typeof ISSUE_SEVERITY_VALUES)[number]

export const ISSUE_SEVERITY_LABELS: Record<IssueSeverity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const DAILY_BATCH_STATUS_VALUES = ['DRAFT', 'SUBMITTED', 'PARTIALLY_REVERSED', 'REVERSED'] as const
export type DailyBatchStatus = (typeof DAILY_BATCH_STATUS_VALUES)[number]

export const DAILY_BATCH_STATUS_LABELS: Record<DailyBatchStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PARTIALLY_REVERSED: 'Partially Reversed',
  REVERSED: 'Reversed',
}

export interface AssignmentAllowedActions {
  accept: boolean
  start: boolean
  pause: boolean
  resume: boolean
  complete: boolean
  cancel: boolean
  reassign: boolean
}

export interface AssignmentNestedRef {
  id: string
  code?: string
  name: string
  status?: string
}

export interface ProductionAssignment {
  id: string
  tenantId: string
  productionOrderId: string
  stageId: string
  operationId: string | null
  userId: string | null
  employeeId: string | null
  machineId: string | null
  workCentreId: string | null
  assignmentDate: string
  plannedStartAt: string | null
  plannedEndAt: string | null
  shiftCode: string | null
  shiftLabel: string | null
  assignedQuantity: string
  completedQuantity: string
  status: AssignmentStatus
  assignedBy: string | null
  acceptedAt: string | null
  startedAt: string | null
  pausedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancellationReason: string | null
  notes: string | null
  workInstruction: string | null
  reassignedFromId: string | null
  createdAt: string
  updatedAt: string
  stage?: AssignmentNestedRef
  operation?: AssignmentNestedRef
  machine?: AssignmentNestedRef
  workCentre?: AssignmentNestedRef
  productionOrder?: {
    id: string
    orderNumber: string
    status: string
    productItemId?: string | null
    productItem?: { id: string; code: string; name: string } | null
  }
  allowedActions?: AssignmentAllowedActions
}

export interface ProductionIssue {
  id: string
  tenantId: string
  issueNumber: string
  productionOrderId: string
  stageId: string | null
  operationId: string | null
  assignmentId: string | null
  workCentreId: string | null
  machineId: string | null
  reportedByUserId: string
  reportedByEmployeeId: string | null
  issueType: IssueType
  severity: IssueSeverity
  status: IssueStatus
  title: string
  description: string | null
  startedAt: string
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  resolution: string | null
  expectedImpactMinutes: number | null
  actualDowntimeMinutes: number | null
  productionBlocked: boolean
  attachmentReference: string | null
  createdAt: string
  updatedAt: string
}

export interface TodayIssueSummary {
  id: string
  issueNumber: string
  title: string
  severity: IssueSeverity
  status: IssueStatus
  productionOrderId: string
  stageId: string | null
  productionBlocked: boolean
}

export interface DailyProductionLine {
  id: string
  tenantId: string
  batchId: string
  productionOrderId: string
  stageId: string
  operationId: string | null
  assignmentId: string | null
  userId: string | null
  machineId: string | null
  workCentreId: string | null
  goodQuantity: string
  reworkQuantity: string
  rejectedQuantity: string
  scrapQuantity: string
  labourMinutes: number | null
  machineMinutes: number | null
  downtimeMinutes: number | null
  remarks: string | null
  idempotencyKey: string
  lineOrder: number
  createdAt: string
  updatedAt: string
}

export interface DailyProductionBatch {
  id: string
  tenantId: string
  batchNumber: string
  productionDate: string
  shiftCode: string | null
  shiftLabel: string | null
  plantCode: string | null
  workCentreId: string | null
  supervisorId: string
  status: DailyBatchStatus
  totalLines: number
  submittedAt: string | null
  submittedBy: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  lines?: DailyProductionLine[]
}

export interface DailyBatchValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ─── Request payloads ───────────────────────────────────────────────────────

export interface CreateAssignmentPayload {
  productionOrderId: string
  stageId: string
  operationId?: string
  userId: string
  employeeId?: string
  machineId?: string
  workCentreId?: string
  assignmentDate: string
  plannedStartAt?: string
  plannedEndAt?: string
  shiftCode?: string
  shiftLabel?: string
  assignedQuantity: number
  notes?: string
  workInstruction?: string
}

export interface PauseAssignmentPayload {
  reasonType?: IssueType
  reasonLabel?: string
  startDowntime?: boolean
  remarks?: string
}

export interface CompleteAssignmentPayload {
  goodQuantity: number
  reworkQuantity: number
  rejectedQuantity: number
  scrapQuantity: number
  remarks?: string
  idempotencyKey: string
}

export interface ReportIssuePayload {
  productionOrderId?: string
  stageId?: string
  operationId?: string
  assignmentId?: string
  workCentreId?: string
  machineId?: string
  reportedByEmployeeId?: string
  issueType: IssueType
  severity?: IssueSeverity
  title: string
  description?: string
  expectedImpactMinutes?: number
  productionBlocked?: boolean
  stageWideBlock?: boolean
  startDowntime?: boolean
  attachmentReference?: string
}

export interface CreateDailyBatchPayload {
  productionDate: string
  shiftCode?: string
  shiftLabel?: string
  plantCode?: string
  workCentreId?: string
  notes?: string
}

export interface UpsertDailyLinePayload {
  productionOrderId: string
  stageId: string
  operationId?: string
  assignmentId?: string
  userId?: string
  machineId?: string
  workCentreId?: string
  goodQuantity: number
  reworkQuantity: number
  rejectedQuantity: number
  scrapQuantity: number
  labourMinutes?: number
  machineMinutes?: number
  downtimeMinutes?: number
  remarks?: string
  idempotencyKey: string
  lineOrder?: number
}

export interface ListAssignmentsQuery {
  page?: number
  limit?: number
  workOrderId?: string
  workCentreId?: string
  userId?: string
  machineId?: string
  stageId?: string
  status?: AssignmentStatus
  assignmentDate?: string
  shiftCode?: string
}

export interface ListMyWorkQuery {
  page?: number
  limit?: number
  userId?: string
  status?: AssignmentStatus
  assignmentDate?: string
}

export interface ListIssuesQuery {
  page?: number
  limit?: number
  productionOrderId?: string
  stageId?: string
  assignmentId?: string
  status?: IssueStatus
  issueType?: IssueType
  severity?: IssueSeverity
  productionBlocked?: boolean
}

export interface ListDailyBatchesQuery {
  page?: number
  limit?: number
  status?: DailyBatchStatus
  productionDate?: string
  workCentreId?: string
}
