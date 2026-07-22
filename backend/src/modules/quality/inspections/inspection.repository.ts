import type { QualityInspectionCategory, ManufacturingQualityInspectionStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import type { ListInspectionsQuery } from './inspection.schemas.js'

export async function listInspections(tenantId: string, query: ListInspectionsQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const where: Prisma.ManufacturingQualityInspectionWhereInput = {
    tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.productionOrderId ? { productionOrderId: query.productionOrderId } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.manufacturingQualityInspection.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.manufacturingQualityInspection.count({ where }),
  ])
  return { items, total, page, limit }
}

export async function getInspection(tenantId: string, id: string) {
  return prisma.manufacturingQualityInspection.findFirst({
    where: { id, tenantId },
    include: {
      parameterResults: { orderBy: { sortOrder: 'asc' } },
      inspectionPlan: { select: { id: true, planCode: true, planName: true, category: true, status: true } },
    },
  })
}

export async function findByIdempotencyKey(tenantId: string, idempotencyKey: string) {
  return prisma.manufacturingQualityInspection.findFirst({
    where: { tenantId, idempotencyKey },
    include: {
      parameterResults: { orderBy: { sortOrder: 'asc' } },
      inspectionPlan: { select: { id: true, planCode: true, planName: true, category: true, status: true } },
    },
  })
}

export async function createInspection(
  tx: Prisma.TransactionClient,
  data: {
    tenantId: string
    inspectionNumber: string
    category: QualityInspectionCategory
    productionOrderId: string
    stageId?: string | null
    operationId?: string | null
    itemId?: string | null
    inspectionPlanId?: string | null
    inspectionPlanRevisionId?: string | null
    planCodeSnapshot?: string | null
    planRevisionSnapshot?: string | null
    parameterSnapshotJson?: Prisma.InputJsonValue | null
    inspectedQty?: Prisma.Decimal | null
    sampleQty?: Prisma.Decimal | null
    certificateRequired?: boolean
    title: string
    remarks?: string | null
    idempotencyKey?: string | null
    requestedByUserId?: string | null
    createdBy?: string | null
  },
) {
  return tx.manufacturingQualityInspection.create({
    data: {
      tenantId: data.tenantId,
      inspectionNumber: data.inspectionNumber,
      category: data.category,
      productionOrderId: data.productionOrderId,
      stageId: data.stageId ?? null,
      operationId: data.operationId ?? null,
      itemId: data.itemId ?? null,
      inspectionPlanId: data.inspectionPlanId ?? null,
      inspectionPlanRevisionId: data.inspectionPlanRevisionId ?? null,
      planCodeSnapshot: data.planCodeSnapshot ?? null,
      planRevisionSnapshot: data.planRevisionSnapshot ?? null,
      parameterSnapshotJson:
        data.parameterSnapshotJson === null || data.parameterSnapshotJson === undefined
          ? Prisma.DbNull
          : data.parameterSnapshotJson,
      inspectedQty: data.inspectedQty ?? null,
      sampleQty: data.sampleQty ?? null,
      certificateRequired: data.certificateRequired ?? false,
      title: data.title,
      remarks: data.remarks ?? null,
      idempotencyKey: data.idempotencyKey ?? null,
      requestedByUserId: data.requestedByUserId ?? null,
      createdBy: data.createdBy ?? null,
      status: 'PENDING',
    },
    include: {
      parameterResults: { orderBy: { sortOrder: 'asc' } },
      inspectionPlan: { select: { id: true, planCode: true, planName: true, category: true, status: true } },
    },
  })
}

export async function updateInspection(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  data: Prisma.ManufacturingQualityInspectionUpdateInput,
) {
  return tx.manufacturingQualityInspection.update({ where: { id, tenantId }, data })
}

export async function countOpenForOrder(tenantId: string, productionOrderId: string, statuses: ManufacturingQualityInspectionStatus[]) {
  return prisma.manufacturingQualityInspection.count({
    where: { tenantId, productionOrderId, status: { in: statuses } },
  })
}
