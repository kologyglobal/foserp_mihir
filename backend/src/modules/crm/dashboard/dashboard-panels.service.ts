import { prisma } from '../../../config/database.js'
import { decimalToNumber, tenantActiveFilter } from '../../../shared/index.js'

/** High-value deal threshold (INR) — matches frontend HOT_MIN_VALUE. */
const HOT_MIN_VALUE = 2_000_000
/** Days without activity/status touch before a lead or mid-stage opp is "stuck". */
const STUCK_DAYS = 14
/** Days ahead for "closing soon" opportunities. */
const CLOSING_SOON_DAYS = 14
/** Max rows for the quotation approval queue panel. */
const APPROVAL_PANEL_LIMIT = 8

function startOfDay(d: Date): Date {
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`)
}

function closingSoonDate(): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + CLOSING_SOON_DAYS)
  return d
}

/** Latest `submitted` entry in approvalHistory, else updatedAt. */
function resolveSubmittedAt(approvalHistory: unknown, fallback: Date): string {
  const history = Array.isArray(approvalHistory) ? approvalHistory : []
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i] as { action?: string; at?: string }
    if (entry?.action === 'submitted' && typeof entry.at === 'string' && entry.at) {
      return entry.at
    }
  }
  return fallback.toISOString()
}

type PanelOppWhere = {
  tenantId: string
  deletedAt: null
  ownerId?: string
}

export async function getDashboardPanels(
  tenantId: string,
  ownerId?: string,
) {
  const today = startOfDay(new Date())
  const closingSoon = closingSoonDate()
  const leadWhere = {
    ...tenantActiveFilter(tenantId),
    ...(ownerId ? { OR: [{ assignedTo: ownerId }, { ownerId }] } : {}),
  }
  const oppWhere: PanelOppWhere = { ...tenantActiveFilter(tenantId), ...(ownerId ? { ownerId } : {}) }

  const activeLeadFilter = {
    ...leadWhere,
    lifecycleStatus: { notIn: ['converted', 'lost', 'closed'] },
    activityStatus: { not: 'archived' },
    stage: { notIn: ['not_qualified', 'converted_to_opportunity'] },
  }

  const pendingApprovalWhere = {
    ...tenantActiveFilter(tenantId),
    status: 'pending_approval',
    ...(ownerId ? { salesOwnerId: ownerId } : {}),
  }

  const [
    hotOpportunities,
    openOpportunities,
    recentlyWon,
    todaysFollowUps,
    overdueFollowUps,
    hotLeads,
    recentlyCreatedLeads,
    opportunitiesClosingSoon,
    ownerPerformance,
    monthlyLeadTrend,
    monthlyWonRevenueTrend,
    pendingApprovalCount,
    pendingApprovalDocs,
  ] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where: {
        ...oppWhere,
        status: 'OPEN',
        OR: [
          { amount: { gte: HOT_MIN_VALUE } },
          { priority: { in: ['high', 'critical'] } },
        ],
      },
      orderBy: { amount: 'desc' },
      take: 8,
      select: {
        id: true,
        opportunityCode: true,
        name: true,
        amount: true,
        stageId: true,
        companyId: true,
        ownerId: true,
        probability: true,
        expectedCloseDate: true,
        healthScore: true,
        priority: true,
        nextFollowUpAt: true,
      },
    }),
    prisma.crmOpportunity.findMany({
      where: { ...oppWhere, status: 'OPEN' },
      select: {
        id: true,
        opportunityCode: true,
        name: true,
        amount: true,
        stageId: true,
        companyId: true,
        ownerId: true,
        updatedAt: true,
        lastActivityAt: true,
        createdAt: true,
      },
    }),
    prisma.crmOpportunity.findMany({
      where: { ...oppWhere, status: 'WON' },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        opportunityCode: true,
        name: true,
        amount: true,
        companyId: true,
        ownerId: true,
        updatedAt: true,
      },
    }),
    prisma.crmFollowUp.findMany({
      where: {
        ...tenantActiveFilter(tenantId),
        dueDate: today,
        status: { in: ['pending', 'overdue'] },
        ...(ownerId ? { assignedTo: ownerId } : {}),
      },
      orderBy: [{ dueTime: 'asc' }],
      take: 10,
    }),
    prisma.crmFollowUp.findMany({
      where: {
        ...tenantActiveFilter(tenantId),
        dueDate: { lt: today },
        status: { in: ['pending', 'overdue'] },
        ...(ownerId ? { assignedTo: ownerId } : {}),
      },
      orderBy: [{ dueDate: 'asc' }, { dueTime: 'asc' }],
      take: 10,
    }),
    prisma.crmLead.findMany({
      where: {
        ...activeLeadFilter,
        priority: { in: ['high', 'critical'] },
      },
      orderBy: { expectedValue: 'desc' },
      take: 8,
      select: {
        id: true,
        leadCode: true,
        prospectName: true,
        stage: true,
        priority: true,
        expectedValue: true,
        source: true,
        ownerId: true,
      },
    }),
    prisma.crmLead.findMany({
      where: leadWhere,
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        leadCode: true,
        prospectName: true,
        stage: true,
        source: true,
        createdAt: true,
        ownerId: true,
      },
    }),
    prisma.crmOpportunity.findMany({
      where: {
        ...oppWhere,
        status: 'OPEN',
        expectedCloseDate: { gte: today, lte: closingSoon },
      },
      orderBy: { expectedCloseDate: 'asc' },
      take: 10,
      select: {
        id: true,
        opportunityCode: true,
        name: true,
        amount: true,
        expectedCloseDate: true,
        companyId: true,
        ownerId: true,
        stageId: true,
      },
    }),
    prisma.crmOpportunity.groupBy({
      by: ['ownerId'],
      where: { ...oppWhere, status: 'OPEN' },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS count
      FROM crm_leads
      WHERE tenantId = ${tenantId} AND deletedAt IS NULL
        AND createdAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY month ASC
    `,
    prisma.$queryRaw<Array<{ month: string; revenue: unknown }>>`
      SELECT DATE_FORMAT(updatedAt, '%Y-%m') AS month, SUM(amount) AS revenue
      FROM crm_opportunities
      WHERE tenantId = ${tenantId} AND deletedAt IS NULL AND status = 'WON'
        AND updatedAt >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(updatedAt, '%Y-%m')
      ORDER BY month ASC
    `,
    prisma.crmQuotationDocument.count({ where: pendingApprovalWhere }),
    prisma.crmQuotationDocument.findMany({
      where: pendingApprovalWhere,
      orderBy: { updatedAt: 'desc' },
      take: APPROVAL_PANEL_LIMIT,
      select: {
        id: true,
        quotationId: true,
        opportunityId: true,
        revisionNo: true,
        status: true,
        totalAmount: true,
        salesOwnerId: true,
        salesOwnerName: true,
        approvalHistory: true,
        createdAt: true,
        updatedAt: true,
        quotation: {
          select: {
            quotationCode: true,
            companyId: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ])

  const stuckOpportunities = openOpportunities
    .map((opp) => {
      const lastTouch = opp.lastActivityAt ?? opp.updatedAt ?? opp.createdAt
      const idleDays = Math.floor((Date.now() - lastTouch.getTime()) / 86400000)
      return { ...opp, idleDays }
    })
    .filter((opp) => opp.idleDays >= STUCK_DAYS)
    .sort((a, b) => b.idleDays - a.idleDays)
    .slice(0, 10)
    .map((opp) => ({
      id: opp.id,
      opportunityCode: opp.opportunityCode,
      name: opp.name,
      amount: Number(opp.amount),
      stageId: opp.stageId,
      companyId: opp.companyId,
      ownerId: opp.ownerId,
      idleDays: opp.idleDays,
      reason: `No activity for ${opp.idleDays} days`,
    }))

  const stuckLeadCandidates = await prisma.crmLead.findMany({
    where: activeLeadFilter,
    select: {
      id: true,
      leadCode: true,
      prospectName: true,
      stage: true,
      ownerId: true,
      updatedAt: true,
      lastContactedAt: true,
      createdAt: true,
    },
    take: 200,
  })

  const stuckLeads = stuckLeadCandidates
    .map((lead) => {
      const lastTouch = lead.lastContactedAt ?? lead.updatedAt ?? lead.createdAt
      const idleDays = Math.floor((Date.now() - lastTouch.getTime()) / 86400000)
      return { ...lead, idleDays }
    })
    .filter((lead) => lead.idleDays >= STUCK_DAYS)
    .sort((a, b) => b.idleDays - a.idleDays)
    .slice(0, 10)
    .map((lead) => ({
      id: lead.id,
      leadCode: lead.leadCode,
      prospectName: lead.prospectName,
      stage: lead.stage,
      ownerId: lead.ownerId,
      idleDays: lead.idleDays,
      reason: `No contact or status update for ${lead.idleDays} days`,
    }))

  const pendingApprovalQuotations = pendingApprovalDocs.map((doc) => ({
    id: doc.id,
    quotationId: doc.quotationId,
    quotationCode: doc.quotation.quotationCode,
    companyId: doc.quotation.companyId,
    customerName: doc.quotation.company.name,
    opportunityId: doc.opportunityId,
    revisionNo: doc.revisionNo,
    status: doc.status,
    totalAmount: decimalToNumber(doc.totalAmount),
    salesOwnerId: doc.salesOwnerId,
    salesOwnerName: doc.salesOwnerName,
    submittedAt: resolveSubmittedAt(doc.approvalHistory, doc.updatedAt),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }))

  return {
    definitions: {
      hotOpportunity: `Open opportunity with amount ≥ ₹${(HOT_MIN_VALUE / 100000).toFixed(0)}L or high/critical priority`,
      stuckOpportunity: `Open opportunity with no activity for ${STUCK_DAYS}+ days`,
      stuckLead: `Active lead not converted/lost/archived with no contact or status update for ${STUCK_DAYS}+ days`,
      hotLead: 'Active lead with high or critical priority',
      closingSoon: `Open opportunity with expected close within ${CLOSING_SOON_DAYS} days`,
      quotationApproval: `Latest revision documents in status pending_approval (top ${APPROVAL_PANEL_LIMIT})`,
    },
    hotOpportunities: hotOpportunities.map((o) => ({
      ...o,
      amount: Number(o.amount),
      expectedCloseDate: o.expectedCloseDate?.toISOString() ?? null,
      nextFollowUpAt: o.nextFollowUpAt?.toISOString() ?? null,
    })),
    stuckOpportunities,
    recentlyWon: recentlyWon.map((o) => ({ ...o, amount: Number(o.amount), updatedAt: o.updatedAt.toISOString() })),
    todaysFollowUps,
    overdueFollowUps,
    hotLeads: hotLeads.map((l) => ({ ...l, expectedValue: Number(l.expectedValue) })),
    stuckLeads,
    recentlyCreatedLeads: recentlyCreatedLeads.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    opportunitiesClosingSoon: opportunitiesClosingSoon.map((o) => ({
      ...o,
      amount: Number(o.amount),
      expectedCloseDate: o.expectedCloseDate?.toISOString() ?? null,
    })),
    ownerPerformance: ownerPerformance.map((row) => ({
      ownerId: row.ownerId,
      openCount: row._count._all,
      pipelineValue: Number(row._sum.amount ?? 0),
    })),
    monthlyLeadTrend: monthlyLeadTrend.map((r) => ({ month: r.month, count: Number(r.count) })),
    monthlyWonRevenueTrend: monthlyWonRevenueTrend.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue ?? 0),
    })),
    pendingApprovalCount,
    pendingApprovalQuotations,
  }
}
