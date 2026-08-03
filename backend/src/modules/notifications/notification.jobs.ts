import type { NotificationPriority } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { logger } from '../../config/logger.js'
import { decimalToNumber } from '../../shared/index.js'
import { buildDedupKey } from './notification.constants.js'
import * as repo from './notification.repository.js'
import * as notificationService from './notification.service.js'
import { businessHoursBetween, localDateKey, resolveTimezone } from './sla-time.js'

/**
 * Time-based CRM notification scans (follow-ups, unattended leads, stuck/inactive opps).
 * Idempotent via deduplicationKey.
 */
export async function runNotificationDueScan(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, timezone: true },
    take: 200,
  })

  for (const tenant of tenants) {
    try {
      await scanTenant(tenant.id, tenant.timezone)
    } catch (err) {
      logger.warn('notification due scan failed for tenant', {
        tenantId: tenant.id,
        message: (err as Error).message,
      })
    }
  }
}

async function scanTenant(tenantId: string, tenantTimezone: string): Promise<void> {
  const settings = await repo.getOrCreateTenantSettings(tenantId)
  const tz = resolveTimezone(tenantTimezone, settings.timezoneOverride)
  const now = new Date()
  const todayKey = localDateKey(now, tz)

  await scanFollowUps(tenantId, settings, now, todayKey)
  await scanUnattendedLeads(tenantId, settings, tz, now)
  await scanOpportunities(tenantId, settings, now, todayKey)
  await scanQuotations(tenantId, settings, now, todayKey)
}

