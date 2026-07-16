import { getPagination } from '../../../utils/pagination.js'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import type { CreateCompanyInput, ListCompaniesQuery, UpdateCompanyInput } from './company.validation.js'

const SORT_MAP: Record<string, string> = {
  customerName: 'name',
  customerCode: 'companyCode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

export async function findCompanies(tenantId: string, query: ListCompaniesQuery) {
  const { skip, take } = getPagination(query)
  const sortField = SORT_MAP[query.sortBy ?? 'createdAt'] ?? 'createdAt'

  const where: Prisma.CrmCompanyWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerType ? { customerType: query.customerType } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search } },
            { companyCode: { contains: query.search } },
            { email: { contains: query.search } },
            { gstin: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmCompany.findMany({
      where,
      skip,
      take,
      orderBy: { [sortField]: query.sortOrder },
    }),
    prisma.crmCompany.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function findCompanyById(tenantId: string, id: string) {
  return prisma.crmCompany.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
  })
}

export async function createCompany(
  tenantId: string,
  userId: string,
  data: CreateCompanyInput & { companyCode: string },
) {
  return prisma.crmCompany.create({
    data: {
      tenantId,
      companyCode: data.companyCode,
      name: data.customerName,
      customerType: data.customerType,
      industry: data.industry,
      website: data.website,
      turnoverRange: data.turnoverRange,
      employeeRange: data.employeeRange,
      email: data.email || null,
      phone: data.phone,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      country: data.country,
      gstin: data.gstin,
      pan: data.pan,
      contactPerson: data.contactPerson,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail || null,
      creditDays: data.creditDays ?? 0,
      creditLimit: data.creditLimit,
      salesTerritory: data.salesTerritory,
      source: data.source,
      status: data.status ?? 'active',
      isActive: data.isActive ?? true,
      notes: data.notes,
      ownerId: data.ownerId,
      createdBy: userId,
      updatedBy: userId,
    },
  })
}

export async function updateCompany(
  tenantId: string,
  id: string,
  userId: string,
  data: UpdateCompanyInput,
) {
  return prisma.crmCompany.update({
    where: { id, tenantId },
    data: {
      ...(data.customerName !== undefined ? { name: data.customerName } : {}),
      ...(data.customerType !== undefined ? { customerType: data.customerType } : {}),
      ...(data.industry !== undefined ? { industry: data.industry } : {}),
      ...(data.website !== undefined ? { website: data.website } : {}),
      ...(data.turnoverRange !== undefined ? { turnoverRange: data.turnoverRange } : {}),
      ...(data.employeeRange !== undefined ? { employeeRange: data.employeeRange } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.addressLine1 !== undefined ? { addressLine1: data.addressLine1 } : {}),
      ...(data.addressLine2 !== undefined ? { addressLine2: data.addressLine2 } : {}),
      ...(data.city !== undefined ? { city: data.city } : {}),
      ...(data.state !== undefined ? { state: data.state } : {}),
      ...(data.pincode !== undefined ? { pincode: data.pincode } : {}),
      ...(data.country !== undefined ? { country: data.country } : {}),
      ...(data.gstin !== undefined ? { gstin: data.gstin } : {}),
      ...(data.pan !== undefined ? { pan: data.pan } : {}),
      ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson } : {}),
      ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
      ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail || null } : {}),
      ...(data.creditDays !== undefined ? { creditDays: data.creditDays } : {}),
      ...(data.creditLimit !== undefined ? { creditLimit: data.creditLimit } : {}),
      ...(data.salesTerritory !== undefined ? { salesTerritory: data.salesTerritory } : {}),
      ...(data.source !== undefined ? { source: data.source } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
      updatedBy: userId,
    },
  })
}

export async function softDeleteCompany(tenantId: string, id: string, userId: string) {
  return prisma.crmCompany.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), updatedBy: userId, isActive: false },
  })
}
