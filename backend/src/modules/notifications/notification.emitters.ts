import type { NotificationPriority } from '@prisma/client'
import { buildDedupKey } from './notification.constants.js'
import * as notificationService from './notification.service.js'

type BaseCtx = {
  tenantId: string
  actorUserId?: string | null
}

function safeNotify(
  promise: Promise<unknown>,
): void {
  void promise.catch(() => {
    /* never block domain write */
  })
}

export function notifyLeadAssigned(
  ctx: BaseCtx & {
    leadId: string
    leadCode?: string | null
    leadName: string
    newOwnerId: string
  },
): void {
  if (!ctx.newOwnerId) return
  safeNotify(
    notificationService.create({
      tenantId: ctx.tenantId,
      recipientUserId: ctx.newOwnerId,
      actorUserId: ctx.actorUserId,
      category: 'ASSIGNMENT',
      type: 'LEAD_ASSIGNED',
      priority: 'NORMAL',
      title: 'New lead assigned',
      message: `${ctx.leadName} has been assigned to you.`,
      entityType: 'lead',
      entityId: ctx.leadId,
      entityCode: ctx.leadCode ?? undefined,
      entityName: ctx.leadName,
      actionUrl: `/crm/leads/${ctx.leadId}`,
      primaryAction: 'OPEN',
      deduplicationKey: buildDedupKey([
        ctx.tenantId,
        'LEAD_ASSIGNED',
        ctx.leadId,
        ctx.newOwnerId,
      ]),
      sourceEventId: `lead-assigned:${ctx.leadId}:${ctx.newOwnerId}`,
    }),
  )
}

export function notifyLeadConverted(
  ctx: BaseCtx & {
    leadId: string
    leadName: string
    ownerId?: string | null
    opportunityId: string
    opportunityCode?: string | null
  },
): void {
  if (!ctx.ownerId) return
  safeNotify(
    notificationService.create({
      tenantId: ctx.tenantId,
      recipientUserId: ctx.ownerId,
      actorUserId: ctx.actorUserId,
      category: 'OPPORTUNITY',
      type: 'LEAD_CONVERTED',
      priority: 'POSITIVE',
      title: 'Lead converted',
      message: `${ctx.leadName} was converted to an opportunity.`,
      entityType: 'opportunity',
      entityId: ctx.opportunityId,
      entityCode: ctx.opportunityCode ?? undefined,
      entityName: ctx.leadName,
      actionUrl: `/crm/opportunities/${ctx.opportunityId}`,
      primaryAction: 'OPEN',
      deduplicationKey: buildDedupKey([
        ctx.tenantId,
        'LEAD_CONVERTED',
        ctx.leadId,
        ctx.ownerId,
      ]),
    }),
  )
}

export function notifyOpportunityAssigned(
  ctx: BaseCtx & {
    opportunityId: string
    opportunityCode?: string | null
    opportunityName: string
    newOwnerId: string
  },
): void {
  if (!ctx.newOwnerId) return
  safeNotify(
    notificationService.create({
      tenantId: ctx.tenantId,
      recipientUserId: ctx.newOwnerId,
      actorUserId: ctx.actorUserId,
      category: 'ASSIGNMENT',
      type: 'OPPORTUNITY_ASSIGNED',
      priority: 'NORMAL',
      title: 'Opportunity assigned',
      message: `${ctx.opportunityName} has been assigned to you.`,
      entityType: 'opportunity',
      entityId: ctx.opportunityId,
      entityCode: ctx.opportunityCode ?? undefined,
      entityName: ctx.opportunityName,
      actionUrl: `/crm/opportunities/${ctx.opportunityId}`,
      primaryAction: 'OPEN',
      deduplicationKey: buildDedupKey([
        ctx.tenantId,
        'OPPORTUNITY_ASSIGNED',
        ctx.opportunityId,
        ctx.newOwnerId,
      ]),
    }),
  )
}

export function notifyOpportunityStageChanged(
  ctx: BaseCtx & {
    opportunityId: string
    opportunityCode?: string | null
    opportunityName: string
    ownerId?: string | null
    fromStage?: string | null
    toStage: string
  },
): void {
  if (!ctx.ownerId) return
  safeNotify(
    notificationService.create({
      tenantId: ctx.tenantId,
      recipientUserId: ctx.ownerId,
      actorUserId: ctx.actorUserId,
      category: 'OPPORTUNITY',
      type: 'OPPORTUNITY_STAGE_CHANGED',
      priority: 'LOW',
      title: 'Opportunity stage updated',
      message: `${ctx.opportunityName} moved to ${ctx.toStage.replace(/_/g, ' ')}.`,
      entityType: 'opportunity',
      entityId: ctx.opportunityId,
      entityCode: ctx.opportunityCode ?? undefined,
      entityName: ctx.opportunityName,
      actionUrl: `/crm/opportunities/${ctx.opportunityId}`,
      primaryAction: 'OPEN',
      deduplicationKey: buildDedupKey([
        ctx.tenantId,
        'OPPORTUNITY_STAGE_CHANGED',
        ctx.opportunityId,
        ctx.toStage,
      ]),
    }),
  )
}

