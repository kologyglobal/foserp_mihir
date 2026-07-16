import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { decimalToNumber, resolveUserNames, tenantActiveFilter } from '../../../shared/index.js'
import type { ReportQuery } from './report.validation.js'

function dateRange(query: ReportQuery): { gte?: Date; lte?: Date } | undefined {
  if (!query.from && !query.to) return undefined
  return {
    ...(query.from ? { gte: new Date(query.from) } : {}),
    ...(query.to ? { lte: new Date(query.to) } : {}),
  }
}

function leadFilters(tenantId: string, query: ReportQuery) {
  const created = dateRange(query)
  return {
    ...tenantActiveFilter(tenantId),
    ...(query.ownerId ? { OR: [{ assignedTo: query.ownerId }, { ownerId: query.ownerId }] } : {}),
    ...(query.stage ? { stage: query.stage } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.status ? { lifecycleStatus: query.status } : {}),
    ...(created ? { createdAt: created } : {}),
  }
}

function oppFilters(tenantId: string, query: ReportQuery) {
  const updated = dateRange(query)
  return {
    ...tenantActiveFilter(tenantId),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.status ? { status: query.status.toUpperCase() as 'OPEN' | 'WON' | 'LOST' } : {}),
    ...(updated ? { updatedAt: updated } : {}),
  }
}

export async function getReport(tenantId: string, query: ReportQuery) {
  const { skip, take } = getPagination(query)

  switch (query.reportId) {
    case 'pipeline':
      return pipelineReport(tenantId, query, skip, take)
    case 'stage-wise':
      return stageWiseReport(tenantId, query)
    case 'follow-up-due':
      return followUpDueReport(tenantId, query, skip, take)
    case 'sales-activity':
      return salesActivityReport(tenantId, query, skip, take)
    case 'quotation-revision':
      return quotationRevisionReport(tenantId, query, skip, take)
    case 'quotation-approval':
      return quotationApprovalReport(tenantId, query, skip, take)
    case 'won-lost':
      return wonLostReport(tenantId, query, skip, take)
    case 'customer-pipeline':
      return customerPipelineReport(tenantId, query)
    case 'conversion-funnel':
      return conversionFunnelReport(tenantId, query)
    case 'lead-register':
      return leadRegisterReport(tenantId, query, skip, take)
    case 'lead-owner':
      return leadOwnerReport(tenantId, query)
    case 'lead-priority':
      return leadPriorityReport(tenantId, query)
    case 'lead-stage':
      return leadStageReport(tenantId, query)
    case 'lead-conversion':
      return leadConversionReport(tenantId, query)
    case 'closed-leads':
      return closedLeadsReport(tenantId, query, skip, take)
    case 'lead-active-inactive':
      return leadActiveInactiveReport(tenantId, query, skip, take)
    default:
      return { rows: [], total: 0 }
  }
}

async function pipelineReport(tenantId: string, query: ReportQuery, skip: number, take: number) {
  const where = { ...oppFilters(tenantId, query), status: 'OPEN' as const }
  const [rows, total] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: { company: true, stage: true },
    }),
    prisma.crmOpportunity.count({ where }),
  ])
  const names = await resolveUserNames(rows.map((r) => r.ownerId), tenantId, prisma)
  return {
    total,
    rows: rows.map((o) => ({
      opportunityNo: o.opportunityCode,
      opportunityName: o.name,
      customerName: o.company.name,
      stage: o.stage.name,
      value: decimalToNumber(o.amount),
      probability: o.probability,
      ownerName: o.ownerId ? names.get(o.ownerId) ?? '' : '',
      expectedCloseDate: o.expectedCloseDate?.toISOString().slice(0, 10) ?? '',
      status: o.status.toLowerCase(),
    })),
  }
}

async function stageWiseReport(tenantId: string, query: ReportQuery) {
  const grouped = await prisma.crmOpportunity.groupBy({
    by: ['stageId'],
    where: { ...oppFilters(tenantId, query), status: 'OPEN' },
    _count: { _all: true },
    _sum: { amount: true },
  })
  const stageIds = grouped.map((g) => g.stageId)
  const stages = await prisma.crmPipelineStage.findMany({
    where: { tenantId, id: { in: stageIds } },
    select: { id: true, name: true },
  })
  const stageMap = new Map(stages.map((s) => [s.id, s.name]))
  return {
    total: grouped.length,
    rows: grouped.map((g) => ({
      stage: stageMap.get(g.stageId) ?? g.stageId,
      count: g._count._all,
      value: decimalToNumber(g._sum.amount),
    })),
  }
}

