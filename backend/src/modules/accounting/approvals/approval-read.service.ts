import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import * as repo from './approval.repository.js'
import {
  canListApprovals,
  hasApprovalPermission,
  hasViewAllApprovalsPermission,
  hasVoucherViewPermission,
  isUserEligibleForRequest,
} from './approval-eligibility.service.js'
import { resolveApprovalListItemActions } from './approval.allowed-actions.js'
import type {
  ApprovalRequestDetailDto,
  ApprovalRequestListItemDto,
  ApprovalStepDto,
  ApprovalRequestWithSteps,
  JournalApprovalTimelineEntry,
} from './approval.types.js'
import type { ListApprovalRequestsQuery } from './approval.schemas.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { toDecimal } from '../shared/finance-decimal.js'

function serializeStep(step: ApprovalRequestWithSteps['steps'][number]): ApprovalStepDto {
  return {
    id: step.id,
    level: step.level,
    sequence: step.sequence,
    approverRoleId: step.approverRoleId,
    approverUserId: step.approverUserId,
    status: step.status,
    actedBy: step.actedBy,
    actedAt: step.actedAt ? step.actedAt.toISOString() : null,
    comments: step.comments,
  }
}

function serializeListItem(
  request: ApprovalRequestWithSteps,
  allowedActions?: ApprovalRequestListItemDto['allowedActions'],
): ApprovalRequestListItemDto {
  return {
    id: request.id,
    tenantId: request.tenantId,
    legalEntityId: request.legalEntityId,
    documentType: request.documentType,
    documentId: request.documentId,
    documentNumberSnapshot: request.documentNumberSnapshot,
    documentStatusSnapshot: request.documentStatusSnapshot,
    cycleNumber: request.cycleNumber,
    status: request.status,
    amountBasis: request.amountBasis.toFixed(4),
    currencyCode: request.currencyCode,
    currentLevel: request.currentLevel,
    totalLevels: request.totalLevels,
    requestedBy: request.requestedBy,
    requestedAt: request.requestedAt.toISOString(),
    completedAt: request.completedAt ? request.completedAt.toISOString() : null,
    completedBy: request.completedBy,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    allowedActions,
  }
}

function serializeDetail(
  request: ApprovalRequestWithSteps,
  allowedActions: ApprovalRequestDetailDto['allowedActions'],
): ApprovalRequestDetailDto {
  return {
    ...serializeListItem(request, allowedActions),
    ruleSnapshotJson: request.ruleSnapshotJson,
    workflowSnapshotJson: request.workflowSnapshotJson,
    steps: request.steps.map(serializeStep),
    allowedActions,
  }
}

function buildViewFilter(
  view: ListApprovalRequestsQuery['view'],
  userId: string | undefined,
): Prisma.FinanceApprovalRequestWhereInput | undefined {
  if (view === 'all') return undefined
  if (view === 'my_pending') return { status: 'PENDING' }
  if (view === 'submitted_by_me') {
    if (!userId) return { id: '__none__' }
    return { requestedBy: userId }
  }
  if (view === 'completed_by_me') {
    if (!userId) return { id: '__none__' }
    return {
      OR: [
        { completedBy: userId },
        { steps: { some: { actedBy: userId, status: { in: ['APPROVED', 'SENT_BACK', 'REJECTED'] } } } },
      ],
    }
  }
  return { status: 'PENDING' }
}

export async function listApprovalRequests(
  req: Request,
  tenantId: string,
  query: ListApprovalRequestsQuery,
) {
  if (!canListApprovals(req)) {
    throw new AuthorizationError('Insufficient permissions to list approval requests')
  }

  if (query.view === 'all' && !hasViewAllApprovalsPermission(req)) {
    throw new AuthorizationError('Broader finance management permission required to view all approvals')
  }

  if (query.view === 'my_pending' && !hasApprovalPermission(req)) {
    throw new AuthorizationError('finance.voucher.approve required for My Pending')
  }

  if (
    (query.view === 'submitted_by_me' || query.view === 'completed_by_me') &&
    !hasApprovalPermission(req) &&
    !hasVoucherViewPermission(req)
  ) {
    throw new AuthorizationError('Insufficient permissions for this approval view')
  }

  const userId = req.context?.userId
  const extraWhere = buildViewFilter(query.view, userId)

  const amountWhere: Prisma.FinanceApprovalRequestWhereInput = {}
  if (query.amountFrom != null || query.amountTo != null) {
    amountWhere.amountBasis = {
      ...(query.amountFrom != null ? { gte: toDecimal(query.amountFrom) } : {}),
      ...(query.amountTo != null ? { lte: toDecimal(query.amountTo) } : {}),
    }
  }
  if (query.dateFrom || query.dateTo) {
    amountWhere.requestedAt = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    }
  }

  const result = await repo.listApprovalRequests(tenantId, query, {
    ...extraWhere,
    ...amountWhere,
  })

  const filteredItems =
    query.view === 'my_pending' && userId
      ? (
          await Promise.all(
            result.items.map(async (item) => ({
              item,
              eligible: await isUserEligibleForRequest(tenantId, userId, item),
            })),
          )
        )
          .filter((row) => row.eligible)
          .map((row) => row.item)
      : result.items

  const items = await Promise.all(
    filteredItems.map(async (item) => {
      const actions = await resolveApprovalListItemActions(req, tenantId, item)
      return serializeListItem(item, actions)
    }),
  )

  return { ...result, items, total: query.view === 'my_pending' ? items.length : result.total }
}

export async function getApprovalRequest(
  req: Request,
  tenantId: string,
  id: string,
): Promise<ApprovalRequestDetailDto> {
  if (!canListApprovals(req)) {
    throw new AuthorizationError('Insufficient permissions to view approval request')
  }

  const request = await repo.findRequestByIdOrThrow(tenantId, id)
  const actions = await resolveApprovalListItemActions(req, tenantId, request)
  return serializeDetail(request, actions)
}

export async function getJournalApprovalsTimeline(
  req: Request,
  tenantId: string,
  journalId: string,
): Promise<JournalApprovalTimelineEntry[]> {
  if (!canListApprovals(req)) {
    throw new AuthorizationError('Insufficient permissions to view journal approvals')
  }

  const requests = await repo.findRequestsForDocument(tenantId, 'JOURNAL', journalId)
  return requests.map((request) => ({
    requestId: request.id,
    cycleNumber: request.cycleNumber,
    status: request.status,
    requestedBy: request.requestedBy,
    requestedAt: request.requestedAt.toISOString(),
    completedAt: request.completedAt ? request.completedAt.toISOString() : null,
    completedBy: request.completedBy,
    currentLevel: request.currentLevel,
    totalLevels: request.totalLevels,
    steps: request.steps.map(serializeStep),
  }))
}

export async function canUserActOnRequest(
  req: Request,
  tenantId: string,
  request: ApprovalRequestWithSteps,
): Promise<boolean> {
  const userId = req.context?.userId
  if (!userId) return false
  return isUserEligibleForRequest(tenantId, userId, request)
}
