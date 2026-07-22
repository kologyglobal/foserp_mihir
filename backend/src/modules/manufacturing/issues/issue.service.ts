import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { recomputeOrderHealth } from '../work-orders/work-order-health.service.js'
import { resumeAssignment } from '../assignments/assignment.service.js'
import { endOpenAssignmentDowntime, startDowntime } from '../downtime/downtime.service.js'
import { getPagination } from '../../../utils/pagination.js'
import type {
  AcknowledgeIssueInput,
  CancelIssueInput,
  ListIssuesQuery,
  ReportIssueInput,
  ResolveIssueInput,
} from './issue.schemas.js'

const OPEN_ISSUE_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] as const

export async function reportIssue(req: Request, tenantId: string, input: ReportIssueInput) {
  const userId = req.context?.userId ?? ''

  let context = { ...input }
  if (input.assignmentId) {
    const assignment = await prisma.productionAssignment.findFirst({ where: { id: input.assignmentId, tenantId } })
    if (!assignment) throw new NotFoundError('Assignment not found')
    context = {
      ...context,
      productionOrderId: assignment.productionOrderId,
      stageId: assignment.stageId,
      operationId: assignment.operationId ?? undefined,
      workCentreId: assignment.workCentreId ?? undefined,
      machineId: assignment.machineId ?? undefined,
    }
  }

  if (!context.productionOrderId) throw new NotFoundError('productionOrderId is required')

  const issueNumber = await nextCode(tenantId, 'PRODUCTION_ISSUE')

  const issue = await prisma.$transaction(async (tx) => {
    const row = await tx.productionIssue.create({
      data: {
        tenantId,
        issueNumber,
        productionOrderId: context.productionOrderId!,
        stageId: context.stageId ?? null,
        operationId: context.operationId ?? null,
        assignmentId: input.assignmentId ?? null,
        workCentreId: context.workCentreId ?? null,
        machineId: context.machineId ?? null,
        reportedByUserId: userId,
        reportedByEmployeeId: input.reportedByEmployeeId ?? null,
        issueType: input.issueType,
        severity: input.severity,
        title: input.title,
        description: input.description ?? null,
        expectedImpactMinutes: input.expectedImpactMinutes ?? null,
        productionBlocked: input.productionBlocked,
        attachmentReference: input.attachmentReference ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    if (context.stageId) {
      await tx.productionOrderStage.update({
        where: { id: context.stageId },
        data: { openIssueCount: { increment: 1 } },
      })
      if (input.productionBlocked && input.stageWideBlock) {
        await tx.productionOrderStage.update({
          where: { id: context.stageId },
          data: { status: 'BLOCKED' },
        })
      }
    }

    if (input.productionBlocked && input.assignmentId) {
      const assignment = await tx.productionAssignment.findFirst({ where: { id: input.assignmentId, tenantId } })
      if (assignment?.status === 'IN_PROGRESS') {
        await tx.productionAssignment.update({
          where: { id: assignment.id },
          data: { status: 'PAUSED', pausedAt: new Date(), updatedBy: userId },
        })
      }
    }

    if (input.startDowntime) {
      await startDowntime(tx, {
        tenantId,
        productionOrderId: context.productionOrderId!,
        stageId: context.stageId,
        operationId: context.operationId,
        assignmentId: input.assignmentId,
        issueId: row.id,
        workCentreId: context.workCentreId,
        machineId: context.machineId,
        scope: input.stageWideBlock ? 'WORK_ORDER' : 'TASK',
        reasonType: input.issueType,
        reasonLabel: input.title,
        startedBy: userId,
      })
    }

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: context.productionOrderId!,
        activityType: 'ISSUE_REPORTED',
        userId,
        message: `Production issue reported: ${input.title}`,
        newValue: { issueId: row.id, issueNumber },
      },
      tx,
    )

    await recomputeOrderHealth(tx, tenantId, context.productionOrderId!)
    return row
  })

  return issue
}

export async function acknowledgeIssue(req: Request, tenantId: string, id: string, input: AcknowledgeIssueInput) {
  const userId = req.context?.userId ?? ''
  const issue = await getIssue(tenantId, id)
  if (issue.status !== 'OPEN') throw new InvalidStateError('Only OPEN issues can be acknowledged')

  return prisma.$transaction(async (tx) => {
    const updated = await tx.productionIssue.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: userId, updatedBy: userId },
    })
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: issue.productionOrderId,
        activityType: 'ISSUE_ACKNOWLEDGED',
        userId,
        message: `Issue ${issue.issueNumber} acknowledged`,
        reason: input.remarks ?? null,
      },
      tx,
    )
    return updated
  })
}

