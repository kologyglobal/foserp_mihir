import type { Prisma, PaymentAccountMapping } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { PaymentAccountMappingNotFoundError, TreasuryStaleVersionError } from '../treasury.errors.js'
import type { ListPaymentAccountMappingsQuery } from './payment-account-mapping.schemas.js'

export async function listMappings(tenantId: string, query: ListPaymentAccountMappingsQuery) {
  const { skip, take } = getPagination(query)
  const where: Prisma.PaymentAccountMappingWhereInput = {
    tenantId,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(query.useCase ? { useCase: query.useCase } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.paymentAccountMapping.findMany({
      where,
      skip,
      take,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.paymentAccountMapping.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getMapping(tenantId: string, id: string): Promise<PaymentAccountMapping> {
  const item = await prisma.paymentAccountMapping.findFirst({ where: { id, tenantId } })
  if (!item) throw new PaymentAccountMappingNotFoundError()
  return item
}

export async function findConflictingDefault(
  tenantId: string,
  legalEntityId: string,
  paymentMethod: string,
  useCase: string,
  direction: string,
  excludeId?: string,
): Promise<PaymentAccountMapping | null> {
  return prisma.paymentAccountMapping.findFirst({
    where: {
      tenantId,
      legalEntityId,
      paymentMethod: paymentMethod as never,
      useCase: useCase as never,
      direction: direction as never,
      isDefault: true,
      isActive: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export interface CreateMappingData {
  tenantId: string
  legalEntityId: string
  branchId: string | null
  paymentMethod: string
  direction: string
  useCase: string
  role: string
  currencyCode: string | null
  treasuryAccountId: string
  clearingAccountId: string | null
  priority: number
  isDefault: boolean
  description: string | null
  createdBy: string | null
}

export async function createMapping(data: CreateMappingData): Promise<PaymentAccountMapping> {
  return prisma.paymentAccountMapping.create({
    data: {
      tenantId: data.tenantId,
      legalEntityId: data.legalEntityId,
      branchId: data.branchId,
      paymentMethod: data.paymentMethod as never,
      direction: data.direction as never,
      useCase: data.useCase as never,
      role: data.role as never,
      currencyCode: data.currencyCode,
      treasuryAccountId: data.treasuryAccountId,
      clearingAccountId: data.clearingAccountId,
      priority: data.priority,
      isDefault: data.isDefault,
      isActive: true,
      description: data.description,
      createdBy: data.createdBy,
      updatedBy: data.createdBy,
    },
  })
}

export interface UpdateMappingData {
  branchId?: string | null
  direction?: string
  currencyCode?: string | null
  treasuryAccountId?: string
  clearingAccountId?: string | null
  priority?: number
  isDefault?: boolean
  description?: string | null
  updatedBy: string | null
}

export async function updateMapping(
  tenantId: string,
  id: string,
  data: UpdateMappingData,
  expectedUpdatedAt: string,
): Promise<PaymentAccountMapping> {
  const existing = await getMapping(tenantId, id)
  assertNotStale(existing, expectedUpdatedAt)
  return prisma.paymentAccountMapping.update({
    where: { id, tenantId },
    data: {
      branchId: data.branchId,
      direction: data.direction as never,
      currencyCode: data.currencyCode,
      treasuryAccountId: data.treasuryAccountId,
      clearingAccountId: data.clearingAccountId,
      priority: data.priority,
      isDefault: data.isDefault,
      description: data.description,
      updatedBy: data.updatedBy,
    },
  })
}

export async function setActive(
  tenantId: string,
  id: string,
  isActive: boolean,
  userId: string | null,
  expectedUpdatedAt: string,
): Promise<PaymentAccountMapping> {
  const existing = await getMapping(tenantId, id)
  assertNotStale(existing, expectedUpdatedAt)
  return prisma.paymentAccountMapping.update({
    where: { id, tenantId },
    data: { isActive, updatedBy: userId },
  })
}

function assertNotStale(existing: PaymentAccountMapping, expectedUpdatedAt: string): void {
  if (existing.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new TreasuryStaleVersionError()
  }
}

export async function findCandidatesForResolve(
  tenantId: string,
  legalEntityId: string,
  paymentMethod: string,
  useCase: string,
  direction: 'RECEIPT' | 'PAYMENT',
): Promise<PaymentAccountMapping[]> {
  return prisma.paymentAccountMapping.findMany({
    where: {
      tenantId,
      legalEntityId,
      paymentMethod: paymentMethod as never,
      useCase: useCase as never,
      isActive: true,
      direction: { in: [direction, 'BOTH'] as never },
    },
  })
}
