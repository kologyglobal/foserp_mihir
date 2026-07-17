import type { Request } from 'express'
import type { FinanceApprovalStep } from '@prisma/client'
import { ApprovalError, type ApprovalErrorCode } from './approval.errors.js'
import * as repo from './approval.repository.js'
import type { ApprovalRequestWithSteps } from './approval.types.js'
import type { JournalWithLines } from '../journals/journal.types.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function hasApprovalPermission(req: Request): boolean {
  return hasPerm(req, 'finance.voucher.approve')
}

export function hasViewAllApprovalsPermission(req: Request): boolean {
  return hasPerm(req, 'finance.settings.manage') || hasPerm(req, 'tenant.manage')
}

export function hasVoucherViewPermission(req: Request): boolean {
  return hasPerm(req, 'finance.voucher.view') || hasPerm(req, 'finance.audit.view')
}

export function canListApprovals(req: Request): boolean {
  return hasApprovalPermission(req) || hasVoucherViewPermission(req) || hasViewAllApprovalsPermission(req)
}

export async function userMatchesStepApprover(
  tenantId: string,
  userId: string,
  step: FinanceApprovalStep,
): Promise<boolean> {
  if (step.approverUserId && step.approverUserId === userId) return true
  if (step.approverRoleId) {
    return repo.userHasRole(tenantId, userId, step.approverRoleId)
  }
  return false
}

export async function resolveCurrentPendingStep(
  request: ApprovalRequestWithSteps,
): Promise<FinanceApprovalStep | null> {
  return (
    request.steps.find((s) => s.level === request.currentLevel && s.status === 'PENDING') ?? null
  )
}

export interface ApprovalEligibilityResult {
  eligible: boolean
  reason?: ApprovalErrorCode
  message?: string
  pendingStep?: FinanceApprovalStep | null
  pendingRequest?: ApprovalRequestWithSteps | null
}

export async function checkJournalApprovalEligibility(
  req: Request,
  tenantId: string,
  journal: JournalWithLines,
): Promise<ApprovalEligibilityResult> {
  if (!hasApprovalPermission(req)) {
    return { eligible: false, reason: 'APPROVAL_UNAUTHORIZED', message: 'Approval permission required' }
  }

  if (journal.status !== 'PENDING_APPROVAL') {
    return {
      eligible: false,
      reason: 'JOURNAL_NOT_PENDING_APPROVAL',
      message: `Journal status ${journal.status} is not pending approval`,
    }
  }

  const userId = req.context?.userId
  if (!userId) {
    return { eligible: false, reason: 'APPROVAL_UNAUTHORIZED', message: 'User context required' }
  }

  if (journal.createdBy && journal.createdBy === userId) {
    return {
      eligible: false,
      reason: 'SELF_APPROVAL_NOT_ALLOWED',
      message: 'You cannot approve a journal you created (maker-checker)',
    }
  }

  const pendingRequest = await repo.findPendingRequestForDocument(tenantId, 'JOURNAL', journal.id)
  if (!pendingRequest) {
    return {
      eligible: false,
      reason: 'APPROVAL_REQUEST_MISSING',
      message: 'No pending approval request for this journal',
    }
  }

  if (pendingRequest.status !== 'PENDING') {
    return {
      eligible: false,
      reason: 'APPROVAL_REQUEST_NOT_PENDING',
      message: 'Approval request is not pending',
    }
  }

  const pendingStep = await resolveCurrentPendingStep(pendingRequest)
  if (!pendingStep) {
    return {
      eligible: false,
      reason: 'APPROVAL_STEP_NOT_FOUND',
      message: 'No pending approval step at current level',
    }
  }

  const matches = await userMatchesStepApprover(tenantId, userId, pendingStep)
  if (!matches) {
    return {
      eligible: false,
      reason: 'APPROVER_NOT_ELIGIBLE',
      message: 'You are not the designated approver for the current level',
    }
  }

  return { eligible: true, pendingStep, pendingRequest }
}

export async function assertJournalApprovalEligible(
  req: Request,
  tenantId: string,
  journal: JournalWithLines,
): Promise<{ pendingRequest: ApprovalRequestWithSteps; pendingStep: FinanceApprovalStep }> {
  const result = await checkJournalApprovalEligibility(req, tenantId, journal)
  if (!result.eligible || !result.pendingRequest || !result.pendingStep) {
    throw new ApprovalError(
      result.reason ?? 'APPROVER_NOT_ELIGIBLE',
      result.message ?? 'Not eligible to act on this approval',
    )
  }
  return { pendingRequest: result.pendingRequest, pendingStep: result.pendingStep }
}

export async function isUserEligibleForRequest(
  tenantId: string,
  userId: string,
  request: ApprovalRequestWithSteps,
): Promise<boolean> {
  if (request.status !== 'PENDING') return false
  const step = await resolveCurrentPendingStep(request)
  if (!step) return false
  return userMatchesStepApprover(tenantId, userId, step)
}
