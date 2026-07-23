import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { NotFoundError } from '../../../utils/errors.js'

export const materialInclude = {
  item: {
    select: {
      id: true,
      code: true,
      name: true,
      isStockable: true,
      batchTracked: true,
      serialTracked: true,
    },
  },
  uom: { select: { id: true, code: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  bomLine: {
    select: {
      id: true,
      sequence: true,
      requiredQuantity: true,
      makeOrBuy: true,
      issueStageGroupId: true,
      issueOperationId: true,
    },
  },
  reservation: { select: { id: true, reservationNumber: true, status: true, quantity: true, fulfilledQty: true } },
  purchaseRequisition: { select: { id: true, requisitionNumber: true, status: true } },
} satisfies Prisma.ProductionOrderMaterialInclude

export type MaterialRow = Prisma.ProductionOrderMaterialGetPayload<{ include: typeof materialInclude }>

export async function findWorkOrderWithProfile(tenantId: string, orderId: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId, ...tenantActiveFilter(tenantId) },
    include: {
      manufacturingProfile: {
        select: {
          id: true,
          productionWarehouseId: true,
          finishedGoodsWarehouseId: true,
        },
      },
      productItem: { select: { id: true, isStockable: true, code: true, name: true } },
      bomSnapshot: { include: { lines: { include: { item: { select: { id: true, isStockable: true } } } } } },
    },
  })
  if (!order) throw new NotFoundError('Work order not found')
  return order
}

export async function listMaterials(tenantId: string, orderId: string): Promise<MaterialRow[]> {
  return prisma.productionOrderMaterial.findMany({
    where: { tenantId, productionOrderId: orderId },
    include: materialInclude,
    orderBy: [{ bomLine: { sequence: 'asc' } }, { createdAt: 'asc' }],
  })
}

export async function listMaterialsByIds(tenantId: string, materialIds: string[]): Promise<MaterialRow[]> {
  if (materialIds.length === 0) return []
  return prisma.productionOrderMaterial.findMany({
    where: { tenantId, id: { in: materialIds } },
    include: materialInclude,
    orderBy: [{ productionOrderId: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function findMaterialOrThrow(tenantId: string, orderId: string, materialId: string): Promise<MaterialRow> {
  const row = await prisma.productionOrderMaterial.findFirst({
    where: { id: materialId, tenantId, productionOrderId: orderId },
    include: materialInclude,
  })
  if (!row) throw new NotFoundError('Production material not found')
  return row
}

export async function findExistingBomLineIds(tenantId: string, orderId: string, bomLineIds: string[]): Promise<Set<string>> {
  if (bomLineIds.length === 0) return new Set()
  const rows = await prisma.productionOrderMaterial.findMany({
    where: { tenantId, productionOrderId: orderId, bomLineId: { in: bomLineIds } },
    select: { bomLineId: true },
  })
  return new Set(rows.map((r) => r.bomLineId))
}
