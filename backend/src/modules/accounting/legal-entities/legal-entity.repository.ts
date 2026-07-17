import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  assertLegalEntityUsed,
  unsetOtherDefaults,
} from '../shared/finance.helpers.js'
import { normalizeTaxId, validateLegalEntityTaxIds } from '../shared/finance.validators.js'
import type { CreateLegalEntityInput, ListLegalEntitiesQuery, UpdateLegalEntityInput } from './legal-entity.validation.js'

function mapInput(input: Record<string, unknown>) {
  const data = { ...input }
  if ('pan' in data) data.pan = normalizeTaxId(data.pan as string | null)
  if ('gstin' in data) data.gstin = normalizeTaxId(data.gstin as string | null)
  if ('cin' in data) data.cin = normalizeTaxId(data.cin as string | null)
  return data
}

export async function listLegalEntities(tenantId: string, query: ListLegalEntitiesQuery) {
  const { skip, take } = getPagination(query)
  const where: Prisma.LegalEntityWhereInput = {
    tenantId,
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  }
  if (query.search) {
    where.OR = [
      { code: { contains: query.search } },
      { legalName: { contains: query.search } },
      { displayName: { contains: query.search } },
    ]
  }
  const [items, total] = await Promise.all([
    prisma.legalEntity.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.legalEntity.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getLegalEntity(tenantId: string, id: string) {
  const item = await prisma.legalEntity.findFirst({ where: { id, tenantId } })
  if (!item) throw new NotFoundError('Legal entity not found')
  return item
}

export async function createLegalEntity(
  tenantId: string,
  userId: string,
  input: CreateLegalEntityInput,
) {
  validateLegalEntityTaxIds(input)
  const { initialBranch, ...entityInput } = input
  const data = mapInput(entityInput as Record<string, unknown>)

  const defaultCount = await prisma.legalEntity.count({ where: { tenantId, isDefault: true } })
  const isDefault = input.isDefault ?? defaultCount === 0

  try {
    return await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.legalEntity.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } })
      }
      const entity = await tx.legalEntity.create({
        data: {
          tenantId,
          ...(data as Omit<Prisma.LegalEntityUncheckedCreateInput, 'tenantId' | 'createdBy' | 'updatedBy'>),
          isDefault,
          createdBy: userId,
          updatedBy: userId,
        },
      })

      const branchPayload = initialBranch
      await tx.branch.create({
        data: {
          tenantId,
          legalEntityId: entity.id,
          code: branchPayload?.code ?? 'HO',
          name: branchPayload?.name ?? 'Head Office',
          branchType: branchPayload?.branchType ?? 'HEAD_OFFICE',
          gstin: normalizeTaxId(branchPayload?.gstin),
          stateCode: branchPayload?.stateCode ?? entity.stateCode,
          addressJson: (branchPayload?.addressJson ?? undefined) as Prisma.InputJsonValue | undefined,
          phone: branchPayload?.phone,
          email: branchPayload?.email || undefined,
          isHeadOffice: true,
          isDefault: true,
          isActive: true,
          createdBy: userId,
          updatedBy: userId,
        },
      })

      return entity
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('This legal entity code is already in use.')
    }
    throw err
  }
}

export async function updateLegalEntity(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdateLegalEntityInput,
) {
  await getLegalEntity(tenantId, id)
  validateLegalEntityTaxIds(input)
  const data = mapInput(input as Record<string, unknown>)
  try {
    return await prisma.legalEntity.update({
      where: { id, tenantId },
      data: { ...data, updatedBy: userId },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('This legal entity code is already in use.')
    }
    throw err
  }
}

export async function setDefaultLegalEntity(tenantId: string, id: string, userId: string) {
  const entity = await getLegalEntity(tenantId, id)
  if (!entity.isActive) throw new InvalidStateError('Cannot set an inactive legal entity as default')
  await unsetOtherDefaults(tenantId, null, 'legalEntity', id)
  return prisma.legalEntity.update({
    where: { id, tenantId },
    data: { isDefault: true, updatedBy: userId },
  })
}

export async function activateLegalEntity(tenantId: string, id: string, userId: string) {
  await getLegalEntity(tenantId, id)
  return prisma.legalEntity.update({
    where: { id, tenantId },
    data: { isActive: true, updatedBy: userId },
  })
}

export async function deactivateLegalEntity(tenantId: string, id: string, userId: string) {
  const entity = await getLegalEntity(tenantId, id)
  if (entity.isDefault) {
    const otherDefault = await prisma.legalEntity.findFirst({
      where: { tenantId, isDefault: true, id: { not: id }, isActive: true },
    })
    if (!otherDefault) {
      throw new InvalidStateError('Deactivating the default entity is blocked until another default is assigned.')
    }
  }
  return prisma.legalEntity.update({
    where: { id, tenantId },
    data: { isActive: false, updatedBy: userId },
  })
}

export async function assertLegalEntityNotUsed(tenantId: string, legalEntityId: string): Promise<void> {
  if (await assertLegalEntityUsed(tenantId, legalEntityId)) {
    throw new InvalidStateError('Legal entity with financial data cannot be deleted')
  }
}
