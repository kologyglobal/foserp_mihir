import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { DashboardQuery } from './dashboard.validation.js'
import { getDashboardCharts } from './dashboard-charts.service.js'
import { getDashboardPanels } from './dashboard-panels.service.js'

function startOfDay(d: Date): Date {
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`)
}

function resolveRange(query: DashboardQuery): { from: Date; to: Date } {
  const now = new Date()
  const to = query.to ? new Date(query.to) : now
  if (query.from) return { from: new Date(query.from), to }

  const from = new Date(to)
  switch (query.period) {
    case 'today':
      return { from: startOfDay(to), to }
    case 'week': {
      from.setUTCDate(from.getUTCDate() - 7)
      return { from, to }
    }
    case 'quarter': {
      from.setUTCMonth(from.getUTCMonth() - 3)
      return { from, to }
    }
    case 'year': {
      from.setUTCFullYear(from.getUTCFullYear() - 1)
      return { from, to }
    }
    case 'custom':
      from.setUTCMonth(from.getUTCMonth() - 1)
      return { from, to }
    case 'month':
    default: {
      from.setUTCMonth(from.getUTCMonth() - 1)
      return { from, to }
    }
  }
}

export async function getDashboardMetrics(tenantId: string, query: DashboardQuery) {
  const { from, to } = resolveRange(query)
  const today = startOfDay(new Date())
  const baseLead = {
    ...tenantActiveFilter(tenantId),
    ...(query.ownerId ? { OR: [{ assignedTo: query.ownerId }, { ownerId: query.ownerId }] } : {}),
  }
  const baseOpp = {
    ...tenantActiveFilter(tenantId),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
  }

  const [
    totalLeads,
    newLeads,
    qualifiedLeads,
    convertedLeads,
    lostLeads,
    leadsByStage,
    leadsBySource,
    openOpportunities,
    wonOpportunities,
    lostOpportunities,
    pipelineAgg,
    followUpsDueToday,
    overdueFollowUps,
    activitiesToday,
    recentActivities,
    upcomingFollowUps,
  ] = await Promise.all([
    prisma.crmLead.count({ where: baseLead }),
    prisma.crmLead.count({ where: { ...baseLead, createdAt: { gte: from, lte: to } } }),
    prisma.crmLead.count({ where: { ...baseLead, lifecycleStatus: 'qualified' } }),
    prisma.crmLead.count({ where: { ...baseLead, lifecycleStatus: 'converted' } }),
    prisma.crmLead.count({ where: { ...baseLead, stage: 'not_qualified' } }),
    prisma.crmLead.groupBy({ by: ['stage'], where: baseLead, _count: { _all: true } }),
    prisma.crmLead.groupBy({ by: ['source'], where: baseLead, _count: { _all: true } }),
    prisma.crmOpportunity.count({ where: { ...baseOpp, status: 'OPEN' } }),
    prisma.crmOpportunity.count({ where: { ...baseOpp, status: 'WON', updatedAt: { gte: from, lte: to } } }),
    prisma.crmOpportunity.count({ where: { ...baseOpp, status: 'LOST', updatedAt: { gte: from, lte: to } } }),
    prisma.crmOpportunity.aggregate({
      where: { ...baseOpp, status: 'OPEN' },
      _sum: { amount: true },
    }),
    prisma.crmFollowUp.count({
      where: { ...tenantActiveFilter(tenantId), dueDate: today, status: { in: ['pending', 'overdue'] } },
    }),
    prisma.crmFollowUp.count({
      where: { ...tenantActiveFilter(tenantId), dueDate: { lt: today }, status: { in: ['pending', 'overdue'] } },
    }),
    prisma.crmActivity.count({
      where: {
        ...tenantActiveFilter(tenantId),
        scheduledAt: { gte: today, lt: new Date(today.getTime() + 86400000) },
      },
    }),
    prisma.crmActivity.findMany({
      where: tenantActiveFilter(tenantId),
      orderBy: { scheduledAt: 'desc' },
      take: 10,
      select: { id: true, activityType: true, subject: true, scheduledAt: true, status: true, companyId: true, leadId: true },
    }),
    prisma.crmFollowUp.findMany({
      where: {
        ...tenantActiveFilter(tenantId),
        dueDate: { gte: today },
        status: { in: ['pending', 'snoozed'] },
      },
      orderBy: [{ dueDate: 'asc' }, { dueTime: 'asc' }],
      take: 10,
    }),
  ])

  const oppsByStage = await prisma.crmOpportunity.groupBy({
    by: ['stageId'],
    where: { ...baseOpp, status: 'OPEN' },
    _count: { _all: true },
    _sum: { amount: true },
  })

  const openOppRows = await prisma.crmOpportunity.findMany({
    where: { ...baseOpp, status: 'OPEN' },
    select: { amount: true, probability: true },
  })

  const pipelineValue = Number(pipelineAgg._sum.amount ?? 0)
  const weightedForecast = openOppRows.reduce(
    (sum, row) => sum + Number(row.amount) * (row.probability / 100),
    0,
  )
  const closedCount = wonOpportunities + lostOpportunities
  const winRate = closedCount > 0 ? Math.round((wonOpportunities / closedCount) * 100) : 0
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0

  const [panels, charts] = await Promise.all([
    getDashboardPanels(tenantId, query.ownerId),
    getDashboardCharts(tenantId, query.ownerId),
  ])

  return {
    period: query.period,
    from: from.toISOString(),
    to: to.toISOString(),
    leads: {
      total: totalLeads,
      new: newLeads,
      qualified: qualifiedLeads,
      converted: convertedLeads,
      lost: lostLeads,
      byStage: leadsByStage.map((r) => ({ stage: r.stage, count: r._count._all })),
      bySource: leadsBySource.map((r) => ({ source: r.source, count: r._count._all })),
    },
    opportunities: {
      open: openOpportunities,
      won: wonOpportunities,
      lost: lostOpportunities,
      pipelineValue,
      weightedForecast,
      expectedRevenue: weightedForecast,
      byStage: oppsByStage.map((r) => ({
        stageId: r.stageId,
        count: r._count._all,
        value: Number(r._sum.amount ?? 0),
      })),
    },
    followUps: {
      dueToday: followUpsDueToday,
      overdue: overdueFollowUps,
      upcoming: upcomingFollowUps.length,
    },
    activities: {
      today: activitiesToday,
      recent: recentActivities,
    },
    rates: {
      conversionRate,
      winRate,
    },
    upcomingFollowUps,
    panels,
    charts,
  }
}