export async function markIssueInProgress(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const issue = await getIssue(tenantId, id)
  if (!['OPEN', 'ACKNOWLEDGED'].includes(issue.status)) {
    throw new InvalidStateError('Issue cannot be marked in progress from current status')
  }

  return prisma.productionIssue.update({
    where: { id },
    data: { status: 'IN_PROGRESS', updatedBy: userId },
  })
}

export async function resolveIssue(req: Request, tenantId: string, id: string, input: ResolveIssueInput) {
  const userId = req.context?.userId ?? ''
  const issue = await getIssue(tenantId, id)
  if (!OPEN_ISSUE_STATUSES.includes(issue.status as (typeof OPEN_ISSUE_STATUSES)[number])) {
    throw new InvalidStateError('Issue is already closed')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.productionIssue.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: userId,
        resolution: input.resolution,
        actualDowntimeMinutes: input.actualDowntimeMinutes ?? null,
        updatedBy: userId,
      },
    })

    if (issue.stageId) {
      await tx.productionOrderStage.update({
        where: { id: issue.stageId },
        data: { openIssueCount: { decrement: 1 } },
      })
      const remainingOpen = await tx.productionIssue.count({
        where: {
          tenantId,
          stageId: issue.stageId,
          status: { in: [...OPEN_ISSUE_STATUSES] },
          id: { not: id },
        },
      })
      if (remainingOpen === 0) {
        const stage = await tx.productionOrderStage.findFirst({ where: { id: issue.stageId, tenantId } })
        if (stage?.status === 'BLOCKED') {
          await tx.productionOrderStage.update({ where: { id: issue.stageId }, data: { status: 'IN_PROGRESS' } })
        }
      }
    }

    if (input.endDowntime && issue.assignmentId) {
      await endOpenAssignmentDowntime(tx, tenantId, issue.assignmentId, userId)
    }

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: issue.productionOrderId,
        activityType: 'ISSUE_RESOLVED',
        userId,
        message: `Issue ${issue.issueNumber} resolved`,
        reason: input.resolution,
      },
      tx,
    )

    await recomputeOrderHealth(tx, tenantId, issue.productionOrderId)
    return row
  })

  if (input.resumeAssignment && issue.assignmentId) {
    const assignment = await prisma.productionAssignment.findFirst({ where: { id: issue.assignmentId, tenantId } })
    if (assignment?.status === 'PAUSED') {
      await resumeAssignment(req, tenantId, issue.assignmentId)
    }
  }

  return updated
}

export async function cancelIssue(req: Request, tenantId: string, id: string, input: CancelIssueInput) {
  const userId = req.context?.userId ?? ''
  const issue = await getIssue(tenantId, id)
  if (!OPEN_ISSUE_STATUSES.includes(issue.status as (typeof OPEN_ISSUE_STATUSES)[number])) {
    throw new InvalidStateError('Issue is already closed')
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.productionIssue.update({
      where: { id },
      data: { status: 'CANCELLED', updatedBy: userId },
    })
    if (issue.stageId) {
      await tx.productionOrderStage.update({
        where: { id: issue.stageId },
        data: { openIssueCount: { decrement: 1 } },
      })
    }
    await logProductionActivity(
      {
        tenantId,
        productionOrderId: issue.productionOrderId,
        activityType: 'ISSUE_CANCELLED',
        userId,
        message: `Issue ${issue.issueNumber} cancelled`,
        reason: input.reason ?? null,
      },
      tx,
    )
    await recomputeOrderHealth(tx, tenantId, issue.productionOrderId)
    return row
  })
}

export async function getIssue(tenantId: string, id: string) {
  const issue = await prisma.productionIssue.findFirst({ where: { id, tenantId } })
  if (!issue) throw new NotFoundError('Issue not found')
  return issue
}

export async function listIssues(tenantId: string, query: ListIssuesQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where = {
    tenantId,
    ...(query.productionOrderId ? { productionOrderId: query.productionOrderId } : {}),
    ...(query.stageId ? { stageId: query.stageId } : {}),
    ...(query.assignmentId ? { assignmentId: query.assignmentId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.issueType ? { issueType: query.issueType } : {}),
    ...(query.severity ? { severity: query.severity } : {}),
    ...(query.productionBlocked !== undefined ? { productionBlocked: query.productionBlocked } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.productionIssue.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.productionIssue.count({ where }),
  ])

  return { items, total, page, limit }
}
