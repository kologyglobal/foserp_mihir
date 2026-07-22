export const CORRECTION_TRANSACTION_TYPES = [
  'PRODUCTION_PROGRESS',
  'DAILY_PRODUCTION_LINE',
  'DAILY_PRODUCTION_BATCH',
  'MATERIAL_ISSUE',
  'MATERIAL_RETURN',
  'ADDITIONAL_MATERIAL_ISSUE',
  'MATERIAL_TRANSFER',
  'RESERVATION_TRANSFER',
  'WIP_MOVEMENT',
  'FG_RECEIPT',
  'JOB_WORK_DISPATCH',
  'JOB_WORK_RECEIPT',
  'JOB_WORK_RETURN',
  'JOB_WORK_RECONCILIATION',
  'WORK_ORDER_SPLIT',
  'QUALITY_DECISION',
] as const
export type CorrectionTransactionType = (typeof CORRECTION_TRANSACTION_TYPES)[number]

export const CORRECTION_TYPES = [
  'REVERSE_ONLY',
  'REVERSE_AND_REPLACE',
  'QUANTITY_CORRECTION',
  'DATE_CORRECTION',
  'REFERENCE_CORRECTION',
  'FULL_BATCH_REVERSAL',
  'PARTIAL_REVERSAL',
  'SUPERSEDE_DECISION',
] as const
export type CorrectionType = (typeof CORRECTION_TYPES)[number]

export const CORRECTION_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'APPLYING',
  'APPLIED',
  'FAILED',
  'CANCELLED',
] as const
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number]

export const EDITABLE_CORRECTION_STATUSES: CorrectionStatus[] = ['DRAFT']
export const APPLIABLE_CORRECTION_STATUSES: CorrectionStatus[] = ['DRAFT', 'APPROVED']

/** Type-specific apply permission (in addition to manufacturing.correction.apply). */
export const CORRECTION_TYPE_PERMISSION: Partial<Record<CorrectionTransactionType, string>> = {
  PRODUCTION_PROGRESS: 'manufacturing.progress.reverse',
  DAILY_PRODUCTION_LINE: 'manufacturing.daily_production.reverse',
  DAILY_PRODUCTION_BATCH: 'manufacturing.daily_production.reverse',
  MATERIAL_ISSUE: 'manufacturing.material_issue.reverse',
  ADDITIONAL_MATERIAL_ISSUE: 'manufacturing.material_issue.reverse',
  MATERIAL_RETURN: 'manufacturing.material_return.reverse',
  MATERIAL_TRANSFER: 'manufacturing.material_transfer.reverse',
  RESERVATION_TRANSFER: 'manufacturing.material_transfer.reverse',
  WIP_MOVEMENT: 'manufacturing.wip.reverse',
  FG_RECEIPT: 'manufacturing.fg_receipt.reverse',
  JOB_WORK_DISPATCH: 'manufacturing.job_work_dispatch.reverse',
  JOB_WORK_RECEIPT: 'manufacturing.job_work_receipt.reverse',
  JOB_WORK_RETURN: 'manufacturing.job_work_receipt.reverse',
  JOB_WORK_RECONCILIATION: 'manufacturing.job_work_receipt.reverse',
  WORK_ORDER_SPLIT: 'manufacturing.split.reverse',
  QUALITY_DECISION: 'quality.decision.correct',
}

export function defaultRisk(transactionType: CorrectionTransactionType): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (transactionType) {
    case 'PRODUCTION_PROGRESS':
    case 'DAILY_PRODUCTION_LINE':
      return 'MEDIUM'
    case 'MATERIAL_ISSUE':
    case 'MATERIAL_RETURN':
    case 'MATERIAL_TRANSFER':
    case 'WIP_MOVEMENT':
      return 'MEDIUM'
    case 'DAILY_PRODUCTION_BATCH':
    case 'FG_RECEIPT':
    case 'JOB_WORK_RECEIPT':
    case 'QUALITY_DECISION':
    case 'WORK_ORDER_SPLIT':
      return 'HIGH'
    default:
      return 'MEDIUM'
  }
}

export function defaultApprovalRequired(risk: string): boolean {
  return risk === 'HIGH' || risk === 'CRITICAL'
}
