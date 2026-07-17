import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import { toDecimal } from '../shared/finance-decimal.js'
import type { ListApprovalRequestsQuery } from './approval.schemas.js'
import type { ApprovalRequestWithSteps } from './approval.types.js'

export async function findPendingRequestForDocument(
  tenantId: string,
  documentType: 'JOURNAL',
  documentId: string,
): Promise<ApprovalRequestWithSteps | null> {
  return prisma.financeApprovalRequest.findFirst({
    where: {
      tenantId,
      documentType,
      documentId,
      status: 'PENDING',
    },
    include: { steps: { orderBy: [{ level: 'asc' }, { sequence: 'asc' }] } },
  })
}

export async function findRequestByIdOrThrow(
  tenantId: string,
  id: string,
): Promise<ApprovalRequestWithSteps> {
  const item = await prisma.financeApprovalRequest.findFirst({
    where: { id, tenantId },
    include: { steps: { orderBy: [{ level: 'asc' }, { sequence: 'asc' }] } },
  })
  if (!item) throw new NotFoundError('Approval request not found')
  return item
}

export async function findRequestsForDocument(
  tenantId: string,
  documentType: 'JOURNAL',
  documentId: string,
): Promise<ApprovalRequestWithSteps[]> {
  return prisma.financeApprovalRequest.findMany({
    where: { tenantId, documentType, documentId },
    include: { steps: { orderBy: [{ level: 'asc' }, { sequence: 'asc' }] } },
    orderBy: [{ cycleNumber: 'asc' }],
  })
}

export async function getMaxCycleNumber(
  tenantId: string,
  legalEntityId: string,
  documentType: 'JOURNAL',
  documentId: string,
): Promise<number> {
  const agg = await prisma.financeApprovalRequest.aggregate({
    where: { tenantId, legalEntityId, documentType, documentId },
    _max: { cycleNumber: true },
  })
  return agg._max.cycleNumber ?? 0
}

export async function listApprovalRequests(
  tenantId: string,
  query: ListApprovalRequestsQuery,
  extraWhere?: Prisma.FinanceApprovalRequestWhereInput,
) {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId!)
  const { skip, take } = getPagination(query)

  const where: Prisma.FinanceApprovalRequestWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.documentType ? { documentType: query.documentType } : {}),
    ...(query.search
      ? {
          OR: [
            { documentNumberSnapshot: { contains: query.search } },
            { documentId: { contains: query.search } },
          ],
        }
      : {}),
    ...extraWhere,
  }

  const [items, total] = await Promise.all([
    prisma.financeApprovalRequest.findMany({
      where,
      skip,
      take,
      orderBy: { requestedAt: 'desc' },
      include: { steps: { orderBy: [{ level: 'asc' }, { sequence: 'asc' }] } },
    }),
    prisma.financeApprovalRequest.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function createApprovalRequestWithSteps(
  data: {
    tenantId: string
    legalEntityId: string
    documentType: 'JOURNAL'
    documentId: string
    documentNumberSnapshot: string | null
    documentStatusSnapshot: string
    cycleNumber: number
    amountBasis: string
    currencyCode: string
    currentLevel: number
    totalLevels: number
    requestedBy: string
    ruleSnapshotJson: unknown
    workflowSnapshotJson: unknown
    steps: Array<{
      level: number
      sequence: number
      approverRoleId: string | null
      approverUserId: string | null
      status: 'WAITING' | 'PENDING'
    }>
  },
) {
  return prisma.financeApprovalRequest.create({
    data: {
      tenantId: data.tenantId,
      legalEntityId: data.legalEntityId,
      documentType: data.documentType,
      documentId: data.documentId,
      documentNumberSnapshot: data.documentNumberSnapshot,
      documentStatusSnapshot: data.documentStatusSnapshot,
      cycleNumber: data.cycleNumber,
      status: 'PENDING',
      amountBasis: toDecimal(data.amountBasis),
      currencyCode: data.currencyCode,
      currentLevel: data.currentLevel,
      totalLevels: data.totalLevels,
      requestedBy: data.requestedBy,
      ruleSnapshotJson: data.ruleSnapshotJson as Prisma.InputJsonValue,
      workflowSnapshotJson: data.workflowSnapshotJson as Prisma.InputJsonValue,
      steps: {
        create: data.steps.map((step) => ({
          tenantId: data.tenantId,
          legalEntityId: data.legalEntityId,
          level: step.level,
          sequence: step.sequence,
          approverRoleId: step.approverRoleId,
          approverUserId: step.approverUserId,
          status: step.status,
        })),
      },
    },
    include: { steps: { orderBy: [{ level: 'asc' }, { sequence: 'asc' }] } },
  })
}

export async function userHasRole(tenantId: string, userId: string, roleId: string): Promise<boolean> {
  const link = await prisma.userRole.findFirst({
    where: { tenantId, userId, roleId },
  })
  return link != null
}
