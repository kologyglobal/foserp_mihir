/**
 * Central Production status → DynamicsStatusChip tone + user-facing labels.
 * Prefer this module over per-page colour maps.
 */
import type { StatusDotTone } from '@/components/design-system/StatusDot'
import type { DynamicsStatusTone } from './dynamicsStatusTone'
import type { WorkOrderHealth, WorkOrderStatus, StageStatus, ProductionQualityStatus, MaterialControlStatus, MaterialLineStatus } from '@/types/manufacturingProduction'
import {
  WORK_ORDER_HEALTH_LABELS,
  WORK_ORDER_STATUS_LABELS,
  STAGE_STATUS_LABELS,
} from '@/types/manufacturingProduction'
import type { AssignmentStatus, IssueSeverity, IssueStatus } from '@/types/manufacturingPhase2b'
import {
  ASSIGNMENT_STATUS_LABELS,
  ISSUE_SEVERITY_LABELS,
  ISSUE_STATUS_LABELS,
} from '@/types/manufacturingPhase2b'
import type { JobWorkStatus } from '@/types/manufacturingJobWork'
import { JW_STATUS_LABELS } from '@/types/manufacturingJobWork'
import type {
  QualityInspectionStatus,
  QualityNcrSeverity,
  QualityNcrStatus,
} from '@/services/api/qualityApi'

export type { DynamicsStatusTone }

export interface StatusMeta {
  label: string
  tone: DynamicsStatusTone
}

