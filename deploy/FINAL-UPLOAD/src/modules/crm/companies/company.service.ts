import { nextCode } from '../../../services/codeSeries.service.js'
import { NotFoundError } from '../../../utils/errors.js'
import { resolveUserNames } from '../../../shared/index.js'
import { PHONE_MAX_DIGITS } from '../../../utils/phoneValidation.js'
import * as contactRepo from '../contacts/contact.repository.js'
import * as contactService from '../contacts/contact.service.js'
import * as repo from './company.repository.js'
import { mapCompanyToCustomer } from './company.types.js'
import type { CreateCompanyInput, ListCompaniesQuery, UpdateCompanyInput } from './company.validation.js'

function digitsOnlyPhone(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined
  const digits = value.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS)
  return digits || undefined
}

/**
 * When company form contact fields are set, upsert a linked CRM primary contact.
 * Empty contactPerson does not delete existing contacts.
 */
async function syncCompanyPrimaryContact(
  tenantId: string,
  userId: string,
  companyId: string,
  fields: { contactPerson?: string | null; contactPhone?: string | null; contactEmail?: string | null },
) {
  const name = fields.contactPerson?.trim() ?? ''
  if (!name) return

  const phone = digitsOnlyPhone(fields.contactPhone)
  const email = fields.contactEmail?.trim() || undefined
  const existing = await contactRepo.findPrimaryOrFirstContact(tenantId, companyId)

  if (existing) {
    const existingName = `${existing.firstName} ${existing.lastName}`.trim()
    const same =
      existingName === name
      && (existing.mobile ?? '') === (phone ?? '')
      && (existing.email ?? '') === (email ?? '')
      && existing.isPrimary
    if (same) return
    await contactService.updateContact(tenantId, existing.id, userId, {
      name,
      phone: phone ?? '',
      email: email ?? '',
      isPrimary: true,
      isActive: true,
    })
    return
  }

  await contactService.createContact(tenantId, userId, {
    customerId: companyId,
    name,
    phone: phone ?? '',
    email: email ?? '',
    designation: 'Primary Contact',
    isPrimary: true,
    isActive: true,
  })
}

function mapWithOwner(
  company: Awaited<ReturnType<typeof repo.findCompanyById>>,
  nameMap: Map<string, string>,
) {
  if (!company) return null
  return mapCompanyToCustomer(company, {
    createdByName: company.createdBy ? nameMap.get(company.createdBy) : undefined,
    modifiedByName: company.updatedBy ? nameMap.get(company.updatedBy) : undefined,
    ownerName: company.ownerId ? nameMap.get(company.ownerId) : undefined,
  })
}

export async function listCompanies(tenantId: string, query: ListCompaniesQuery) {
  const result = await repo.findCompanies(tenantId, query)
  const nameMap = await resolveUserNames(
    result.items.flatMap((c) => [c.createdBy, c.updatedBy, c.ownerId]),
    tenantId,
    (await import('../../../config/database.js')).prisma,
  )
  return {
    items: result.items.map((c) => mapWithOwner(c, nameMap)!),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getCompany(tenantId: string, id: string) {
  const company = await repo.findCompanyById(tenantId, id)
  if (!company) throw new NotFoundError('Company not found')
  const nameMap = await resolveUserNames(
    [company.createdBy, company.updatedBy, company.ownerId],
    tenantId,
    (await import('../../../config/database.js')).prisma,
  )
  return mapWithOwner(company, nameMap)!
}

export async function createCompany(tenantId: string, userId: string, input: CreateCompanyInput) {
  const companyCode = input.customerCode ?? (await nextCode(tenantId, 'CRM_COMPANY'))
  const ownerId = input.ownerId ?? userId
  const company = await repo.createCompany(tenantId, userId, { ...input, companyCode, ownerId })
  await syncCompanyPrimaryContact(tenantId, userId, company.id, {
    contactPerson: input.contactPerson ?? company.contactPerson,
    contactPhone: input.contactPhone ?? company.contactPhone,
    contactEmail: input.contactEmail ?? company.contactEmail,
  })
  const nameMap = await resolveUserNames(
    [company.createdBy, company.updatedBy, company.ownerId],
    tenantId,
    (await import('../../../config/database.js')).prisma,
  )
  return mapWithOwner(company, nameMap)!
}

export async function updateCompany(tenantId: string, id: string, userId: string, input: UpdateCompanyInput) {
  const existing = await repo.findCompanyById(tenantId, id)
  if (!existing) throw new NotFoundError('Company not found')
  const company = await repo.updateCompany(tenantId, id, userId, input)
  const contactPerson = input.contactPerson !== undefined ? input.contactPerson : company.contactPerson
  const contactPhone = input.contactPhone !== undefined ? input.contactPhone : company.contactPhone
  const contactEmail = input.contactEmail !== undefined ? input.contactEmail : company.contactEmail
  // Sync when any contact field is in the patch, or when creating from full form save with a name.
  if (
    input.contactPerson !== undefined
    || input.contactPhone !== undefined
    || input.contactEmail !== undefined
  ) {
    await syncCompanyPrimaryContact(tenantId, userId, company.id, {
      contactPerson,
      contactPhone,
      contactEmail,
    })
  }
  const nameMap = await resolveUserNames(
    [company.createdBy, company.updatedBy, company.ownerId],
    tenantId,
    (await import('../../../config/database.js')).prisma,
  )
  return mapWithOwner(company, nameMap)!
}

export async function deleteCompany(tenantId: string, id: string, userId: string) {
  const existing = await repo.findCompanyById(tenantId, id)
  if (!existing) throw new NotFoundError('Company not found')
  await repo.softDeleteCompany(tenantId, id, userId)
}
