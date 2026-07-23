import type { OrganisationRegistrationStatus, OrganisationRegistrationType, Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js'
import { getPagination } from '../../utils/pagination.js'
import type {
  CreateRegistrationInput,
  ListRegistrationsQuery,
  UpdateRegistrationInput,
} from './organisation.validation.js'
import { GSTIN_ORG_REGEX } from './organisation.validation.js'

export async function listRegistrations(tenantId: string, query: ListRegistrationsQuery) {
  const { skip, take } = getPagination(query)
  const where: Prisma.OrganisationRegistrationWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.organisationRegistration.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.organisationRegistration.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getRegistration(tenantId: string, id: string) {
  const item = await prisma.organisationRegistration.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!item) throw new NotFoundError('Registration not found')
  return item
}

function assertRegistrationNumber(type: OrganisationRegistrationType, number: string) {
  const normalized = number.trim().toUpperCase()
  if (type === 'GST' && !GSTIN_ORG_REGEX.test(normalized)) {
    throw new ValidationError('GST registration number must be a valid 15-character GSTIN')
  }
  return normalized
}

export async function createRegistration(
  tenantId: string,
  userId: string,
  input: CreateRegistrationInput,
) {
  const le = await prisma.legalEntity.findFirst({
    where: { id: input.legalEntityId, tenantId },
  })
  if (!le) throw new NotFoundError('Legal entity not found')

  const registrationNumber = assertRegistrationNumber(input.registrationType, input.registrationNumber)

  try {
    return await prisma.organisationRegistration.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        registrationType: input.registrationType,
        registrationNumber,
        country: input.country,
        state: input.state ?? null,
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
        status: (input.status ?? 'ACTIVE') as OrganisationRegistrationStatus,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      throw new ConflictError('A registration with this type and number already exists')
    }
    throw e
  }
}

export async function updateRegistration(
  tenantId: string,
  userId: string,
  id: string,
  input: UpdateRegistrationInput,
) {
  const existing = await getRegistration(tenantId, id)
  const registrationType = (input.registrationType ?? existing.registrationType) as OrganisationRegistrationType
  const registrationNumber = input.registrationNumber
    ? assertRegistrationNumber(registrationType, input.registrationNumber)
    : existing.registrationNumber

  try {
    return await prisma.organisationRegistration.update({
      where: { id },
      data: {
        ...(input.legalEntityId ? { legalEntityId: input.legalEntityId } : {}),
        ...(input.registrationType ? { registrationType: input.registrationType } : {}),
        registrationNumber,
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.validFrom !== undefined ? { validFrom: input.validFrom } : {}),
        ...(input.validTo !== undefined ? { validTo: input.validTo } : {}),
        ...(input.status ? { status: input.status } : {}),
        updatedBy: userId,
      },
    })
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      throw new ConflictError('A registration with this type and number already exists')
    }
    throw e
  }
}