function humanizeToken(value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function clipNotes(notes: string | null | undefined, max = 90): string | null {
  const t = notes?.replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

type FollowUpCtx = {
  typeLabel: string
  partyName: string | null
  recordCode: string | null
  recordLabel: string | null
  contactName: string | null
  dueTime: string | null
  notesSnippet: string | null
  message: string
  title: string
  actionUrl: string
  entityType: string
  entityId: string
  entityCode: string | undefined
  entityName: string | undefined
}

async function buildFollowUpContexts(
  tenantId: string,
  rows: Array<{
    id: string
    followUpType: string
    companyId: string | null
    contactId: string | null
    opportunityId: string | null
    leadId: string | null
    dueDate: Date
    dueTime: string
    notes: string | null
    priority: string
  }>,
  todayKey: string,
  overdueById: Map<string, boolean>,
): Promise<Map<string, FollowUpCtx>> {
  const companyIds = [...new Set(rows.map((r) => r.companyId).filter(Boolean))] as string[]
  const contactIds = [...new Set(rows.map((r) => r.contactId).filter(Boolean))] as string[]
  const leadIds = [...new Set(rows.map((r) => r.leadId).filter(Boolean))] as string[]
  const oppIds = [...new Set(rows.map((r) => r.opportunityId).filter(Boolean))] as string[]

  const [companies, contacts, leads, opps] = await Promise.all([
    companyIds.length
      ? prisma.crmCompany.findMany({
          where: { tenantId, id: { in: companyIds }, deletedAt: null },
          select: { id: true, name: true, companyCode: true },
        })
      : Promise.resolve([]),
    contactIds.length
      ? prisma.crmContact.findMany({
          where: { tenantId, id: { in: contactIds }, deletedAt: null },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    leadIds.length
      ? prisma.crmLead.findMany({
          where: { tenantId, id: { in: leadIds }, deletedAt: null },
          select: { id: true, prospectName: true, leadCode: true, companyId: true },
        })
      : Promise.resolve([]),
    oppIds.length
      ? prisma.crmOpportunity.findMany({
          where: { tenantId, id: { in: oppIds }, deletedAt: null },
          select: { id: true, name: true, opportunityCode: true, companyId: true },
        })
      : Promise.resolve([]),
  ])

  const companyMap = new Map(companies.map((c) => [c.id, c]))
  const contactMap = new Map(contacts.map((c) => [c.id, c]))
  const leadMap = new Map(leads.map((l) => [l.id, l]))
  const oppMap = new Map(opps.map((o) => [o.id, o]))

  const out = new Map<string, FollowUpCtx>()
  for (const fu of rows) {
    const typeLabel = humanizeToken(fu.followUpType) || 'Follow-up'
    const lead = fu.leadId ? leadMap.get(fu.leadId) : undefined
    const opp = fu.opportunityId ? oppMap.get(fu.opportunityId) : undefined
    const companyId = fu.companyId ?? lead?.companyId ?? opp?.companyId ?? null
    const company = companyId ? companyMap.get(companyId) : undefined
    const contact = fu.contactId ? contactMap.get(fu.contactId) : undefined
    const contactName =
      [contact?.firstName, contact?.lastName].filter(Boolean).join(' ').trim() || null

    const partyName =
      company?.name?.trim()
      || lead?.prospectName?.trim()
      || opp?.name?.trim()
      || contactName
      || null

    const recordCode = lead?.leadCode ?? opp?.opportunityCode ?? company?.companyCode ?? null
    const recordLabel = lead
      ? 'Lead'
      : opp
        ? 'Opportunity'
        : company
          ? 'Company'
          : null

    const dueKey = fu.dueDate.toISOString().slice(0, 10)
    const dueTime = fu.dueTime?.trim() || null
    const overdue = overdueById.get(fu.id) === true
    const when =
      overdue
        ? `overdue since ${dueKey}${dueTime ? ` ${dueTime}` : ''}`
        : dueKey === todayKey
          ? `due today${dueTime ? ` at ${dueTime}` : ''}`
          : `due ${dueKey}${dueTime ? ` ${dueTime}` : ''}`

    const parts: string[] = [`${typeLabel} ${when}`]
    if (partyName) parts.push(partyName)
    if (recordCode) {
      parts.push(recordLabel ? `${recordLabel} ${recordCode}` : recordCode)
    }
    if (contactName && contactName !== partyName) {
      parts.push(`Contact: ${contactName}`)
    }
    const notesSnippet = clipNotes(fu.notes)
    if (notesSnippet) parts.push(`Note: ${notesSnippet}`)
    if (fu.priority && fu.priority !== 'medium' && fu.priority !== 'normal') {
      parts.push(`Priority: ${humanizeToken(fu.priority)}`)
    }

    // Keep entity keys on the follow-up so complete/reschedule can auto-resolve.
    // Deep-link Open to the primary CRM record when available.
    let actionUrl = `/crm/follow-ups?id=${fu.id}`
    if (lead) actionUrl = `/crm/leads/${lead.id}`
    else if (opp) actionUrl = `/crm/opportunities/${opp.id}`

    out.set(fu.id, {
      typeLabel,
      partyName,
      recordCode,
      recordLabel,
      contactName,
      dueTime,
      notesSnippet,
      message: parts.join(' · '),
      title: overdue ? `${typeLabel} overdue` : `${typeLabel} due today`,
      actionUrl,
      entityType: 'follow_up',
      entityId: fu.id,
      entityCode: recordCode ?? undefined,
      entityName: partyName ?? typeLabel,
    })
  }
  return out
}

async function scanFollowUps(
  tenantId: string,
  settings: Awaited<ReturnType<typeof repo.getOrCreateTenantSettings>>,
  now: Date,
  todayKey: string,
): Promise<void> {
  const endOfToday = new Date(`${todayKey}T23:59:59.999Z`)
  const dueRows = await prisma.crmFollowUp.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['pending', 'overdue', 'snoozed'] },
      dueDate: { lte: endOfToday },
      assignedTo: { not: null },
    },
    take: 500,
    orderBy: { dueDate: 'asc' },
  })

  if (dueRows.length === 0) return

  const overdueById = new Map<string, boolean>()
  for (const fu of dueRows) {
    const dueKey = fu.dueDate.toISOString().slice(0, 10)
    overdueById.set(fu.id, dueKey < todayKey)
  }

  const contexts = await buildFollowUpContexts(tenantId, dueRows, todayKey, overdueById)

  for (const fu of dueRows) {
    if (!fu.assignedTo) continue
    const dueKey = fu.dueDate.toISOString().slice(0, 10)
    const overdue = overdueById.get(fu.id) === true
    const hoursOverdue = overdue
      ? (now.getTime() - new Date(`${dueKey}T23:59:59.000Z`).getTime()) / 3_600_000
      : 0

    let priority: NotificationPriority = overdue ? 'HIGH' : 'NORMAL'
    let escalationLevel = 0
    if (overdue && hoursOverdue >= settings.followUpCriticalHours) {
      priority = 'CRITICAL'
      escalationLevel = 2
    } else if (overdue && hoursOverdue >= settings.followUpEscalateHours) {
      priority = 'HIGH'
      escalationLevel = 1
    }

    const ctx = contexts.get(fu.id)
    const message =
      ctx?.message
      ?? `${humanizeToken(fu.followUpType) || 'Follow-up'} · due ${dueKey}`

    await notificationService.create({
      tenantId,
      recipientUserId: fu.assignedTo,
      category: 'FOLLOW_UP',
      type: overdue ? 'FOLLOW_UP_OVERDUE' : 'FOLLOW_UP_DUE',
      priority,
      title: ctx?.title ?? (overdue ? 'Follow-up overdue' : 'Follow-up due today'),
      message,
      entityType: ctx?.entityType ?? 'follow_up',
      entityId: ctx?.entityId ?? fu.id,
      entityCode: ctx?.entityCode,
      entityName: ctx?.entityName,
      actionUrl: ctx?.actionUrl ?? `/crm/follow-ups?id=${fu.id}`,
      primaryAction: 'OPEN',
      secondaryAction: 'COMPLETE',
      deduplicationKey: buildDedupKey([
        tenantId,
        overdue ? 'FOLLOW_UP_OVERDUE' : 'FOLLOW_UP_DUE',
        fu.id,
        fu.assignedTo,
        dueKey,
      ]),
      // Refresh informative copy on each scan when still open
      escalateIfExists: true,
      escalationLevel,
      metadata: {
        followUpId: fu.id,
        followUpType: fu.followUpType,
        dueDate: dueKey,
        dueTime: fu.dueTime,
        companyName: ctx?.partyName,
        contactName: ctx?.contactName,
        recordCode: ctx?.recordCode,
        notesSnippet: ctx?.notesSnippet,
      },
    })
  }
}

