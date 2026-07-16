import type { ErpRole } from '../utils/permissions'

/** Configurable approver slots — mapped to ERP roles until AuthModule ships */
export type ApprovalApproverCode =
  | 'purchase_head'
  | 'director'
  | 'engineering_head'
  | 'finance'
  | 'quality_head'
  | 'dispatch_head'
  | 'accounts_head'
  | 'production_head'

export type ApprovalDocumentType =
  | 'purchase_requisition'
  | 'purchase_order'
  | 'po_amendment'
  | 'bom_revision'
  | 'routing_revision'
  | 'engineering_change'
  | 'wo_release'
  | 'cost_override'
  | 'qc_reject_closure'
  | 'ncr_closure'
  | 'dispatch_override'
  | 'invoice_cancellation'
  | 'payment_adjustment'
  | 'job_work_order'

export type ApprovalConditionType =
  | 'amount'
  | 'status'
  | 'department'
  | 'cost_variance'
  | 'qc_severity'
  | 'change_impact'
  | 'dispatch_override'
  | 'always'
  | 'is_revision'

export type ApprovalConditionField =
  | 'totalAmount'
  | 'isRevision'
  | 'always'
  | 'department'
  | 'approvalLevel'
  | 'costVariance'
  | 'qcSeverity'
  | 'changeImpact'
  | 'dispatchOverride'

export type ApprovalConditionOperator = 'gt' | 'gte' | 'eq' | 'always'

export interface ApprovalMatrixRule {
  id: string
  documentType: ApprovalDocumentType
  label: string
  conditionType: ApprovalConditionType
  condition: {
    field: ApprovalConditionField
    operator: ApprovalConditionOperator
    /** Numeric threshold, boolean (isRevision), or department/level/severity string */
    value?: number | boolean | string
  }
  approverCode: ApprovalApproverCode
  sequence: number
  active: boolean
  /** Optional escalation days — surfaced in inbox as overdue */
  escalationDays?: number
  /** Optional specific user id when rule requires named approver */
  requiredUserId?: string | null
}

export interface ApprovalApproverDefinition {
  code: ApprovalApproverCode
  label: string
  mappedRoles: ErpRole[]
}

export type ApprovalStepStatus = 'pending' | 'approved' | 'skipped' | 'rejected'

export interface ApprovalStepRecord {
  sequence: number
  ruleId: string
  ruleLabel: string
  approverCode: ApprovalApproverCode
  approverLabel: string
  status: ApprovalStepStatus
  approvedByName?: string
  approvedAt?: string
  remarks?: string
}

export type ApprovalRequestStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'closed'

export interface ApprovalRequest {
  id: string
  documentType: ApprovalDocumentType
  entityId: string
  entityLabel: string
  status: ApprovalRequestStatus
  steps: ApprovalStepRecord[]
  currentStepIndex: number
  context: Record<string, unknown>
  submittedAt: string
  submittedByName: string
  completedAt?: string
  rejectionReason?: string
  returnedAt?: string
  returnedByName?: string
}

export const APPROVAL_DOCUMENT_LABELS: Record<ApprovalDocumentType, string> = {
  purchase_requisition: 'Purchase Requisition',
  purchase_order: 'Purchase Order',
  po_amendment: 'PO Amendment',
  bom_revision: 'BOM Revision',
  routing_revision: 'Routing Revision',
  engineering_change: 'Engineering Change (ECO)',
  wo_release: 'Work Order Release',
  cost_override: 'Cost Override',
  qc_reject_closure: 'QC Reject Closure',
  ncr_closure: 'NCR Closure',
  dispatch_override: 'Dispatch Override',
  invoice_cancellation: 'Invoice Cancellation',
  payment_adjustment: 'Payment Adjustment',
  job_work_order: 'Job Work Order',
}

export const APPROVER_CODE_LABELS: Record<ApprovalApproverCode, string> = {
  purchase_head: 'Purchase Head',
  director: 'Director',
  engineering_head: 'Engineering Head',
  finance: 'Finance',
  quality_head: 'Quality Head',
  dispatch_head: 'Dispatch Head',
  accounts_head: 'Accounts Head',
  production_head: 'Production Head',
}

export const APPROVAL_CONDITION_TYPE_LABELS: Record<ApprovalConditionType, string> = {
  amount: 'Amount',
  status: 'Status',
  department: 'Department',
  cost_variance: 'Cost Variance',
  qc_severity: 'QC Severity',
  change_impact: 'Change Impact',
  dispatch_override: 'Dispatch Override',
  always: 'Always',
  is_revision: 'Is Revision',
}