async function followUpDueReport(tenantId: string, query: ReportQuery, skip: number, take: number) {
  const where = {
    ...tenantActiveFilter(tenantId),
    status: { in: ['pending', 'overdue', 'snoozed'] },
    ...(query.ownerId ? { assignedTo: query.ownerId } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.crmFollowUp.findMany({
      where,
      skip,
      take,
      orderBy: [{ dueDate: 'asc' }, { dueTime: 'asc' }],
    }),
    prisma.crmFollowUp.count({ where }),
  ])
  const companyIds = rows.map((r) => r.companyId).filter(Boolean) as string[]
  const companies = companyIds.length
    ? await prisma.crmCompany.findMany({ where: { tenantId, id: { in: companyIds } }, select: { id: true, name: true } })
    : []
  const companyMap = new Map(companies.map((c) => [c.id, c.name]))
  const names = await resolveUserNames(rows.map((r) => r.assignedTo), tenantId, prisma)
  return {
    total,
    rows: rows.map((f) => ({
      followUpType: f.followUpType,
      customerName: f.companyId ? companyMap.get(f.companyId) ?? '—' : '—',
      dueDate: f.dueDate.toISOString().slice(0, 10),
      dueTime: f.dueTime,
      assignedToName: f.assignedTo ? names.get(f.assignedTo) ?? '' : '',
      status: f.status,
      priority: f.priority,
      notes: f.notes ?? '',
    })),
  }
}

async function salesActivityReport(tenantId: string, query: ReportQuery, skip: number, take: number) {
  const created = dateRange(query)
  const where = {
    ...tenantActiveFilter(tenantId),
    ...(query.ownerId ? { assignedTo: query.ownerId } : {}),
    ...(created ? { scheduledAt: created } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.crmActivity.findMany({ where, skip, take, orderBy: { scheduledAt: 'desc' } }),
    prisma.crmActivity.count({ where }),
  ])
  const companyIds = rows.map((r) => r.companyId).filter(Boolean) as string[]
  const companies = companyIds.length
    ? await prisma.crmCompany.findMany({ where: { tenantId, id: { in: companyIds } }, select: { id: true, name: true } })
    : []
  const companyMap = new Map(companies.map((c) => [c.id, c.name]))
  const names = await resolveUserNames(rows.map((r) => r.assignedTo), tenantId, prisma)
  return {
    total,
    rows: rows.map((a) => ({
      type: a.activityType,
      subject: a.subject,
      customerName: a.companyId ? companyMap.get(a.companyId) ?? '—' : '—',
      ownerName: a.assignedTo ? names.get(a.assignedTo) ?? '' : '',
      activityDate: a.scheduledAt?.toISOString() ?? '',
      outcome: a.outcome ?? '—',
    })),
  }
}

function quotationDocumentFilters(tenantId: string, query: ReportQuery) {
  const created = dateRange(query)
  return {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status } : {}),
    ...(query.ownerId ? { salesOwnerId: query.ownerId } : {}),
    ...(created ? { createdAt: created } : {}),
  }
}

async function quotationRevisionReport(tenantId: string, query: ReportQuery, skip: number, take: number) {
  const where = quotationDocumentFilters(tenantId, query)
  const [rows, total] = await Promise.all([
    prisma.crmQuotationDocument.findMany({
      where,
      skip,
      take,
      orderBy: [{ quotationId: 'asc' }, { revisionNo: 'desc' }],
      include: { quotation: true },
    }),
    prisma.crmQuotationDocument.count({ where }),
  ])
  return {
    total,
    rows: rows.map((d) => ({
      quotationNo: d.quotation.quotationCode,
      revisionNo: d.revisionNo,
      status: d.status,
      totalAmount: decimalToNumber(d.totalAmount),
      createdByName: d.createdByName ?? '',
      createdAt: d.createdAt.toISOString(),
      revisionReason: d.revisionReason ?? '—',
      locked: d.locked ? 'Yes' : 'No',
    })),
  }
}

interface ApprovalHistoryEntry {
  action?: string
  byName?: string
  at?: string
  remarks?: string | null
}