/** User-facing WO status labels (ops-friendly). */
export const WO_STATUS_UI_LABELS: Record<WorkOrderStatus, string> = {
  DRAFT: 'Draft',
  READY: 'Ready',
  IN_PROGRESS: 'Running',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

/** User-facing health labels. */
export const WO_HEALTH_UI_LABELS: Record<WorkOrderHealth, string> = {
  ON_TRACK: 'On Track',
  ATTENTION: 'Needs Attention',
  BLOCKED: 'Blocked',
  DELAYED: 'Delayed',
}

const WO_STATUS_TONE: Record<WorkOrderStatus, DynamicsStatusTone> = {
  DRAFT: 'neutral',
  READY: 'success',
  IN_PROGRESS: 'live',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CLOSED: 'success',
  CANCELLED: 'critical',
}

const WO_HEALTH_TONE: Record<WorkOrderHealth, DynamicsStatusTone> = {
  ON_TRACK: 'success',
  ATTENTION: 'warning',
  BLOCKED: 'critical',
  DELAYED: 'critical',
}

const STAGE_TONE: Record<StageStatus, DynamicsStatusTone> = {
  NOT_STARTED: 'neutral',
  READY: 'success',
  IN_PROGRESS: 'live',
  ON_HOLD: 'warning',
  BLOCKED: 'critical',
  QC_PENDING: 'pending',
  COMPLETED: 'success',
  SKIPPED: 'neutral',
  CANCELLED: 'critical',
}

const QUALITY_TONE: Record<ProductionQualityStatus, DynamicsStatusTone> = {
  NOT_APPLICABLE: 'neutral',
  PENDING_INTEGRATION: 'pending',
  PENDING_QC: 'pending',
  IN_QC: 'live',
  PASSED: 'success',
  FAILED: 'critical',
  HOLD: 'warning',
}

const QUALITY_LABELS: Record<ProductionQualityStatus, string> = {
  NOT_APPLICABLE: 'Not required',
  PENDING_INTEGRATION: 'QC pending setup',
  PENDING_QC: 'Pending QC',
  IN_QC: 'In QC',
  PASSED: 'Passed',
  FAILED: 'Failed',
  HOLD: 'On hold',
}

const MATERIAL_CONTROL_TONE: Record<MaterialControlStatus, DynamicsStatusTone> = {
  NOT_CONNECTED: 'warning',
  PENDING_INVENTORY: 'pending',
  ACTIVE: 'success',
}

const MATERIAL_CONTROL_LABELS: Record<MaterialControlStatus, string> = {
  NOT_CONNECTED: 'Not connected to Inventory',
  PENDING_INVENTORY: 'Connecting to Inventory…',
  ACTIVE: 'Connected to Inventory',
}

const MATERIAL_LINE_TONE: Record<MaterialLineStatus, DynamicsStatusTone> = {
  OPEN: 'neutral',
  RESERVED: 'info',
  PARTIAL: 'warning',
  ISSUED: 'success',
  SHORT: 'critical',
  CLOSED: 'success',
  CANCELLED: 'critical',
}

const MATERIAL_LINE_LABELS: Record<MaterialLineStatus, string> = {
  OPEN: 'Open',
  RESERVED: 'Reserved',
  PARTIAL: 'Partially issued',
  ISSUED: 'Issued',
  SHORT: 'Short',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

const ASSIGNMENT_TONE: Record<AssignmentStatus, DynamicsStatusTone> = {
  ASSIGNED: 'info',
  ACCEPTED: 'success',
  IN_PROGRESS: 'live',
  PAUSED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

const ISSUE_TONE: Record<IssueStatus, DynamicsStatusTone> = {
  OPEN: 'critical',
  ACKNOWLEDGED: 'warning',
  IN_PROGRESS: 'live',
  RESOLVED: 'success',
  CANCELLED: 'neutral',
}

const JOB_WORK_TONE: Record<JobWorkStatus, DynamicsStatusTone> = {
  draft: 'neutral',
  material_sent: 'info',
  partially_received: 'warning',
  received: 'success',
  reconciliation_pending: 'pending',
  closed: 'success',
  cancelled: 'critical',
}

const ISSUE_SEVERITY_TONE: Record<IssueSeverity, DynamicsStatusTone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'critical',
}

const QUALITY_INSPECTION_TONE: Record<QualityInspectionStatus, DynamicsStatusTone> = {
  PENDING: 'pending',
  PASSED: 'success',
  REWORK: 'warning',
  REJECTED: 'critical',
  CANCELLED: 'neutral',
}

const QUALITY_INSPECTION_LABELS: Record<QualityInspectionStatus, string> = {
  PENDING: 'Pending',
  PASSED: 'Passed',
  REWORK: 'Rework',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

const QUALITY_NCR_STATUS_TONE: Record<QualityNcrStatus, DynamicsStatusTone> = {
  OPEN: 'critical',
  INVESTIGATING: 'warning',
  CORRECTIVE_ACTION: 'live',
  APPROVED: 'success',
  CLOSED: 'success',
  CANCELLED: 'neutral',
}

const QUALITY_NCR_STATUS_LABELS: Record<QualityNcrStatus, string> = {
  OPEN: 'Open',
  INVESTIGATING: 'Investigating',
  CORRECTIVE_ACTION: 'Corrective action',
  APPROVED: 'Approved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

const QUALITY_NCR_SEVERITY_TONE: Record<QualityNcrSeverity, DynamicsStatusTone> = {
  MINOR: 'info',
  MAJOR: 'warning',
  CRITICAL: 'critical',
}

const QUALITY_NCR_SEVERITY_LABELS: Record<QualityNcrSeverity, string> = {
  MINOR: 'Minor',
  MAJOR: 'Major',
  CRITICAL: 'Critical',
}

export function workOrderStatusMeta(status: WorkOrderStatus): StatusMeta {
  return {
    label: WO_STATUS_UI_LABELS[status] ?? WORK_ORDER_STATUS_LABELS[status] ?? status,
    tone: WO_STATUS_TONE[status] ?? 'neutral',
  }
}

export function workOrderHealthMeta(health: WorkOrderHealth): StatusMeta {
  return {
    label: WO_HEALTH_UI_LABELS[health] ?? WORK_ORDER_HEALTH_LABELS[health] ?? health,
    tone: WO_HEALTH_TONE[health] ?? 'neutral',
  }
}

export function stageStatusMeta(status: StageStatus | string): StatusMeta {
  const key = status as StageStatus
  return {
    label: STAGE_STATUS_LABELS[key] ?? String(status).replace(/_/g, ' '),
    tone: STAGE_TONE[key] ?? 'neutral',
  }
}

export function qualityStatusMeta(status: ProductionQualityStatus | string): StatusMeta {
  const key = status as ProductionQualityStatus
  return {
    label: QUALITY_LABELS[key] ?? String(status).replace(/_/g, ' '),
    tone: QUALITY_TONE[key] ?? 'neutral',
  }
}

export function materialControlMeta(status: MaterialControlStatus | string): StatusMeta {
  const key = status as MaterialControlStatus
  return {
    label: MATERIAL_CONTROL_LABELS[key] ?? String(status).replace(/_/g, ' '),
    tone: MATERIAL_CONTROL_TONE[key] ?? 'neutral',
  }
}

export function materialLineMeta(status: MaterialLineStatus | string): StatusMeta {
  const key = status as MaterialLineStatus
  return {
    label: MATERIAL_LINE_LABELS[key] ?? String(status).replace(/_/g, ' '),
    tone: MATERIAL_LINE_TONE[key] ?? 'neutral',
  }
}

export function assignmentStatusMeta(status: AssignmentStatus): StatusMeta {
  return {
    label: ASSIGNMENT_STATUS_LABELS[status] ?? status,
    tone: ASSIGNMENT_TONE[status] ?? 'neutral',
  }
}

export function issueStatusMeta(status: IssueStatus): StatusMeta {
  return {
    label: ISSUE_STATUS_LABELS[status] ?? status,
    tone: ISSUE_TONE[status] ?? 'neutral',
  }
}

export function jobWorkStatusMeta(status: JobWorkStatus): StatusMeta {
  return {
    label: JW_STATUS_LABELS[status] ?? String(status).replace(/_/g, ' '),
    tone: JOB_WORK_TONE[status] ?? 'neutral',
  }
}

export function issueSeverityMeta(severity: IssueSeverity): StatusMeta {
  return {
    label: ISSUE_SEVERITY_LABELS[severity] ?? severity,
    tone: ISSUE_SEVERITY_TONE[severity] ?? 'neutral',
  }
}

export function qualityInspectionStatusMeta(status: QualityInspectionStatus | string): StatusMeta {
  const key = status as QualityInspectionStatus
  return {
    label: QUALITY_INSPECTION_LABELS[key] ?? String(status).replace(/_/g, ' '),
    tone: QUALITY_INSPECTION_TONE[key] ?? 'neutral',
  }
}

export function qualityNcrStatusMeta(status: QualityNcrStatus | string): StatusMeta {
  const key = status as QualityNcrStatus
  return {
    label: QUALITY_NCR_STATUS_LABELS[key] ?? String(status).replace(/_/g, ' '),
    tone: QUALITY_NCR_STATUS_TONE[key] ?? 'neutral',
  }
}

export function qualityNcrSeverityMeta(severity: QualityNcrSeverity | string): StatusMeta {
  const key = severity as QualityNcrSeverity
  return {
    label: QUALITY_NCR_SEVERITY_LABELS[key] ?? String(severity).replace(/_/g, ' '),
    tone: QUALITY_NCR_SEVERITY_TONE[key] ?? 'neutral',
  }
}

/** Map Dynamics chip tones → legacy StatusDot tones (for gradual migration). */
export function toStatusDotTone(tone: DynamicsStatusTone): StatusDotTone {
  switch (tone) {
    case 'critical':
      return 'danger'
    case 'live':
      return 'info'
    case 'pending':
      return 'warning'
    case 'success':
    case 'warning':
    case 'info':
    case 'neutral':
      return tone
    default:
      return 'neutral'
  }
}

/** @deprecated Prefer workOrderStatusMeta + WorkOrderStatusBadge */
export function statusTone(status: WorkOrderStatus): StatusDotTone {
  return toStatusDotTone(workOrderStatusMeta(status).tone)
}

/** @deprecated Prefer workOrderHealthMeta + WorkOrderHealthBadge */
export function healthTone(health: WorkOrderHealth): StatusDotTone {
  return toStatusDotTone(workOrderHealthMeta(health).tone)
}

/** @deprecated Prefer stageStatusMeta */
export function stageTone(status: string): StatusDotTone {
  return toStatusDotTone(stageStatusMeta(status).tone)
}