async function scanUnattendedLeads(
  tenantId: string,
  settings: Awaited<ReturnType<typeof repo.getOrCreateTenantSettings>>,
  tz: string,
  now: Date,
): Promise<void> {
  const leads = await prisma.crmLead.findMany({
    where: {
      tenantId,
      deletedAt: null,
      lifecycleStatus: { notIn: ['converted', 'not_qualified', 'closed'] },
      stage: { notIn: ['converted_to_opportunity', 'closed', 'not_qualified'] },
      OR: [{ assignedTo: { not: null } }, { ownerId: { not: null } }],
    },
    take: 300,
    orderBy: { createdAt: 'asc' },
  })

  for (const lead of leads) {
    const ownerId = lead.assignedTo ?? lead.ownerId
    if (!ownerId) continue

    const lastActivity = await prisma.crmActivity.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        leadId: lead.id,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, createdAt: true },
    })

    // If any completed activity exists after create, resolve unattended
    if (lastActivity) {
      await notificationService.resolveRelated(tenantId, 'lead', lead.id, ['LEAD_UNATTENDED'])
      continue
    }

    // Also count any activity at all as contact attempt after create
    const anyActivity = await prisma.crmActivity.findFirst({
      where: { tenantId, deletedAt: null, leadId: lead.id },
      select: { id: true },
    })
    if (anyActivity) {
      await notificationService.resolveRelated(tenantId, 'lead', lead.id, ['LEAD_UNATTENDED'])
      continue
    }

    const hours = businessHoursBetween(lead.createdAt, now, {
      timeZone: tz,
      startHour: settings.businessDayStartHour,
      endHour: settings.businessDayEndHour,
    })
    if (hours < settings.leadContactSlaHours) continue

    let priority: NotificationPriority = 'HIGH'
    let escalationLevel = 0
    if (hours >= settings.leadContactCriticalHours) {
      priority = 'CRITICAL'
      escalationLevel = 2
    } else if (hours >= settings.leadContactEscalateHours) {
      priority = 'HIGH'
      escalationLevel = 1
    }

    await notificationService.create({
      tenantId,
      recipientUserId: ownerId,
      category: 'RISK',
      type: 'LEAD_UNATTENDED',
      priority,
      title: 'Lead not contacted',
      message: `${lead.prospectName} has no logged activity since intake (${Math.floor(hours)} biz hrs).`,
      entityType: 'lead',
      entityId: lead.id,
      entityCode: lead.leadCode,
      entityName: lead.prospectName,
      actionUrl: `/crm/leads/${lead.id}`,
      primaryAction: 'OPEN',
      secondaryAction: 'LOG_ACTIVITY',
      deduplicationKey: buildDedupKey([tenantId, 'LEAD_UNATTENDED', lead.id, ownerId]),
      escalateIfExists: true,
      escalationLevel,
    })
  }
}

