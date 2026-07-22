import type { PermissionName } from '../../../constants/permissions.js'

export const RUNTIME_CHANGE_TYPES = [
  'QUANTITY_CHANGE',
  'DUE_DATE_CHANGE',
  'PRIORITY_CHANGE',
  'SUPERVISOR_CHANGE',
  'OPERATOR_CHANGE',
  'MACHINE_CHANGE',
  'WORK_CENTRE_CHANGE',
  'ADD_OPERATION',
  'REPEAT_OPERATION',
  'SKIP_OPERATION',
  'CONVERT_TO_JOB_WORK',
  'WORK_ORDER_HOLD',
  'WORK_ORDER_RESUME',
  'STAGE_HOLD',
  'STAGE_RESUME',
] as const

export type RuntimeChangeType = (typeof RUNTIME_CHANGE_TYPES)[number]

export const RUNTIME_CHANGE_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'CANCELLED',
  'FAILED',
] as const

export type RuntimeChangeStatus = (typeof RUNTIME_CHANGE_STATUSES)[number]

export const RUNTIME_CHANGE_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export type RuntimeChangeRisk = (typeof RUNTIME_CHANGE_RISK_LEVELS)[number]

/** Fine-grained permission required to request/apply a given change type (Phase 5A). */
export const RUNTIME_CHANGE_TYPE_PERMISSION: Record<RuntimeChangeType, PermissionName> = {
  QUANTITY_CHANGE: 'manufacturing.runtime_change.quantity',
  DUE_DATE_CHANGE: 'manufacturing.runtime_change.schedule',
  PRIORITY_CHANGE: 'manufacturing.runtime_change.schedule',
  SUPERVISOR_CHANGE: 'manufacturing.runtime_change.assignment',
  OPERATOR_CHANGE: 'manufacturing.runtime_change.assignment',
  MACHINE_CHANGE: 'manufacturing.runtime_change.machine',
  WORK_CENTRE_CHANGE: 'manufacturing.runtime_change.work_centre',
  ADD_OPERATION: 'manufacturing.runtime_change.route',
  REPEAT_OPERATION: 'manufacturing.runtime_change.route',
  SKIP_OPERATION: 'manufacturing.runtime_change.skip',
  CONVERT_TO_JOB_WORK: 'manufacturing.runtime_change.job_work',
  WORK_ORDER_HOLD: 'manufacturing.runtime_change.hold',
  WORK_ORDER_RESUME: 'manufacturing.runtime_change.hold',
  STAGE_HOLD: 'manufacturing.runtime_change.hold',
  STAGE_RESUME: 'manufacturing.runtime_change.hold',
}

/** DRAFT/CANCELLED are terminal-ish or pre-workflow; these are the only statuses a draft can leave from. */
export const EDITABLE_STATUSES: RuntimeChangeStatus[] = ['DRAFT']
export const APPLIABLE_STATUSES: RuntimeChangeStatus[] = ['DRAFT', 'APPROVED']