async function quotationApprovalReport(tenantId: string, query: ReportQuery, skip: number, take: number) {
  const docs = await prisma.crmQuotationDocument.findMany({
    where: quotationDocumentFilters(tenantId, query),
    orderBy: [{ quotationId: 'asc' }, { revisionNo: 'desc' }],
    include: { quotation: true },
  })

  const flatRows: {
    quotationId: string
    revisionNo: number
    action: string
    byName: string
    at: string
    remarks: string
  }[] = []

  for (const d of docs) {
    const history = Array.isArray(d.approvalHistory) ? (d.approvalHistory as ApprovalHistoryEntry[]) : []
    for (const h of history) {
      flatRows.push({
        quotationId: d.quotationId,
        revisionNo: d.revisionNo,
        action: h.action ?? '',
        byName: h.byName ?? '',
        at: h.at ?? '',
        remarks: h.remarks ?? '—',
      })
    }
  }

  const total = flatRows.length
  const rows = flatRows.slice(skip, skip + take)
  return { total, rows }
}

async function wonLostReport(tenantId: string, query: ReportQuery, skip: number, take: number) {
  const where = {
    ...oppFilters(tenantId, query),
    status: { in: ['WON', 'LOST'] as ('WON' | 'LOST')[] },
  }
  const [rows, total] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: { company: true, stage: true },
    }),
    prisma.crmOpportunity.count({ where }),
  ])
  return {
    total,
    rows: rows.map((o) => ({
      opportunityNo: o.opportunityCode,
      customerName: o.company.name,
      status: o.status.toLowerCase(),
      value: decimalToNumber(o.amount),
      stage: o.stage.name,
      lostReason: o.lostReason ?? '—',
      salesOrderId: '—',
    })),
  }
}

async function customerPipelineReport(tenantId: string, _query: ReportQuery) {
  const opps = await prisma.crmOpportunity.findMany({
    where: tenantActiveFilter(tenantId),
    include: { company: true },
  })
  const map = new Map<string, { customerName: string; openCount: number; pipelineValue: number; wonCount: number }>()
  for (const o of opps) {
    const cur = map.get(o.companyId) ?? {
      customerName: o.company.name,
      openCount: 0,
      pipelineValue: 0,
      wonCount: 0,
    }
    if (o.status === 'OPEN') {
      cur.openCount += 1
      cur.pipelineValue += decimalToNumber(o.amount)
    }
    if (o.status === 'WON') cur.wonCount += 1
    map.set(o.companyId, cur)
  }
  const rows = [...map.values()]
  return { total: rows.length, rows }
}

async function conversionFunnelReport(tenantId: string, query: ReportQuery) {
  const grouped = await prisma.crmOpportunity.groupBy({
    by: ['stageId'],
    where: oppFilters(tenantId, query),
    _count: { _all: true },
  })
  const stages = await prisma.crmPipelineStage.findMany({
    where: { tenantId },
    orderBy: { sequence: 'asc' },
    select: { id: true, name: true },
  })
  const countMap = new Map(grouped.map((g) => [g.stageId, g._count._all]))
  const rows = stages.map((s) => ({
    stage: s.name,
    count: countMap.get(s.id) ?? 0,
  }))
  return { total: rows.length, rows }
}

async function leadRegisterReport(tenantId: string, query: ReportQuery, skip: number, take: number) {
  const where = leadFilters(tenantId, query)
  const [rows, total] = await Promise.all([
    prisma.crmLead.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.crmLead.count({ where }),
  ])
  const names = await resolveUserNames(rows.flatMap((r) => [r.assignedTo, r.ownerId]), tenantId, prisma)
  return {
    total,
    rows: rows.map((l) => ({
      leadNo: l.leadCode,
      companyProspect: l.prospectName,
      contactPerson: l.contactPerson ?? '—',
      mobile: l.mobile ?? '—',
      leadOwner: l.assignedTo ? names.get(l.assignedTo) ?? '' : '',
      priority: l.priority,
      leadStage: l.stage,
      productRequirement: l.productRequirement ?? '',
      expectedValue: decimalToNumber(l.expectedValue),
      createdDate: l.createdAt.toISOString().slice(0, 10),
      activityStatus: l.activityStatus,
      lifecycleStatus: l.lifecycleStatus,
      closedDate: l.closedDate?.toISOString().slice(0, 10) ?? '—',
      nextFollowUp: l.nextFollowUpAt?.toISOString().slice(0, 10) ?? '—',
    })),
  }
}