async function scanOpportunities(
  tenantId: string,
  settings: Awaited<ReturnType<typeof repo.getOrCreateTenantSettings>>,
  now: Date,
  todayKey: string,
): Promise<void> {
  const openOpps = await prisma.crmOpportunity.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: 'OPEN',
      ownerId: { not: null },
    },
    include: { stage: true },
    take: 400,
  })

  const highValue = decimalToNumber(settings.highValueDealThreshold)

  for (const opp of openOpps) {
    if (!opp.ownerId) continue
    const amount = decimalToNumber(opp.amount)
    const inactiveDays =
      amount >= highValue
        ? settings.opportunityInactiveHighValueDays
        : settings.opportunityInactiveDays

    const lastAct = opp.lastActivityAt ?? opp.updatedAt
    const inactiveMs = now.getTime() - lastAct.getTime()
    if (inactiveMs >= inactiveDays * 86_400_000) {
      await notificationService.create({
        tenantId,
        recipientUserId: opp.ownerId,
        category: 'RISK',
        type: 'OPPORTUNITY_INACTIVE',
        priority: amount >= highValue ? 'CRITICAL' : 'HIGH',
        title: 'Opportunity inactive',
        message: `${opp.name} has had no activity for ${inactiveDays}+ days.`,
        entityType: 'opportunity',
        entityId: opp.id,
        entityCode: opp.opportunityCode,
        entityName: opp.name,
        actionUrl: `/crm/opportunities/${opp.id}`,
        primaryAction: 'OPEN',
        deduplicationKey: buildDedupKey([
          tenantId,
          'OPPORTUNITY_INACTIVE',
          opp.id,
          opp.ownerId,
          todayKey,
        ]),
      })
    }

    if (opp.expectedCloseDate) {
      const closeKey = opp.expectedCloseDate.toISOString().slice(0, 10)
      if (closeKey < todayKey) {
        await notificationService.create({
          tenantId,
          recipientUserId: opp.ownerId,
          category: 'RISK',
          type: 'OPPORTUNITY_CLOSE_DATE_MISSED',
          priority: 'CRITICAL',
          title: 'Close date missed',
          message: `${opp.name} is still open past expected close (${closeKey}).`,
          entityType: 'opportunity',
          entityId: opp.id,
          entityCode: opp.opportunityCode,
          entityName: opp.name,
          actionUrl: `/crm/opportunities/${opp.id}`,
          primaryAction: 'OPEN',
          deduplicationKey: buildDedupKey([
            tenantId,
            'OPPORTUNITY_CLOSE_DATE_MISSED',
            opp.id,
            closeKey,
          ]),
          escalateIfExists: true,
        })
      }
    }

    // Stuck in stage: compare updatedAt of stage change via lastActivity heuristic
    const stuckMs = now.getTime() - opp.updatedAt.getTime()
    if (stuckMs >= settings.opportunityStuckDays * 86_400_000) {
      await notificationService.create({
        tenantId,
        recipientUserId: opp.ownerId,
        category: 'RISK',
        type: 'OPPORTUNITY_STUCK',
        priority: 'HIGH',
        title: 'Opportunity stuck in stage',
        message: `${opp.name} has stayed in ${opp.stage?.name ?? 'current stage'} beyond the threshold.`,
        entityType: 'opportunity',
        entityId: opp.id,
        entityCode: opp.opportunityCode,
        entityName: opp.name,
        actionUrl: `/crm/opportunities/${opp.id}`,
        primaryAction: 'OPEN',
        deduplicationKey: buildDedupKey([
          tenantId,
          'OPPORTUNITY_STUCK',
          opp.id,
          opp.stageId,
        ]),
      })
    }
  }
}

