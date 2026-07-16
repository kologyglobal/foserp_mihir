import type { BomHeader } from '../types/bom'
import type { Product } from '../types/master'
import type { PurchaseOrder } from '../types/purchase'
import type { RoutingHeader } from '../types/routing'
import type {
  ApprovalApproverDefinition,
  ApprovalDocumentType,
  ApprovalMatrixRule,
  ApprovalRequest,
  ApprovalStepRecord,
} from '../types/approvalMatrix'
import type { SessionUser } from './permissions'
import { useApprovalStore } from '../store/approvalStore'

export function computePoTotalAmount(po: PurchaseOrder): number {
  return po.lines.reduce((s, l) => s + l.qty * l.rate, 0)
}

export function buildApprovalContext(
  documentType: ApprovalDocumentType,
  entity: PurchaseOrder | BomHeader | Product | RoutingHeader | Record<string, unknown>,
): Record<string, unknown> {
  switch (documentType) {
    case 'purchase_order':
    case 'po_amendment':
      return { totalAmount: computePoTotalAmount(entity as PurchaseOrder) }
    case 'bom_revision': {
      const bom = entity as BomHeader
      return { isRevision: Boolean(bom.previousRevisionId), revision: bom.revision }
    }
    case 'routing_revision': {
      const routing = entity as RoutingHeader
      return { isRevision: Boolean(routing.previousRevisionId), revision: routing.revision }
    }
    case 'engineering_change':
      return {
        isRevision: true,
        totalAmount: (entity as Record<string, unknown>).costImpact ?? 0,
      }
    case 'cost_override': {
      const product = entity as Product
      return {
        totalAmount: product.standardCost.totalCost,
        costOverride: product.standardCost.costOverride,
        costVariance: product.standardCost.costOverride,
      }
    }
    case 'dispatch_override':
      return { dispatchOverride: true }
    case 'ncr_closure':
      return { qcSeverity: (entity as Record<string, unknown>).severity ?? 'critical' }
    case 'qc_reject_closure':
      return { qcSeverity: (entity as Record<string, unknown>).severity ?? 'major' }
    case 'invoice_cancellation':
    case 'payment_adjustment':
      return { totalAmount: (entity as Record<string, unknown>).totalAmount ?? 0 }
    case 'wo_release':
      return { isRevision: (entity as Record<string, unknown>).requiresSpecialApproval ?? false }
    case 'job_work_order':
      return { totalAmount: (entity as Record<string, unknown>).totalAmount ?? 0 }
    default:
      return typeof entity === 'object' && entity !== null ? { ...(entity as Record<string, unknown>) } : {}
  }
}

function conditionMatches(rule: ApprovalMatrixRule, context: Record<string, unknown>): boolean {
  const { condition } = rule
  if (condition.operator === 'always' || condition.field === 'always') return true

  const value = context[condition.field]
  if (condition.field === 'totalAmount' && typeof value === 'number') {
    const threshold = Number(condition.value ?? 0)
    if (condition.operator === 'gt') return value > threshold
    if (condition.operator === 'gte') return value >= threshold
  }
  if (condition.field === 'isRevision' || condition.field === 'dispatchOverride' || condition.field === 'qcSeverity') {
    if (condition.operator === 'eq') return value === condition.value
    if (condition.field === 'isRevision' && condition.value === true) return value === true
  }
  if (condition.field === 'costVariance' && value != null) return true
  return false
}

export function resolveMatchingRules(
  documentType: ApprovalDocumentType,
  context: Record<string, unknown>,
  rules: ApprovalMatrixRule[],
): ApprovalMatrixRule[] {
  return rules
    .filter((r) => r.active && r.documentType === documentType && conditionMatches(r, context))
    .sort((a, b) => a.sequence - b.sequence)
}

export function buildApprovalSteps(
  matchingRules: ApprovalMatrixRule[],
  approvers: ApprovalApproverDefinition[],
): ApprovalStepRecord[] {
  return matchingRules.map((rule) => {
    const def = approvers.find((a) => a.code === rule.approverCode)
    return {
      sequence: rule.sequence,
      ruleId: rule.id,
      ruleLabel: rule.label,
      approverCode: rule.approverCode,
      approverLabel: def?.label ?? rule.approverCode,
      status: 'pending' as const,
    }
  })
}

