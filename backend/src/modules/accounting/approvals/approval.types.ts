import type { FinanceApprovalRequest, FinanceApprovalStep } from '@prisma/client'

export type ApprovalDocumentType = 'JOURNAL' | 'PAYMENT' | 'RECEIPT' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PERIOD_REOPEN'

export type ApprovalRequestStatus = 'PENDING' | 'APPROVED' | 'SENT_BACK' | 'REJECTED' | 'CANCELLED'

export type ApprovalStepStatus =
  | 'WAITING'
  | 'PENDING'
  | 'APPROVED'
  | 'SENT_BACK'
  | 'REJECTED'
  | 'SKIPPED'
  | 'CANCELLED'

export interface JournalApprovalLevel {
  level: number
  ruleId: string
  ruleName: string
  approverRoleId: string | null
  approverUserId: string | null
}

export interface ApprovalStepDto {
  id: string
  level: number
  sequence: number
  approverRoleId: string | null
  approverUserId: string | null
  status: ApprovalStepStatus
  actedBy: string | null
  actedAt: string | null
  comments: string | null
}

export interface ApprovalRequestAllowedActions {
  approve: boolean
  reject: boolean
  sendBack: boolean
  view: boolean
}

export interface ApprovalRequestListItemDto {
  id: string
  tenantId: string
  legalEntityId: string
  documentType: ApprovalDocumentType
  documentId: string
  documentNumberSnapshot: string | null
  documentStatusSnapshot: string | null
  cycleNumber: number
  status: ApprovalRequestStatus
  amountBasis: string
  currencyCode: string
  currentLevel: number
  totalLevels: number
  requestedBy: string | null
  requestedAt: string
  completedAt: string | null
  completedBy: string | null
  createdAt: string
  updatedAt: string
  allowedActions?: ApprovalRequestAllowedActions
}

export interface ApprovalRequestDetailDto extends ApprovalRequestListItemDto {
  ruleSnapshotJson: unknown
  workflowSnapshotJson: unknown
  steps: ApprovalStepDto[]
  allowedActions: ApprovalRequestAllowedActions
}

export interface JournalApprovalTimelineEntry {
  requestId: string
  cycleNumber: number
  status: ApprovalRequestStatus
  requestedBy: string | null
  requestedAt: string
  completedAt: string | null
  completedBy: string | null
  currentLevel: number
  totalLevels: number
  steps: ApprovalStepDto[]
}

export type ApprovalRequestWithSteps = FinanceApprovalRequest & { steps: FinanceApprovalStep[] }
