import type { QualityInspectionCategory, QualityInspectionPlanStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import type { ListPlansQuery, PlanLineInput } from './inspection-plan.schemas.js'

const planInclude = {
  lines: {
    include: { parameter: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.QualityInspectionPlanInclude

export async function listPlans(tenantId: string, query: ListPlansQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const where: Prisma.QualityInspectionPlanWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.search
      ? {
          OR: [{ planCode: { contains: query.search } }, { planName: { contains: query.search } }],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.qualityInspectionPlan.findMany({
      where,
      include: planInclude,
      orderBy: [{ planCode: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.qualityInspectionPlan.count({ where }),
  ])
  return { items, total, page, limit }
}

export async function getPlan(tenantId: string, id: string) {
  return prisma.qualityInspectionPlan.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: planInclude,
  })
}

export async function findByCode(tenantId: string, planCode: string, excludeId?: string) {
  return prisma.qualityInspectionPlan.findFirst({
    where: {
      tenantId,
      planCode,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function findActivePlanForResolve(
  tenantId: string,
  category: QualityInspectionCategory,
  opts: { itemId?: string | null; planCode?: string | null },
) {
  const now = new Date()
  if (opts.planCode) {
    const byCode = await prisma.qualityInspectionPlan.findFirst({
      where: {
        tenantId,
        planCode: opts.planCode,
        status: 'ACTIVE',
        deletedAt: null,
        category,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        effectiveFrom: { lte: now },
      },
      include: planInclude,
    })
    if (byCode) return byCode
  }

  if (opts.itemId) {
    const byItem = await prisma.qualityInspectionPlan.findFirst({
      where: {
        tenantId,
        itemId: opts.itemId,
        status: 'ACTIVE',
        deletedAt: null,
        category,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        effectiveFrom: { lte: now },
      },
      include: planInclude,
      orderBy: { updatedAt: 'desc' },
    })
    if (byItem) return byItem
  }

  return prisma.qualityInspectionPlan.findFirst({
    where: {
      tenantId,
      itemId: null,
      status: 'ACTIVE',
      deletedAt: null,
      category,
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      effectiveFrom: { lte: now },
    },
    include: planInclude,
    orderBy: { updatedAt: 'desc' },
  })
}

export async function createPlan(
  tx: Prisma.TransactionClient,
  data: {
    tenantId: string
    planCode: string
    planName: string
    category: QualityInspectionCategory
    status: QualityInspectionPlanStatus
    itemId?: string | null
    itemCategoryId?: string | null
    operationName?: string | null
    workCenterId?: string | null
    effectiveFrom: Date
    effectiveTo?: Date | null
    revision?: string | null
    samplingMethod?: import('@prisma/client').QualitySamplingMethod | null
    sampleSizeMode?: string | null
    fixedSampleSize?: number | null
    samplePercentage?: number | null
    certificateRequired?: boolean
    acceptanceRule?: string | null
    createdBy?: string | null
    lines: Array<PlanLineInput & { tenantId: string }>
  },
) {
  return tx.qualityInspectionPlan.create({
    data: {
      tenantId: data.tenantId,
      planCode: data.planCode,
      planName: data.planName,
      category: data.category,
      status: data.status,
      itemId: data.itemId ?? null,
      itemCategoryId: data.itemCategoryId ?? null,
      operationName: data.operationName ?? null,
      workCenterId: data.workCenterId ?? null,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo ?? null,
      revision: data.revision ?? null,
      samplingMethod: data.samplingMethod ?? 'FULL_INSPECTION',
      sampleSizeMode: data.sampleSizeMode ?? null,
      fixedSampleSize:
        data.fixedSampleSize != null ? new Prisma.Decimal(data.fixedSampleSize) : null,
      samplePercentage:
        data.samplePercentage != null ? new Prisma.Decimal(data.samplePercentage) : null,
      certificateRequired: data.certificateRequired ?? false,
      acceptanceRule: data.acceptanceRule ?? null,
      createdBy: data.createdBy ?? null,
      lines: {
        create: data.lines.map((line, idx) => ({
          tenantId: data.tenantId,
          parameterId: line.parameterId,
          sortOrder: line.sortOrder ?? idx,
          mandatoryOverride: line.mandatoryOverride ?? null,
          minValueOverride: line.minValueOverride != null ? new Prisma.Decimal(line.minValueOverride) : null,
          maxValueOverride: line.maxValueOverride != null ? new Prisma.Decimal(line.maxValueOverride) : null,
          targetValueOverride:
            line.targetValueOverride != null ? new Prisma.Decimal(line.targetValueOverride) : null,
          severityOverride: line.severityOverride ?? null,
          photoRequiredOverride: line.photoRequiredOverride ?? null,
          remarksRequired: line.remarksRequired ?? false,
        })),
      },
    },
    include: planInclude,
  })
}

export async function updatePlanHeader(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  data: Prisma.QualityInspectionPlanUpdateInput,
) {
  return tx.qualityInspectionPlan.update({
    where: { id, tenantId },
    data,
    include: planInclude,
  })
}

export async function replaceLines(
  tx: Prisma.TransactionClient,
  tenantId: string,
  planId: string,
  lines: PlanLineInput[],
) {
  await tx.qualityInspectionPlanLine.deleteMany({ where: { tenantId, planId } })
  await tx.qualityInspectionPlanLine.createMany({
    data: lines.map((line, idx) => ({
      tenantId,
      planId,
      parameterId: line.parameterId,
      sortOrder: line.sortOrder ?? idx,
      mandatoryOverride: line.mandatoryOverride ?? null,
      minValueOverride: line.minValueOverride != null ? new Prisma.Decimal(line.minValueOverride) : null,
      maxValueOverride: line.maxValueOverride != null ? new Prisma.Decimal(line.maxValueOverride) : null,
      targetValueOverride:
        line.targetValueOverride != null ? new Prisma.Decimal(line.targetValueOverride) : null,
      severityOverride: line.severityOverride ?? null,
      photoRequiredOverride: line.photoRequiredOverride ?? null,
      remarksRequired: line.remarksRequired ?? false,
    })),
  })
  return getPlan(tenantId, planId)
}

export async function softDeletePlan(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  userId: string,
) {
  return tx.qualityInspectionPlan.update({
    where: { id, tenantId },
    data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: userId },
    include: planInclude,
  })
}