async function leadOwnerReport(tenantId: string, query: ReportQuery) {
  const leads = await prisma.crmLead.findMany({ where: leadFilters(tenantId, query) })
  const names = await resolveUserNames(leads.map((l) => l.assignedTo), tenantId, prisma)
  const map = new Map<string, { owner: string; active: number; closed: number; pipelineValue: number }>()
  for (const l of leads) {
    const owner = l.assignedTo ? names.get(l.assignedTo) ?? l.assignedTo : 'Unassigned'
    const cur = map.get(owner) ?? { owner, active: 0, closed: 0, pipelineValue: 0 }
    if (l.lifecycleStatus === 'closed') cur.closed += 1
    else {
      cur.active += 1
      cur.pipelineValue += decimalToNumber(l.expectedValue)
    }
    map.set(owner, cur)
  }
  const rows = [...map.values()]
  return { total: rows.length, rows }
}

async function leadPriorityReport(tenantId: string, query: ReportQuery) {
  const priorities = ['critical', 'high', 'medium', 'low'] as const
  const leads = await prisma.crmLead.findMany({ where: leadFilters(tenantId, query) })
  const rows = priorities.map((p) => ({
    priority: p,
    count: leads.filter((l) => l.priority === p).length,
    activeCount: leads.filter((l) => l.priority === p && l.lifecycleStatus !== 'closed').length,
    pipelineValue: leads
      .filter((l) => l.priority === p && l.lifecycleStatus !== 'closed')
      .reduce((s, l) => s + decimalToNumber(l.expectedValue), 0),
  }))
  return { total: rows.length, rows }
}

async function leadStageReport(tenantId: string, query: ReportQuery) {
  const stages = [
    'new', 'contacted', 'requirement_collected', 'qualified', 'not_qualified',
    'converted_to_opportunity', 'closed',
  ] as const
  const leads = await prisma.crmLead.findMany({ where: leadFilters(tenantId, query) })
  const rows = stages.map((stage) => ({
    leadStage: stage,
    count: leads.filter((l) => l.stage === stage).length,
    activeCount: leads.filter((l) => l.stage === stage && l.activityStatus === 'active').length,
    pipelineValue: leads.filter((l) => l.stage === stage).reduce((s, l) => s + decimalToNumber(l.expectedValue), 0),
  }))
  return { total: rows.length, rows }
}

async function leadConversionReport(tenantId: string, query: ReportQuery) {
  const leads = await prisma.crmLead.findMany({ where: leadFilters(tenantId, query) })
  const total = leads.length
  const converted = leads.filter((l) => l.stage === 'converted_to_opportunity').length
  const qualified = leads.filter((l) => l.stage === 'qualified' || l.stage === 'converted_to_opportunity').length
  const closed = leads.filter((l) => l.stage === 'closed').length
  const rows = [
    { metric: 'Total Leads', value: total },
    { metric: 'Qualified + Converted', value: qualified },
    { metric: 'Converted to Opportunity', value: converted },
    { metric: 'Closed', value: closed },
    { metric: 'Conversion Rate %', value: total > 0 ? Math.round((converted / total) * 100) : 0 },
  ]
  return { total: rows.length, rows }
}

async function closedLeadsReport(tenantId: string, query: ReportQuery, skip: number, take: number) {
  const where = { ...leadFilters(tenantId, query), lifecycleStatus: 'closed' }
  const [rows, total] = await Promise.all([
    prisma.crmLead.findMany({ where, skip, take, orderBy: { closedDate: 'desc' } }),
    prisma.crmLead.count({ where }),
  ])
  const names = await resolveUserNames(rows.map((l) => l.assignedTo), tenantId, prisma)
  return {
    total,
    rows: rows.map((l) => ({
      leadNo: l.leadCode,
      companyProspect: l.prospectName,
      leadOwner: l.assignedTo ? names.get(l.assignedTo) ?? '' : '',
      closedDate: l.closedDate?.toISOString().slice(0, 10) ?? '—',
      closedReason: l.closedReason ?? '—',
      expectedValue: decimalToNumber(l.expectedValue),
    })),
  }
}

async function leadActiveInactiveReport(tenantId: string, query: ReportQuery, skip: number, take: number) {
  const where = leadFilters(tenantId, query)
  const [rows, total] = await Promise.all([
    prisma.crmLead.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' } }),
    prisma.crmLead.count({ where }),
  ])
  const names = await resolveUserNames(rows.map((l) => l.assignedTo), tenantId, prisma)
  return {
    total,
    rows: rows.map((l) => ({
      leadNo: l.leadCode,
      companyProspect: l.prospectName,
      activityStatus: l.activityStatus,
      inactiveReason: l.inactiveReason ?? '—',
      lifecycleStatus: l.lifecycleStatus,
      leadOwner: l.assignedTo ? names.get(l.assignedTo) ?? '' : '',
    })),
  }
}
