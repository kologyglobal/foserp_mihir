import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { SearchQuery } from './search.validation.js'

export async function searchCrm(tenantId: string, query: SearchQuery) {
  const needle = query.q
  const take = query.limit
  const contains = { contains: needle }

  const [leads, companies, contacts, opportunities] = await Promise.all([
    prisma.crmLead.findMany({
      where: {
        ...tenantActiveFilter(tenantId),
        OR: [
          { prospectName: contains },
          { leadCode: contains },
          { email: contains },
          { mobile: contains },
          { companyName: contains },
        ],
      },
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, leadCode: true, prospectName: true, stage: true, email: true, mobile: true },
    }),
    prisma.crmCompany.findMany({
      where: {
        ...tenantActiveFilter(tenantId),
        OR: [
          { name: contains },
          { companyCode: contains },
          { gstin: contains },
          { email: contains },
        ],
      },
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, companyCode: true, name: true, gstin: true, city: true },
    }),
    prisma.crmContact.findMany({
      where: {
        ...tenantActiveFilter(tenantId),
        OR: [
          { firstName: contains },
          { lastName: contains },
          { contactCode: contains },
          { email: contains },
          { mobile: contains },
        ],
      },
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, contactCode: true, firstName: true, lastName: true, email: true, mobile: true, companyId: true },
    }),
    prisma.crmOpportunity.findMany({
      where: {
        ...tenantActiveFilter(tenantId),
        OR: [
          { name: contains },
          { opportunityCode: contains },
        ],
      },
      take,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, opportunityCode: true, name: true, status: true, amount: true },
    }),
  ])

  return { leads, companies, contacts, opportunities }
}
