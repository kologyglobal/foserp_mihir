import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { splitContactName } from './contact.types.js'
import type { CreateContactInput, ListContactsQuery, UpdateContactInput } from './contact.validation.js'

export async function findContacts(tenantId: string, query: ListContactsQuery) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination(query)

  const where: Prisma.CrmContactWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.customerId ? { companyId: query.customerId } : {}),
    ...(query.isPrimary !== undefined ? { isPrimary: query.isPrimary } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search } },
            { lastName: { contains: query.search } },
            { contactCode: { contains: query.search } },
            { email: { contains: query.search } },
            { mobile: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmContact.findMany({ where, skip, take, orderBy: { createdAt: query.sortOrder } }),
    prisma.crmContact.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function findContactById(tenantId: string, id: string) {
  return prisma.crmContact.findFirst({ where: { id, ...tenantActiveFilter(tenantId) } })
}

/** Prefer primary; otherwise oldest active contact for the company. */
export async function findPrimaryOrFirstContact(tenantId: string, companyId: string) {
  const primary = await prisma.crmContact.findFirst({
    where: { companyId, isPrimary: true, ...tenantActiveFilter(tenantId) },
    orderBy: { createdAt: 'asc' },
  })
  if (primary) return primary
  return prisma.crmContact.findFirst({
    where: { companyId, ...tenantActiveFilter(tenantId) },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createContact(
  tenantId: string,
  userId: string,
  data: CreateContactInput & { contactCode: string },
) {
  const { firstName, lastName } = splitContactName(data.name)
  return prisma.crmContact.create({
    data: {
      tenantId,
      contactCode: data.contactCode,
      companyId: data.customerId,
      firstName,
      lastName,
      designation: data.designation,
      department: data.department,
      email: data.email || null,
      mobile: data.phone,
      alternateMobile: data.alternatePhone,
      linkedInUrl: data.linkedInUrl || null,
      isPrimary: data.isPrimary ?? false,
      isActive: data.isActive ?? true,
      masterContactId: data.masterContactId,
      status: data.status ?? 'active',
      notes: data.notes,
      ownerId: data.ownerId,
      createdBy: userId,
      updatedBy: userId,
    },
  })
}

export async function updateContact(
  tenantId: string,
  id: string,
  userId: string,
  data: UpdateContactInput,
) {
  const nameParts = data.name ? splitContactName(data.name) : null
  return prisma.crmContact.update({
    where: { id, tenantId },
    data: {
      ...(data.customerId !== undefined ? { companyId: data.customerId } : {}),
      ...(nameParts ? { firstName: nameParts.firstName, lastName: nameParts.lastName } : {}),
      ...(data.designation !== undefined ? { designation: data.designation } : {}),
      ...(data.department !== undefined ? { department: data.department } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.phone !== undefined ? { mobile: data.phone } : {}),
      ...(data.alternatePhone !== undefined ? { alternateMobile: data.alternatePhone } : {}),
      ...(data.linkedInUrl !== undefined ? { linkedInUrl: data.linkedInUrl || null } : {}),
      ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.masterContactId !== undefined ? { masterContactId: data.masterContactId } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
      updatedBy: userId,
    },
  })
}

export async function softDeleteContact(tenantId: string, id: string, userId: string) {
  return prisma.crmContact.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), updatedBy: userId, isActive: false },
  })
}

export async function companyExists(tenantId: string, companyId: string) {
  const count = await prisma.crmCompany.count({ where: { id: companyId, ...tenantActiveFilter(tenantId) } })
  return count > 0
}