export function canUserApproveStep(user: SessionUser, step: ApprovalStepRecord, approvers: ApprovalApproverDefinition[]): boolean {
  const def = approvers.find((a) => a.code === step.approverCode)
  if (!def) return false
  if (user.role === 'admin') return true
  return def.mappedRoles.includes(user.role)
}

export function getCurrentStep(request: ApprovalRequest): ApprovalStepRecord | undefined {
  if (request.status !== 'pending') return undefined
  return request.steps[request.currentStepIndex]
}

export function isApprovalComplete(request: ApprovalRequest | undefined): boolean {
  if (!request) return true
  if (request.steps.length === 0) return true
  return request.status === 'approved'
}

export function isApprovalPending(request: ApprovalRequest | undefined): boolean {
  if (!request) return false
  return request.status === 'pending'
}

export function assertMatrixApproval(
  documentType: ApprovalDocumentType,
  entityId: string,
  user: SessionUser,
): { ok: true } | { ok: false; error: string } {
  const request = useApprovalStore.getState().getActiveRequest(documentType, entityId)
  if (!request || request.steps.length === 0) return { ok: true }
  if (request.status === 'rejected') {
    return { ok: false, error: `Approval rejected: ${request.rejectionReason ?? 'No remarks'}` }
  }
  if (request.status === 'returned') {
    return { ok: false, error: 'Document returned for correction — resubmit after edits' }
  }

  const step = getCurrentStep(request)
  if (!step) {
    if (request.status === 'approved') return { ok: true }
    return { ok: false, error: 'Approval workflow incomplete' }
  }

  const approvers = useApprovalStore.getState().approvers
  if (!canUserApproveStep(user, step, approvers)) {
    return {
      ok: false,
      error: `Requires ${step.approverLabel} approval (${step.ruleLabel})`,
    }
  }
  return { ok: true }
}

export function syncApprovalRequest(input: {
  documentType: ApprovalDocumentType
  entityId: string
  entityLabel: string
  context: Record<string, unknown>
  submittedByName: string
}): ApprovalRequest {
  const store = useApprovalStore.getState()
  const matching = resolveMatchingRules(input.documentType, input.context, store.rules)
  const steps = buildApprovalSteps(matching, store.approvers)

  const existing = store.getActiveRequest(input.documentType, input.entityId)
  if (existing && (existing.status === 'pending' || existing.status === 'returned')) {
    store.updateRequestSteps(existing.id, steps)
    return store.getRequest(existing.id)!
  }

  return store.createRequest({
    documentType: input.documentType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    context: input.context,
    steps,
    submittedByName: input.submittedByName,
  })
}

export function advanceApprovalStep(
  documentType: ApprovalDocumentType,
  entityId: string,
  user: SessionUser,
  remarks = '',
): { ok: boolean; error?: string; completed?: boolean; nextApprover?: string } {
  const store = useApprovalStore.getState()
  const request = store.getActiveRequest(documentType, entityId)
  if (!request || request.steps.length === 0) return { ok: true, completed: true }

  const step = getCurrentStep(request)
  if (!step) return { ok: true, completed: request.status === 'approved' }

  const matrixCheck = assertMatrixApproval(documentType, entityId, user)
  if (!matrixCheck.ok) return matrixCheck

  const result = store.approveCurrentStep(request.id, user.name, remarks)
  if (!result.ok) return result

  const updated = store.getRequest(request.id)
  if (updated?.status === 'approved') return { ok: true, completed: true }

  const next = updated ? getCurrentStep(updated) : undefined
  return {
    ok: true,
    completed: false,
    nextApprover: next?.approverLabel,
  }
}

export function rejectApprovalStep(
  documentType: ApprovalDocumentType,
  entityId: string,
  user: SessionUser,
  remarks: string,
): { ok: boolean; error?: string } {
  if (!remarks.trim()) return { ok: false, error: 'Rejection remarks are required' }
  const store = useApprovalStore.getState()
  const request = store.getActiveRequest(documentType, entityId)
  if (!request) return { ok: false, error: 'No active approval request' }

  const matrixCheck = assertMatrixApproval(documentType, entityId, user)
  if (!matrixCheck.ok) return matrixCheck

  return store.rejectCurrentStep(request.id, user.name, remarks)
}

