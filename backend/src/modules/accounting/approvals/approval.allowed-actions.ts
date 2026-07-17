import type { Request } from 'express'
import {
  hasApprovalPermission,
  hasViewAllApprovalsPermission,
  checkJournalApprovalEligibility,
  isUserEligibleForRequest,
} from './approval-eligibility.service.js'
import type { ApprovalRequestAllowedActions } from './approval.types.js'
import type { ApprovalRequestWithSteps } from './approval.types.js'
import type { JournalWithLines } from '../journals/journal.types.js'

export function buildApprovalRequestAllowedActions(
  req: Request,
  request: ApprovalRequestWithSteps,
  eligible: boolean,
): ApprovalRequestAllowedActions {
  const canApprove = hasApprovalPermission(req)
  return {
    view: canApprove || hasViewAllApprovalsPermission(req),
    approve: eligible && canApprove && request.status === 'PENDING',
    reject: eligible && canApprove && request.status === 'PENDING',
    sendBack: eligible && canApprove && request.status === 'PENDING',
  }
}

export async function resolveJournalWorkflowActions(
  req: Request,
  journal: JournalWithLines,
): Promise<{ approve: boolean; reject: boolean; sendBack: boolean }> {
  if (journal.status !== 'PENDING_APPROVAL') {
    return { approve: false, reject: false, sendBack: false }
  }
  const eligibility = await checkJournalApprovalEligibility(req, journal.tenantId, journal)
  return {
    approve: eligibility.eligible,
    reject: eligibility.eligible,
    sendBack: eligibility.eligible,
  }
}

export async function resolveApprovalListItemActions(
  req: Request,
  tenantId: string,
  request: ApprovalRequestWithSteps,
): Promise<ApprovalRequestAllowedActions> {
  const userId = req.context?.userId
  const eligible =
    userId != null && (await isUserEligibleForRequest(tenantId, userId, request))
  return buildApprovalRequestAllowedActions(req, request, eligible)
}
