import type { Prisma, QualityParameterType } from '@prisma/client'
import { Prisma as PrismaNS } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import type { ListParametersQuery } from './parameter.schemas.js'

export async function listParameters(tenantId: string, query: ListParametersQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const where: Prisma.QualityParameterWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.active !== undefined ? { active: query.active } : {}),
    ...(query.parameterType ? { parameterType: query.parameterType } : {}),
    ...(query.search
      ? {
          OR: [
            { parameterCode: { contains: query.search } },
            { parameterName: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.qualityParameter.findMany({
      where,
      orderBy: [{ parameterCode: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.qualityParameter.count({ where }),
  ])
  return { items, total, page, limit }
}

export async function getParameter(tenantId: string, id: string) {
  return prisma.qualityParameter.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export async function findByCode(tenantId: string, parameterCode: string, excludeId?: string) {
  return prisma.qualityParameter.findFirst({
    where: {
      tenantId,
      parameterCode,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function createParameter(
  tx: Prisma.TransactionClient,
  data: {
    tenantId: string
    parameterCode: string
    parameterName: string
    parameterType: QualityParameterType
    uomCode?: string | null
    minValue?: Prisma.Decimal | null
    maxValue?: Prisma.Decimal | null
    targetValue?: Prisma.Decimal | null
    mandatory?: boolean
    severity?: 'MINOR' | 'MAJOR' | 'CRITICAL'
    passFailRule?: 'BOOLEAN_TRUE' | 'BOOLEAN_FALSE' | 'NUMERIC_TOLERANCE' | 'MANUAL'
    dropdownOptions?: Prisma.InputJsonValue | typeof PrismaNS.JsonNull | typeof PrismaNS.DbNull
    active?: boolean
    createdBy?: string | null
  },
) {
  return tx.qualityParameter.create({
    data: {
      tenantId: data.tenantId,
      parameterCode: data.parameterCode,
      parameterName: data.parameterName,
      parameterType: data.parameterType,
      uomCode: data.uomCode ?? null,
      minValue: data.minValue ?? null,
      maxValue: data.maxValue ?? null,
      targetValue: data.targetValue ?? null,
      mandatory: data.mandatory ?? true,
      severity: data.severity ?? 'MAJOR',
      passFailRule: data.passFailRule ?? 'MANUAL',
      dropdownOptions: data.dropdownOptions === undefined ? undefined : data.dropdownOptions,
      active: data.active ?? true,
      createdBy: data.createdBy ?? null,
    },
  })
}

export async function updateParameter(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  data: Prisma.QualityParameterUpdateInput,
) {
  return tx.qualityParameter.update({ where: { id, tenantId }, data })
}

export async function softDeleteParameter(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  userId: string,
) {
  return tx.qualityParameter.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), active: false, updatedBy: userId },
  })
}
