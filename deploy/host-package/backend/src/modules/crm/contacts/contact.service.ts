import { nextCode } from '../../../services/codeSeries.service.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { resolveUserNames } from '../../../shared/index.js'
import { prisma } from '../../../config/database.js'
import * as repo from './contact.repository.js'
import { mapContactToDto } from './contact.types.js'
import type { CreateContactInput, ListContactsQuery, UpdateContactInput } from './contact.validation.js'

export async function listContacts(tenantId: string, query: ListContactsQuery) {
  const result = await repo.findContacts(tenantId, query)
  const nameMap = await resolveUserNames(
    result.items.flatMap((c) => [c.createdBy, c.updatedBy]),
    tenantId,
    prisma,
  )
  return {
    items: result.items.map((c) =>
      mapContactToDto(c, {
        createdByName: c.createdBy ? nameMap.get(c.createdBy) : undefined,
        modifiedByName: c.updatedBy ? nameMap.get(c.updatedBy) : undefined,
      }),
    ),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getContact(tenantId: string, id: string) {
  const contact = await repo.findContactById(tenantId, id)
  if (!contact) throw new NotFoundError('Contact not found')
  const nameMap = await resolveUserNames([contact.createdBy, contact.updatedBy], tenantId, prisma)
  return mapContactToDto(contact, {
    createdByName: contact.createdBy ? nameMap.get(contact.createdBy) : undefined,
    modifiedByName: contact.updatedBy ? nameMap.get(contact.updatedBy) : undefined,
  })
}

export async function createContact(tenantId: string, userId: string, input: CreateContactInput) {
  const exists = await repo.companyExists(tenantId, input.customerId)
  if (!exists) throw new ValidationError('Customer not found', [{ field: 'customerId', message: 'Invalid customer' }])
  const contactCode = input.contactCode ?? (await nextCode(tenantId, 'CONTACT'))
  const contact = await repo.createContact(tenantId, userId, { ...input, contactCode })
  return mapContactToDto(contact)
}

export async function updateContact(tenantId: string, id: string, userId: string, input: UpdateContactInput) {
  const existing = await repo.findContactById(tenantId, id)
  if (!existing) throw new NotFoundError('Contact not found')
  if (input.customerId) {
    const exists = await repo.companyExists(tenantId, input.customerId)
    if (!exists) throw new ValidationError('Customer not found', [{ field: 'customerId', message: 'Invalid customer' }])
  }
  const contact = await repo.updateContact(tenantId, id, userId, input)
  return mapContactToDto(contact)
}

export async function deleteContact(tenantId: string, id: string, userId: string) {
  const existing = await repo.findContactById(tenantId, id)
  if (!existing) throw new NotFoundError('Contact not found')
  await repo.softDeleteContact(tenantId, id, userId)
}