export function notifyOpportunityWonLost(
  ctx: BaseCtx & {
    opportunityId: string
    opportunityCode?: string | null
    opportunityName: string
    ownerId?: string | null
    outcome: 'won' | 'lost'
    lostReasonMissing?: boolean
  },
): void {
  if (!ctx.ownerId) return
  const type = ctx.outcome === 'won' ? 'OPPORTUNITY_WON' : 'OPPORTUNITY_LOST'
  const priority: NotificationPriority = ctx.outcome === 'won' ? 'POSITIVE' : 'HIGH'
  safeNotify(
    notificationService.create({
      tenantId: ctx.tenantId,
      recipientUserId: ctx.ownerId,
      actorUserId: ctx.actorUserId,
      category: 'OPPORTUNITY',
      type,
      priority,
      title: ctx.outcome === 'won' ? 'Opportunity won' : 'Opportunity lost',
      message:
        ctx.outcome === 'won'
          ? `${ctx.opportunityName} was marked won.`
          : ctx.lostReasonMissing
            ? `${ctx.opportunityName} was marked lost — add a lost reason.`
            : `${ctx.opportunityName} was marked lost.`,
      entityType: 'opportunity',
      entityId: ctx.opportunityId,
      entityCode: ctx.opportunityCode ?? undefined,
      entityName: ctx.opportunityName,
      actionUrl: `/crm/opportunities/${ctx.opportunityId}`,
      primaryAction: 'OPEN',
      secondaryAction: ctx.lostReasonMissing ? 'ADD_LOST_REASON' : undefined,
      deduplicationKey: buildDedupKey([ctx.tenantId, type, ctx.opportunityId, ctx.ownerId]),
    }),
  )
  if (ctx.outcome === 'lost' && ctx.lostReasonMissing) {
    safeNotify(
      notificationService.create({
        tenantId: ctx.tenantId,
        recipientUserId: ctx.ownerId,
        actorUserId: ctx.actorUserId,
        category: 'DATA_QUALITY',
        type: 'LOST_REASON_MISSING',
        priority: 'HIGH',
        title: 'Lost reason missing',
        message: `Add a lost reason for ${ctx.opportunityName}.`,
        entityType: 'opportunity',
        entityId: ctx.opportunityId,
        actionUrl: `/crm/opportunities/${ctx.opportunityId}`,
        primaryAction: 'OPEN',
        deduplicationKey: buildDedupKey([
          ctx.tenantId,
          'LOST_REASON_MISSING',
          ctx.opportunityId,
        ]),
      }),
    )
  }
}

export function notifyActivityAssigned(
  ctx: BaseCtx & {
    activityId: string
    subject: string
    assigneeId: string
  },
): void {
  if (!ctx.assigneeId) return
  safeNotify(
    notificationService.create({
      tenantId: ctx.tenantId,
      recipientUserId: ctx.assigneeId,
      actorUserId: ctx.actorUserId,
      category: 'ACTIVITY',
      type: 'ACTIVITY_ASSIGNED',
      priority: 'NORMAL',
      title: 'Activity assigned',
      message: ctx.subject,
      entityType: 'activity',
      entityId: ctx.activityId,
      entityName: ctx.subject,
      actionUrl: `/crm/activities?id=${ctx.activityId}`,
      primaryAction: 'OPEN',
      deduplicationKey: buildDedupKey([
        ctx.tenantId,
        'ACTIVITY_ASSIGNED',
        ctx.activityId,
        ctx.assigneeId,
      ]),
    }),
  )
}

export function notifyFollowUpDueOrOverdue(
  ctx: BaseCtx & {
    followUpId: string
    assigneeId: string
    label: string
    dueDateKey: string
    overdue: boolean
    hoursOverdue?: number
  },
): void {
  if (!ctx.assigneeId) return
  let priority: NotificationPriority = 'HIGH'
  let escalationLevel = 0
  if (ctx.overdue) {
    const h = ctx.hoursOverdue ?? 0
    if (h > 72) {
      priority = 'CRITICAL'
      escalationLevel = 2
    } else if (h > 24) {
      priority = 'HIGH'
      escalationLevel = 1
    }
  } else {
    priority = 'NORMAL'
  }
  safeNotify(
    notificationService.create({
      tenantId: ctx.tenantId,
      recipientUserId: ctx.assigneeId,
      actorUserId: ctx.actorUserId,
      category: 'FOLLOW_UP',
      type: ctx.overdue ? 'FOLLOW_UP_OVERDUE' : 'FOLLOW_UP_DUE',
      priority,
      title: ctx.overdue ? 'Follow-up overdue' : 'Follow-up due today',
      message: ctx.label,
      entityType: 'follow_up',
      entityId: ctx.followUpId,
      entityName: ctx.label,
      actionUrl: `/crm/follow-ups?id=${ctx.followUpId}`,
      primaryAction: 'OPEN',
      secondaryAction: 'COMPLETE',
      deduplicationKey: buildDedupKey([
        ctx.tenantId,
        ctx.overdue ? 'FOLLOW_UP_OVERDUE' : 'FOLLOW_UP_DUE',
        ctx.followUpId,
        ctx.assigneeId,
        ctx.dueDateKey,
      ]),
      escalateIfExists: ctx.overdue,
      escalationLevel,
    }),
  )
}