export function returnApprovalForCorrection(
  documentType: ApprovalDocumentType,
  entityId: string,
  user: SessionUser,
  remarks: string,
): { ok: boolean; error?: string } {
  if (!remarks.trim()) return { ok: false, error: 'Return remarks are required' }
  const store = useApprovalStore.getState()
  const request = store.getActiveRequest(documentType, entityId)
  if (!request) return { ok: false, error: 'No active approval request' }

  const matrixCheck = assertMatrixApproval(documentType, entityId, user)
  if (!matrixCheck.ok) return matrixCheck

  return store.returnForCorrection(request.id, user.name, remarks)
}

export function getEntityApprovalSummary(
  documentType: ApprovalDocumentType,
  entityId: string,
): { request: ApprovalRequest | undefined; pendingLabel: string | null } {
  const request = useApprovalStore.getState().getActiveRequest(documentType, entityId)
  if (!request || request.steps.length === 0) {
    return { request: undefined, pendingLabel: null }
  }
  const step = getCurrentStep(request)
  if (request.status === 'approved') {
    return { request, pendingLabel: null }
  }
  if (request.status === 'rejected') {
    return { request, pendingLabel: `Rejected: ${request.rejectionReason ?? '—'}` }
  }
  if (request.status === 'returned') {
    return { request, pendingLabel: `Returned: ${request.rejectionReason ?? '—'}` }
  }
  return { request, pendingLabel: step ? `${step.approverLabel} (${step.ruleLabel})` : null }
}

export function listPendingApprovalsForUser(user: SessionUser): ApprovalRequest[] {
  const store = useApprovalStore.getState()
  return store.requests.filter((r) => {
    if (r.status !== 'pending') return false
    const step = getCurrentStep(r)
    if (!step) return false
    return canUserApproveStep(user, step, store.approvers)
  })
}

export function listAllPendingApprovals(): ApprovalRequest[] {
  return useApprovalStore.getState().requests.filter((r) => r.status === 'pending')
}

export function formatRuleCondition(rule: ApprovalMatrixRule): string {
  if (rule.condition.operator === 'always') return 'Always'
  if (rule.condition.field === 'totalAmount') {
    const v = Number(rule.condition.value ?? 0)
    const lakh = v / 100_000
    const op = rule.condition.operator === 'gt' ? '>' : '≥'
    return `Amount ${op} ₹${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(2)} Lakh`
  }
  if (rule.condition.field === 'isRevision') return 'Document is a revision'
  if (rule.condition.field === 'dispatchOverride') return 'Dispatch override requested'
  if (rule.condition.field === 'qcSeverity') return `QC severity = ${rule.condition.value}`
  return rule.label
}

import type { TimelineEvent } from '../components/design-system/Timeline'

export function buildApprovalTimelineEvents(request: ApprovalRequest): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: `${request.id}-submitted`,
      label: 'Submitted for approval',
      timestamp: request.submittedAt.slice(0, 10),
      description: request.entityLabel,
      status: 'done' as const,
      actor: request.submittedByName,
    },
  ]

  for (const step of request.steps) {
    events.push({
      id: `${request.id}-${step.ruleId}`,
      label: step.ruleLabel,
      timestamp: step.approvedAt?.slice(0, 10),
      description: step.approverLabel,
      status:
        step.status === 'approved'
          ? ('done' as const)
          : step.status === 'rejected'
            ? ('done' as const)
            : request.status === 'pending' && step.sequence === request.steps[request.currentStepIndex]?.sequence
              ? ('current' as const)
              : ('pending' as const),
      actor: step.approvedByName ?? (step.status === 'pending' ? undefined : step.approverLabel),
    })
  }

  if (request.status === 'approved' && request.completedAt) {
    events.push({
      id: `${request.id}-complete`,
      label: 'Approval complete',
      timestamp: request.completedAt.slice(0, 10),
      description: 'All approvers signed off',
      status: 'done' as const,
      actor: request.steps[request.steps.length - 1]?.approvedByName,
    })
  }

  if (request.status === 'rejected' && request.completedAt) {
    events.push({
      id: `${request.id}-rejected`,
      label: 'Rejected',
      timestamp: request.completedAt.slice(0, 10),
      description: request.rejectionReason,
      status: 'done' as const,
      actor: request.steps[request.currentStepIndex]?.approvedByName,
    })
  }

  if (request.status === 'returned' && request.returnedAt) {
    events.push({
      id: `${request.id}-returned`,
      label: 'Returned for correction',
      timestamp: request.returnedAt.slice(0, 10),
      description: request.rejectionReason,
      status: 'done' as const,
      actor: request.returnedByName,
    })
  }

  return events
}
