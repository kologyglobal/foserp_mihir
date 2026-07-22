import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import type { ListPlansQuery, PlanLineInput } from './plan.schemas.js'

const lineInclude = {
  productItem: { select: { id: true, code: true, name: true, baseUomId: true } },
  uom: { select: { id: true, code: true, name: true } },
  productionOrder: { select: { id: true, orderNumber: true, status: true } },
  demand: { select: { id: true, demandNumber: true, status: true } },
} as const

const planInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  lines: {
    where: { deletedAt: null },
    orderBy: { lineNo: 'asc' as const },
    include: lineInclude,
  },
} as const

export type PlanRow = Prisma.ProductionPlanGetPayload<{ include: typeof planInclude }>
export type PlanLineRow = Prisma.ProductionPlanLineGetPayload<{ include: typeof lineInclude }>

export async function findPlanByIdempotencyKey(tenantId: string, key: string) {
  return prisma.productionPlan.findFirst({
    where: { tenantId, idempotencyKey: key, deletedAt: null },
    include: planInclude,
  })
}

export async function listPlans(tenantId: string, query: ListPlansQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const where: Prisma.ProductionPlanWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.sourceType ? { sourceType: query.sourceType } : {}),
    ...(query.search
      ? {
          OR: [
            { planNumber: { contains: query.search } },
            { planName: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [total, data] = await Promise.all([
    prisma.productionPlan.count({ where }),
    prisma.productionPlan.findMany({
      where,
      include: planInclude,
      orderBy: [{ planDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return { total, page, limit, data }
}

export async function getPlan(tenantId: string, planId: string): Promise<PlanRow> {
  const plan = await prisma.productionPlan.findFirst({
    where: { id: planId, tenantId, deletedAt: null },
    include: planInclude,
  })
  if (!plan) throw new NotFoundError('Production plan not found')
  return plan
}

export async function createPlan(
  data: Prisma.ProductionPlanCreateInput,
  lines: Array<Prisma.ProductionPlanLineCreateWithoutPlanInput>,
) {
  return prisma.productionPlan.create({
    data: {
      ...data,
      lines: { create: lines },
    },
    include: planInclude,
  })
}

export async function replaceDraftLines(
  tenantId: string,
  planId: string,
  lines: Array<Prisma.ProductionPlanLineCreateManyInput>,
  header: Prisma.ProductionPlanUpdateInput,
) {
  return prisma.$transaction(async (tx) => {
    await tx.productionPlanLine.updateMany({
      where: { tenantId, planId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (lines.length) {
      await tx.productionPlanLine.createMany({ data: lines })
    }
    return tx.productionPlan.update({
      where: { id: planId },
      data: header,
      include: planInclude,
    })
  })
}

export async function updatePlanHeader(tenantId: string, planId: string, data: Prisma.ProductionPlanUpdateInput) {
  await getPlan(tenantId, planId)
  return prisma.productionPlan.update({
    where: { id: planId },
    data,
    include: planInclude,
  })
}

export async function updateLineNetting(
  lineId: string,
  data: {
    availableFinishedStock: Prisma.Decimal
    openWorkOrderQuantity: Prisma.Decimal
    suggestedQuantity: Prisma.Decimal
    bomReady: boolean
    materialStatus: string
    updatedBy: string
  },
) {
  return prisma.productionPlanLine.update({
    where: { id: lineId },
    data,
  })
}

export function mapLineCreateInput(
  tenantId: string,
  lineNo: number,
  input: PlanLineInput,
  uomId: string,
  userId: string,
): Prisma.ProductionPlanLineCreateWithoutPlanInput {
  return {
    tenant: { connect: { id: tenantId } },
    lineNo,
    productItem: { connect: { id: input.productItemId } },
    uom: { connect: { id: uomId } },
    demandQuantity: input.demandQuantity,
    safetyStockQuantity: input.safetyStockQuantity ?? 0,
    suggestedQuantity: input.demandQuantity,
    requiredDate: input.requiredDate ? new Date(input.requiredDate) : null,
    salesOrderId: input.salesOrderId ?? null,
    sourceDocumentId: input.sourceDocumentId ?? null,
    sourceDocumentNo: input.sourceDocumentNo ?? null,
    notes: input.notes ?? null,
    ignored: input.ignored ?? false,
    createdBy: userId,
    updatedBy: userId,
  }
}

export function mapLineCreateManyInput(
  tenantId: string,
  planId: string,
  lineNo: number,
  input: PlanLineInput,
  uomId: string,
  userId: string,
): Prisma.ProductionPlanLineCreateManyInput {
  return {
    tenantId,
    planId,
    lineNo,
    productItemId: input.productItemId,
    uomId,
    demandQuantity: input.demandQuantity,
    safetyStockQuantity: input.safetyStockQuantity ?? 0,
    suggestedQuantity: input.demandQuantity,
    requiredDate: input.requiredDate ? new Date(input.requiredDate) : null,
    salesOrderId: input.salesOrderId ?? null,
    sourceDocumentId: input.sourceDocumentId ?? null,
    sourceDocumentNo: input.sourceDocumentNo ?? null,
    notes: input.notes ?? null,
    ignored: input.ignored ?? false,
    createdBy: userId,
    updatedBy: userId,
  }
}
