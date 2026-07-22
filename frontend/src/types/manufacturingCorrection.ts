/**
 * Manufacturing Phase 5C — transaction corrections / reversals.
 * Aligns with `/manufacturing/corrections` API (built in parallel).
 */

export const CORRECTION_TRANSACTION_TYPES = [
  'PROGRESS',
  'MATERIAL_ISSUE',
  'MATERIAL_RETURN',
  'WIP_MOVEMENT',
  'DAILY_PRODUCTION',
  'JOB_WORK',
] as const
export type CorrectionTransactionType = (typeof CORRECTION_TRANSACTION_TYPES)[number]

export const CORRECTION_ACTIONS = ['REVERSE', 'CORRECT'] as const
export type CorrectionAction = (typeof CORRECTION_ACTIONS)[number]

export const CORRECTION_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'CANCELLED',
  'FAILED',
] as const
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number]

export const CORRECTION_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export type CorrectionRiskLevel = (typeof CORRECTION_RISK_LEVELS)[number]

export const CORRECTION_TRANSACTION_TYPE_LABELS: Record<CorrectionTransactionType, string> = {
  PROGRESS: 'Progress entry',
  MATERIAL_ISSUE: 'Material issue',
  MATERIAL_RETURN: 'Material return',
  WIP_MOVEMENT: 'WIP transfer',
  DAILY_PRODUCTION: 'Daily production',
  JOB_WORK: 'Job work',
}

export const CORRECTION_ACTION_LABELS: Record<CorrectionAction, string> = {
  REVERSE: 'Full reverse',
  CORRECT: 'Correct quantities',
}

export const CORRECTION_STATUS_LABELS: Record<CorrectionStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  APPLIED: 'Applied',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
}

export type CorrectionProposedValue = {
  goodQuantity?: number
  reworkQuantity?: number
  rejectedQuantity?: number
  scrapQuantity?: number
  quantity?: number
  remarks?: string
  [key: string]: unknown
}

export type CorrectionInput = {
  action: CorrectionAction
  transactionType: CorrectionTransactionType
  sourceEntityId: string
  productionOrderId?: string
  reason: string
  businessJustification?: string
  proposedValue?: CorrectionProposedValue
  idempotencyKey?: string
}

export type CorrectionImpact = {
  summary?: string
  warnings?: string[]
  blockers?: string[]
  affectedEntities?: Array<{ entityType: string; entityId: string; label?: string }>
  stockImpact?: boolean
  wipImpact?: boolean
  ledgerImpact?: boolean
  [key: string]: unknown
}

export type CorrectionPreview = {
  action: CorrectionAction
  transactionType: CorrectionTransactionType
  sourceEntityId: string
  impact: CorrectionImpact
  risk: {
    riskLevel: CorrectionRiskLevel
    approvalRequired: boolean
    ruleSource?: string
  }
  original: Record<string, unknown>
  proposed: Record<string, unknown>
  dependencies?: CorrectionDependency[]
}

export interface ManufacturingCorrection {
  id: string
  correctionNumber: string
  action: CorrectionAction
  transactionType: CorrectionTransactionType
  status: CorrectionStatus
  riskLevel: CorrectionRiskLevel
  approvalRequired: boolean
  sourceEntityId: string
  sourceEntityLabel?: string | null
  productionOrderId: string | null
  productionOrderNumber?: string | null
  reason: string
  businessJustification: string | null
  proposedValueJson: CorrectionProposedValue | null
  originalValueJson: Record<string, unknown> | null
  impactSummaryJson: CorrectionImpact | null
  rejectionReason: string | null
  failureReason: string | null
  requestedBy: string | null
  requestedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  appliedBy: string | null
  appliedAt: string | null
  cancelledBy: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}

export type CorrectionDependency = {
  entityType: string
  entityId: string
  label: string
  status?: string
  blocksApply?: boolean
  relationship?: string
}

export type CorrectionHistoryEntry = {
  id: string
  correctionId: string
  correctionNumber: string
  action: CorrectionAction
  transactionType: CorrectionTransactionType
  status: CorrectionStatus
  reason: string
  appliedAt: string | null
  appliedBy: string | null
  createdAt: string
}

export type ListCorrectionsQuery = {
  page?: number
  limit?: number
  status?: CorrectionStatus
  transactionType?: CorrectionTransactionType
  action?: CorrectionAction
  productionOrderId?: string
  sourceEntityId?: string
  search?: string
}