export function resolveFollowUpNotifications(tenantId: string, followUpId: string): void {
  safeNotify(
    notificationService.resolveRelated(tenantId, 'follow_up', followUpId, [
      'FOLLOW_UP_DUE',
      'FOLLOW_UP_OVERDUE',
    ]),
  )
}

export function resolveLeadUnattended(tenantId: string, leadId: string): void {
  safeNotify(
    notificationService.resolveRelated(tenantId, 'lead', leadId, ['LEAD_UNATTENDED']),
  )
}

export function resolveActivityNotifications(tenantId: string, activityId: string): void {
  safeNotify(
    notificationService.resolveRelated(tenantId, 'activity', activityId, [
      'ACTIVITY_ASSIGNED',
      'ACTIVITY_DUE',
      'ACTIVITY_OVERDUE',
    ]),
  )
}

export function notifyQuotationApprovalRequested(
  ctx: BaseCtx & {
    quotationId: string
    quotationCode?: string | null
    approverId: string
    companyName?: string | null
    amountLabel?: string | null
  },
): void {
  if (!ctx.approverId) return
  safeNotify(
    notificationService.create({
      tenantId: ctx.tenantId,
      recipientUserId: ctx.approverId,
      actorUserId: ctx.actorUserId,
      category: 'APPROVAL',
      type: 'QUOTATION_APPROVAL_REQUESTED',
      priority: 'HIGH',
      title: 'Quotation approval required',
      message: [
        ctx.quotationCode ?? 'Quotation',
        ctx.companyName,
        ctx.amountLabel,
      ]
        .filter(Boolean)
        .join(' · '),
      entityType: 'quotation',
      entityId: ctx.quotationId,
      entityCode: ctx.quotationCode ?? undefined,
      actionUrl: `/crm/quotations/${ctx.quotationId}`,
      primaryAction: 'REVIEW',
      secondaryAction: 'APPROVE',
      deduplicationKey: buildDedupKey([
        ctx.tenantId,
        'QUOTATION_APPROVAL_REQUESTED',
        ctx.quotationId,
        ctx.approverId,
      ]),
    }),
  )
}

export function notifyQuotationApprovedOrRejected(
  ctx: BaseCtx & {
    quotationId: string
    quotationCode?: string | null
    ownerIds: string[]
    approved: boolean
    reason?: string | null
  },
): void {
  const type = ctx.approved ? 'QUOTATION_APPROVED' : 'QUOTATION_REJECTED'
  const priority: NotificationPriority = ctx.approved ? 'POSITIVE' : 'CRITICAL'
  for (const ownerId of new Set(ctx.ownerIds.filter(Boolean))) {
    safeNotify(
      notificationService.create({
        tenantId: ctx.tenantId,
        recipientUserId: ownerId,
        actorUserId: ctx.actorUserId,
        category: 'QUOTATION',
        type,
        priority,
        title: ctx.approved ? 'Quotation approved' : 'Quotation rejected',
        message: ctx.approved
          ? `${ctx.quotationCode ?? 'Quotation'} was approved.`
          : `${ctx.quotationCode ?? 'Quotation'} was rejected${ctx.reason ? `: ${ctx.reason}` : '.'}`,
        entityType: 'quotation',
        entityId: ctx.quotationId,
        entityCode: ctx.quotationCode ?? undefined,
        actionUrl: `/crm/quotations/${ctx.quotationId}`,
        primaryAction: 'OPEN',
        deduplicationKey: buildDedupKey([ctx.tenantId, type, ctx.quotationId, ownerId]),
      }),
    )
  }
  if (ctx.approved || !ctx.approved) {
    safeNotify(
      notificationService.resolveRelated(ctx.tenantId, 'quotation', ctx.quotationId, [
        'QUOTATION_APPROVAL_REQUESTED',
      ]),
    )
  }
}

export function notifyIntegrationFailure(
  ctx: BaseCtx & {
    integrationKey: string
    title: string
    message: string
    adminUserIds: string[]
  },
): void {
  for (const adminId of new Set(ctx.adminUserIds.filter(Boolean))) {
    safeNotify(
      notificationService.create({
        tenantId: ctx.tenantId,
        recipientUserId: adminId,
        actorUserId: ctx.actorUserId,
        category: 'INTEGRATION',
        type: 'INTEGRATION_SYNC_FAILED',
        priority: 'CRITICAL',
        title: ctx.title,
        message: ctx.message,
        entityType: 'integration',
        entityId: ctx.integrationKey,
        actionUrl: `/crm/integrations/indiamart`,
        primaryAction: 'OPEN',
        deduplicationKey: buildDedupKey([
          ctx.tenantId,
          'INTEGRATION_SYNC_FAILED',
          ctx.integrationKey,
          adminId,
          // day bucket so one critical alert/day per admin
          new Date().toISOString().slice(0, 10),
        ]),
        escalateIfExists: true,
      }),
    )
  }
}
