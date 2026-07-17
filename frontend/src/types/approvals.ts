export type ApprovalRequestStatus = 'PENDING' | 'APPROVED' | 'SENT_BACK' | 'REJECTED' | 'CANCELLED'

export type ApprovalStepStatus =
  | 'WAITING'
  | 'PENDING'
  | 'APPROVED'
  | 'SENT_BACK'
  | 'REJECTED'
  | 'SKIPPED'
  | 'CANCELLED'

export interface ApprovalStep {
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

export interface ApprovalRequest {
  id: string
  tenantId: string
  legalEntityId: string
  documentType: 'JOURNAL'
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
  steps?: ApprovalStep[]
  ruleSnapshotJson?: unknown
  workflowSnapshotJson?: unknown
  allowedActions?: ApprovalRequestAllowedActions
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
  steps: ApprovalStep[]
}

export interface ApprovalListFilters {
  legalEntityId: string
  view?: 'my_pending' | 'submitted_by_me' | 'completed_by_me' | 'all'
  status?: ApprovalRequestStatus
  documentType?: 'JOURNAL'
  page?: number
  limit?: number
  search?: string
  dateFrom?: string
  dateTo?: string
  amountFrom?: number
  amountTo?: number
}
