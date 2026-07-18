import type { CrmCompany } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import type { FindCustomerPartiesQuery } from './customer-party.types.js'

const ACTIVE_COMPANY_WHERE = {
  deletedAt: null,
  status: 'active',
  isActive: true,
} as const

export async function findCrmCompanyById(tenantId: string, customerId: string): Promise<CrmCompany | null> {
  return prisma.crmCompany.findFirst({
    where: { id: customerId, tenantId, deletedAt: null },
  })
}

export async function findActiveCrmCompanyById(tenantId: string, customerId: string): Promise<CrmCompany | null> {
  return prisma.crmCompany.findFirst({
    where: { id: customerId, tenantId, ...ACTIVE_COMPANY_WHERE },
  })
}

export async function findCrmCompanies(
  tenantId: string,
  query: FindCustomerPartiesQuery,
): Promise<{ items: CrmCompany[]; total: number; page: number; limit: number }> {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'asc',
  })
  const where = {
    tenantId,
    deletedAt: null,
    ...(query.isActive === true ? ACTIVE_COMPANY_WHERE : {}),
    ...(query.isActive === false
      ? { OR: [{ status: { not: 'active' } }, { isActive: false }] }
      : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search } },
            { companyCode: { contains: query.search } },
            { gstin: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmCompany.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.crmCompany.count({ where }),
  ])

  return { items, total, page, limit }
}
