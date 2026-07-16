import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { decimalToNumber } from '../../../shared/index.js'
import type { CrmExportQuery } from './export.validation.js'

const MAX_ROWS = 5000

function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(headers: string[], rows: string[][]): string {
  return [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n')
}

export async function exportCsv(tenantId: string, resource: string, query: CrmExportQuery): Promise<string> {
  switch (resource) {
    case 'companies':
      return exportCompanies(tenantId, query)
    case 'contacts':
      return exportContacts(tenantId, query)
    case 'leads':
      return exportLeads(tenantId, query)
    case 'opportunities':
      return exportOpportunities(tenantId, query)
    case 'quotations':
      return exportQuotations(tenantId, query)
    case 'activities':
      return exportActivities(tenantId, query)
    case 'follow-ups':
      return exportFollowUps(tenantId, query)
    default:
      throw new Error('Unsupported export resource')
  }
}

async function exportCompanies(tenantId: string, query: CrmExportQuery) {
  const rows = await prisma.crmCompany.findMany({
    where: {
      ...tenantActiveFilter(tenantId),
      ...(query.search ? { OR: [{ name: { contains: query.search } }, { companyCode: { contains: query.search } }] } : {}),
    },
    take: MAX_ROWS,
    orderBy: { name: 'asc' },
  })
  return toCsv(
    ['Company Code', 'Name', 'Industry', 'Territory', 'Source', 'Email', 'Phone', 'Status'],
    rows.map((r) => [r.companyCode, r.name, r.industry ?? '', r.salesTerritory ?? '', r.source ?? '', r.email ?? '', r.phone ?? '', r.status]),
  )
}

async function exportContacts(tenantId: string, query: CrmExportQuery) {
  const rows = await prisma.crmContact.findMany({
    where: {
      ...tenantActiveFilter(tenantId),
      ...(query.search ? { OR: [{ firstName: { contains: query.search } }, { contactCode: { contains: query.search } }] } : {}),
    },
    take: MAX_ROWS,
    orderBy: { firstName: 'asc' },
  })
  return toCsv(
    ['Contact Code', 'First Name', 'Last Name', 'Email', 'Mobile', 'Status'],
    rows.map((r) => [r.contactCode, r.firstName, r.lastName, r.email ?? '', r.mobile ?? '', r.status]),
  )
}

async function exportLeads(tenantId: string, query: CrmExportQuery) {
  const rows = await prisma.crmLead.findMany({
    where: {
      ...tenantActiveFilter(tenantId),
      ...(query.ownerId ? { OR: [{ assignedTo: query.ownerId }, { ownerId: query.ownerId }] } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.status ? { lifecycleStatus: query.status } : {}),
    },
    take: MAX_ROWS,
    orderBy: { createdAt: 'desc' },
  })
  return toCsv(
    ['Lead Code', 'Prospect', 'Stage', 'Source', 'Priority', 'Expected Value', 'Lifecycle', 'Activity Status'],
    rows.map((r) => [r.leadCode, r.prospectName, r.stage, r.source, r.priority, String(decimalToNumber(r.expectedValue)), r.lifecycleStatus, r.activityStatus]),
  )
}

function quotationStatusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

async function exportQuotations(tenantId: string, query: CrmExportQuery) {
  const docs = await prisma.crmQuotationDocument.findMany({
    where: {
      ...tenantActiveFilter(tenantId),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId ? { salesOwnerId: query.ownerId } : {}),
      ...(query.search
        ? {
            quotation: {
              OR: [
                { quotationCode: { contains: query.search } },
                { company: { name: { contains: query.search } } },
              ],
            },
          }
        : {}),
    },
    include: {
      quotation: { include: { company: true } },
    },
    take: MAX_ROWS * 3,
    orderBy: [{ quotationId: 'asc' }, { revisionNo: 'desc' }],
  })

  const latestByQuotation = new Map<string, (typeof docs)[0]>()
  for (const doc of docs) {
    if (!latestByQuotation.has(doc.quotationId)) {
      latestByQuotation.set(doc.quotationId, doc)
    }
  }

  const rows = [...latestByQuotation.values()].slice(0, MAX_ROWS)
  return toCsv(
    ['Quotation', 'Customer', 'Quotation Date', 'Expiry', 'Amount', 'Status', 'Owner', 'Revision'],
    rows.map((d) => [
      d.quotation.quotationCode,
      d.quotation.company.name,
      d.createdAt.toISOString().slice(0, 10),
      d.quotation.validityDate?.toISOString().slice(0, 10) ?? '',
      String(decimalToNumber(d.totalAmount)),
      quotationStatusLabel(d.status),
      d.salesOwnerName ?? '',
      String(d.revisionNo),
    ]),
  )
}

async function exportOpportunities(tenantId: string, query: CrmExportQuery) {
  const rows = await prisma.crmOpportunity.findMany({
    where: {
      ...tenantActiveFilter(tenantId),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.status ? { status: query.status.toUpperCase() as 'OPEN' | 'WON' | 'LOST' } : {}),
    },
    include: { stage: true, company: true },
    take: MAX_ROWS,
    orderBy: { updatedAt: 'desc' },
  })
  return toCsv(
    ['Opportunity Code', 'Name', 'Company', 'Stage', 'Amount', 'Probability', 'Status'],
    rows.map((r) => [r.opportunityCode, r.name, r.company.name, r.stage.name, String(decimalToNumber(r.amount)), String(r.probability), r.status]),
  )
}

async function exportActivities(tenantId: string, query: CrmExportQuery) {
  const rows = await prisma.crmActivity.findMany({
    where: { ...tenantActiveFilter(tenantId), ...(query.ownerId ? { assignedTo: query.ownerId } : {}) },
    take: MAX_ROWS,
    orderBy: { scheduledAt: 'desc' },
  })
  return toCsv(
    ['Type', 'Subject', 'Status', 'Scheduled At', 'Outcome'],
    rows.map((r) => [r.activityType, r.subject, r.status, r.scheduledAt?.toISOString() ?? '', r.outcome ?? '']),
  )
}

async function exportFollowUps(tenantId: string, query: CrmExportQuery) {
  const rows = await prisma.crmFollowUp.findMany({
    where: {
      ...tenantActiveFilter(tenantId),
      ...(query.ownerId ? { assignedTo: query.ownerId } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    take: MAX_ROWS,
    orderBy: { dueDate: 'asc' },
  })
  return toCsv(
    ['Type', 'Due Date', 'Due Time', 'Priority', 'Status', 'Notes'],
    rows.map((r) => [r.followUpType, r.dueDate.toISOString().slice(0, 10), r.dueTime, r.priority, r.status, r.notes ?? '']),
  )
}
