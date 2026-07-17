import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  getLegalEntityOrThrow,
  unsetOtherDefaults,
} from '../shared/finance.helpers.js'
import { normalizeTaxId, validateGstin } from '../shared/finance.validators.js'
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from './branch.validation.js'

export async function listBranches(tenantId: string, legalEntityId: string, query: ListBranchesQuery) {
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  const { skip, take } = getPagination(query)
  const where: Prisma.BranchWhereInput = {
    tenantId,
    legalEntityId,
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  }
  if (query.search) {
    where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }]
  }
  const [items, total] = await Promise.all([
    prisma.branch.findMany({ where, skip, take, orderBy: { code: 'asc' } }),
    prisma.branch.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getBranch(tenantId: string, id: string) {
  const item = await prisma.branch.findFirst({ where: { id, tenantId } })
  if (!item) throw new NotFoundError('Branch not found')
  return item
}

export async function createBranch(
  tenantId: string,
  legalEntityId: string,
  userId: string,
  input: CreateBranchInput,
) {
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  validateGstin(input.gstin)
  const isHeadOffice = input.isHeadOffice ?? false
  const isDefault = input.isDefault ?? false

  if (isHeadOffice) {
    const existingHo = await prisma.branch.findFirst({
      where: { tenantId, legalEntityId, isHeadOffice: true, isActive: true },
    })
    if (existingHo) throw new ConflictError('Only one head-office branch is allowed per legal entity')
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.branch.updateMany({ where: { tenantId, legalEntityId, isDefault: true }, data: { isDefault: false } })
      }
      if (isHeadOffice) {
        await tx.branch.updateMany({ where: { tenantId, legalEntityId, isHeadOffice: true }, data: { isHeadOffice: false } })
      }
      return tx.branch.create({
        data: {
          tenantId,
          legalEntityId,
          code: input.code,
          name: input.name,
          branchType: input.branchType,
          gstin: normalizeTaxId(input.gstin),
          stateCode: input.stateCode,
          addressJson: (input.addressJson ?? undefined) as Prisma.InputJsonValue | undefined,
          phone: input.phone,
          email: input.email || undefined,
          isHeadOffice,
          isDefault,
          isActive: true,
          createdBy: userId,
          updatedBy: userId,
        },
      })
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Branch code must be unique within the legal entity')
    }
    throw err
  }
}

export async function updateBranch(tenantId: string, id: string, userId: string, input: UpdateBranchInput) {
  const branch = await getBranch(tenantId, id)
  validateGstin(input.gstin)
  if (input.isHeadOffice && !branch.isHeadOffice) {
    const existingHo = await prisma.branch.findFirst({
      where: {
        tenantId,
        legalEntityId: branch.legalEntityId,
        isHeadOffice: true,
        isActive: true,
        id: { not: id },
      },
    })
    if (existingHo) throw new ConflictError('Only one head-office branch is allowed per legal entity')
  }
  try {
    const updateData: Prisma.BranchUpdateInput = {
      code: input.code,
      name: input.name,
      branchType: input.branchType,
      gstin: input.gstin !== undefined ? normalizeTaxId(input.gstin) : undefined,
      stateCode: input.stateCode,
      addressJson: input.addressJson as Prisma.InputJsonValue | undefined,
      phone: input.phone,
      email: input.email === '' ? null : input.email,
      isHeadOffice: input.isHeadOffice,
      isDefault: input.isDefault,
      updatedBy: userId,
    }
    return await prisma.branch.update({
      where: { id, tenantId },
      data: updateData,
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Branch code must be unique within the legal entity')
    }
    throw err
  }
}

export async function setDefaultBranch(tenantId: string, id: string, userId: string) {
  const branch = await getBranch(tenantId, id)
  if (!branch.isActive) throw new InvalidStateError('Cannot set an inactive branch as default')
  await unsetOtherDefaults(tenantId, branch.legalEntityId, 'branch', id)
  return prisma.branch.update({ where: { id, tenantId }, data: { isDefault: true, updatedBy: userId } })
}

export async function activateBranch(tenantId: string, id: string, userId: string) {
  await getBranch(tenantId, id)
  return prisma.branch.update({ where: { id, tenantId }, data: { isActive: true, updatedBy: userId } })
}

export async function deactivateBranch(tenantId: string, id: string, userId: string) {
  const branch = await getBranch(tenantId, id)
  const activeCount = await prisma.branch.count({
    where: { tenantId, legalEntityId: branch.legalEntityId, isActive: true },
  })
  if (activeCount <= 1) {
    throw new InvalidStateError('Cannot deactivate the last active branch')
  }
  return prisma.branch.update({ where: { id, tenantId }, data: { isActive: false, updatedBy: userId } })
}