async function scanQuotations(
  tenantId: string,
  settings: Awaited<ReturnType<typeof repo.getOrCreateTenantSettings>>,
  now: Date,
  todayKey: string,
): Promise<void> {
  const horizon = new Date(now.getTime() + settings.quotationExpiringDays * 86_400_000)
  const docs = await prisma.crmQuotation.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['approved', 'sent'] },
      validityDate: { gte: now, lte: horizon },
    },
    take: 200,
  })

  for (const q of docs) {
    const ownerId = q.salesOwnerId ?? q.createdBy
    if (!ownerId || !q.validityDate) continue
    const validKey = q.validityDate.toISOString().slice(0, 10)
    await notificationService.create({
      tenantId,
      recipientUserId: ownerId,
      category: 'QUOTATION',
      type: 'QUOTATION_EXPIRING',
      priority: 'HIGH',
      title: 'Quotation expiring soon',
      message: `${q.quotationCode} validity ends ${validKey}.`,
      entityType: 'quotation',
      entityId: q.id,
      entityCode: q.quotationCode,
      actionUrl: `/crm/quotations/${q.id}`,
      primaryAction: 'OPEN',
      deduplicationKey: buildDedupKey([
        tenantId,
        'QUOTATION_EXPIRING',
        q.id,
        validKey,
      ]),
    })
  }

  // Accepted awaiting SO
  const accepted = await prisma.crmQuotation.findMany({
    where: {
      tenantId,
      deletedAt: null,
      customerApproval: 'approved',
      salesOrderId: null,
      customerApprovalAt: {
        lte: new Date(now.getTime() - settings.acceptedQuoteAwaitingSoHours * 3_600_000),
      },
    },
    take: 100,
  })

  for (const q of accepted) {
    const ownerId = q.salesOwnerId ?? q.createdBy
    if (!ownerId) continue
    await notificationService.create({
      tenantId,
      recipientUserId: ownerId,
      category: 'SALES_ORDER',
      type: 'QUOTATION_ACCEPTED_AWAITING_SO',
      priority: 'HIGH',
      title: 'Convert accepted quotation',
      message: `${q.quotationCode} is accepted — create a sales order.`,
      entityType: 'quotation',
      entityId: q.id,
      entityCode: q.quotationCode,
      actionUrl: `/crm/quotations/${q.id}`,
      primaryAction: 'CONVERT_SO',
      deduplicationKey: buildDedupKey([
        tenantId,
        'QUOTATION_ACCEPTED_AWAITING_SO',
        q.id,
      ]),
    })
  }
  void todayKey
}
