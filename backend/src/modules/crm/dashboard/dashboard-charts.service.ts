import { prisma } from '../../../config/database.js'
import { decimalToNumber, resolveUserNames, tenantActiveFilter } from '../../../shared/index.js'

const CLOSED_STAGE_SLUGS = new Set(['won', 'lost', 'on_hold'])

const STAGE_SHORT: Record<string, string> = {
  new_lead: 'New Lead',
  qualified: 'Qualified',
  requirement_discussion: 'Req. Disc.',
  technical_review: 'Tech Rev.',
  quotation_prepared: 'Quo. Prep',
  quotation_sent: 'Quo. Sent',
  negotiation: 'Negotiation',
}

const LEAD_FUNNEL_STAGES: Array<{ stage: string; label: string }> = [
  { stage: 'new', label: 'New' },
  { stage: 'contacted', label: 'Contacted' },
  { stage: 'requirement_collected', label: 'Requirement Collected' },
  { stage: 'qualified', label: 'Qualified' },
  { stage: 'converted_to_opportunity', label: 'Converted' },
]

function startOfDay(d: Date): Date {
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`)
}

function weekdayLabel(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00.000Z`)
  return d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })
}

export async function getDashboardCharts(tenantId: string, ownerId?: string) {
  const today = startOfDay(new Date())
  const trendFrom = new Date(today)
  trendFrom.setUTCDate(trendFrom.getUTCDate() - 6)

  const baseLead = {
    ...tenantActiveFilter(tenantId),
    ...(ownerId ? { OR: [{ assignedTo: ownerId }, { ownerId }] } : {}),
  }
  const baseOpp = {
    ...tenantActiveFilter(tenantId),
    ...(ownerId ? { ownerId } : {}),
  }
  const baseFollowUp = {
    ...tenantActiveFilter(tenantId),
    ...(ownerId ? { assignedTo: ownerId } : {}),
  }
  const baseActivity = {
    ...tenantActiveFilter(tenantId),
    ...(ownerId ? { assignedTo: ownerId } : {}),
  }

  const [
    pipelineStages,
    oppsByStage,
    leadsByStage,
    openCount,
    wonCount,
    lostCount,
    activityRows,
    overdueFollowUps,
    dueTodayFollowUps,
    upcomingFollowUps,
    ownerGrouped,
  ] = await Promise.all([
    prisma.crmPipelineStage.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { sequence: 'asc' },
      select: { id: true, slug: true, name: true, isClosedWon: true, isClosedLost: true },
    }),
    prisma.crmOpportunity.groupBy({
      by: ['stageId'],
      where: { ...baseOpp, status: 'OPEN' },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.crmLead.groupBy({
      by: ['stage'],
      where: baseLead,
      _count: { _all: true },
    }),
    prisma.crmOpportunity.count({ where: { ...baseOpp, status: 'OPEN' } }),
    prisma.crmOpportunity.count({ where: { ...baseOpp, status: 'WON' } }),
    prisma.crmOpportunity.count({ where: { ...baseOpp, status: 'LOST' } }),
    prisma.crmActivity.findMany({
      where: {
        ...baseActivity,
        scheduledAt: { gte: trendFrom },
      },
      select: { scheduledAt: true },
    }),
    prisma.crmFollowUp.count({
      where: {
        ...baseFollowUp,
        dueDate: { lt: today },
        status: { in: ['pending', 'overdue'] },
      },
    }),
    prisma.crmFollowUp.count({
      where: {
        ...baseFollowUp,
        dueDate: today,
        status: { in: ['pending', 'overdue'] },
      },
    }),
    prisma.crmFollowUp.count({
      where: {
        ...baseFollowUp,
        dueDate: { gt: today },
        status: { in: ['pending', 'snoozed'] },
      },
    }),
    prisma.crmOpportunity.groupBy({
      by: ['ownerId'],
      where: { ...baseOpp, status: 'OPEN' },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ])

  const stageCountMap = new Map(
    oppsByStage.map((row) => [row.stageId, { count: row._count._all, value: decimalToNumber(row._sum.amount) }]),
  )
  const leadCountMap = new Map(leadsByStage.map((row) => [row.stage, row._count._all]))

  const activeStages = pipelineStages.filter(
    (s) => !s.isClosedWon && !s.isClosedLost && !CLOSED_STAGE_SLUGS.has(s.slug),
  )

  const pipelineByStage = activeStages.map((stage) => {
    const agg = stageCountMap.get(stage.id) ?? { count: 0, value: 0 }
    return {
      stageId: stage.id,
      slug: stage.slug,
      label: stage.name,
      shortLabel: STAGE_SHORT[stage.slug] ?? stage.name,
      count: agg.count,
      value: agg.value,
    }
  })

  const stageFunnel = pipelineByStage.map(({ stageId, slug, label, shortLabel, count }) => ({
    stageId,
    slug,
    label,
    shortLabel,
    count,
  }))

  const leadStageFunnel = LEAD_FUNNEL_STAGES.map(({ stage, label }) => ({
    stage,
    label,
    count: leadCountMap.get(stage) ?? 0,
  }))

  const activityByDay = new Map<string, number>()
  for (const row of activityRows) {
    if (!row.scheduledAt) continue
    const day = row.scheduledAt.toISOString().slice(0, 10)
    activityByDay.set(day, (activityByDay.get(day) ?? 0) + 1)
  }

  const activityTrend: Array<{ day: string; label: string; count: number }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    const day = d.toISOString().slice(0, 10)
    activityTrend.push({
      day,
      label: weekdayLabel(day),
      count: activityByDay.get(day) ?? 0,
    })
  }

  const followUpUrgency = [
    { name: 'Overdue', value: overdueFollowUps },
    { name: 'Due today', value: dueTodayFollowUps },
    { name: 'Upcoming', value: upcomingFollowUps },
  ].filter((row) => row.value > 0)

  const ownerIds = ownerGrouped.map((row) => row.ownerId)
  const ownerNames = await resolveUserNames(ownerIds, tenantId, prisma)

  const ownerPipeline = ownerGrouped
    .map((row) => ({
      ownerId: row.ownerId,
      ownerName: row.ownerId ? ownerNames.get(row.ownerId) ?? row.ownerId : 'Unassigned',
      value: decimalToNumber(row._sum.amount),
      count: row._count._all,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  return {
    pipelineByStage,
    stageFunnel,
    leadStageFunnel,
    dealOutcomes: {
      open: openCount,
      won: wonCount,
      lost: lostCount,
    },
    activityTrend,
    followUpUrgency,
    ownerPipeline,
  }
}
