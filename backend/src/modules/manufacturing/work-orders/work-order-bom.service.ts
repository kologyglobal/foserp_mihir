import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { assertItem, assertUom } from '../shared/manufacturing.helpers.js'
import { dec } from '../shared/manufacturing.mappers.js'
import { toDecimal } from '../shared/quantity.service.js'
import type { AddWorkOrderBomLineInput, UpdateWorkOrderBomLineInput } from './work-order-bom.schemas.js'

function mapBomLine(line: {
  id: string
  tenantId: string
  bomSnapshotId: string
  sourceBomLineId: string | null
  parentLineId: string | null
  sequence: number
  level: number
  itemId: string
  descriptionOverride: string | null
  perUnitQuantity: unknown
  uomId: string
  scrapPercent: unknown
  requiredQuantity: unknown
  makeOrBuy: string
  lineType: string
  issueStageGroupId: string | null
  issueOperationId: string | null
  isOptional: boolean
  createdAt: Date
}) {
  return {
    ...line,
    perUnitQuantity: dec(line.perUnitQuantity as never),
    scrapPercent: dec(line.scrapPercent as never),
    requiredQuantity: dec(line.requiredQuantity as never),
    createdAt: line.createdAt.toISOString(),
  }
}

async function loadOrderBomContext(tenantId: string, orderId: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId, tenantId, deletedAt: null },
    include: {
      bomSnapshot: true,
      manufacturingProfile: { select: { productionWarehouseId: true } },
    },
  })
  if (!order) throw new NotFoundError('Work order not found')
  if (order.status === 'DRAFT') {
    throw new InvalidStateError('Release the work order before editing the BOM snapshot')
  }
  if (!order.bomSnapshot) {
    throw new ValidationError('Work order has no BOM snapshot')
  }
  if (['COMPLETED', 'CLOSED', 'CANCELLED'].includes(order.status)) {
    throw new InvalidStateError(`Cannot edit BOM on a ${order.status} work order`)
  }
  return order
}

function requiredFromPerUnit(
  perUnit: Prisma.Decimal,
  scrapPercent: Prisma.Decimal,
  plannedQty: Prisma.Decimal,
) {
  const scrapFactor = toDecimal(1).plus(scrapPercent.dividedBy(100))
  return perUnit.times(plannedQty).times(scrapFactor)
}

function perUnitFromRequired(
  required: Prisma.Decimal,
  scrapPercent: Prisma.Decimal,
  plannedQty: Prisma.Decimal,
) {
  if (plannedQty.lessThanOrEqualTo(0)) return required
  const scrapFactor = toDecimal(1).plus(scrapPercent.dividedBy(100))
  if (scrapFactor.lessThanOrEqualTo(0)) return required.dividedBy(plannedQty)
  return required.dividedBy(plannedQty.times(scrapFactor))
}

async function syncLinkedMaterial(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  bomLineId: string,
  data: {
    itemId: string
    uomId: string
    requiredQty: Prisma.Decimal
    warehouseId: string | null
    userId: string
  },
) {
  const existing = await tx.productionOrderMaterial.findFirst({
    where: { tenantId, productionOrderId: orderId, bomLineId },
  })
  if (!existing) return

  if (
    (toDecimal(existing.reservedQty).greaterThan(0) || toDecimal(existing.issuedQty).greaterThan(0)) &&
    (existing.itemId !== data.itemId || existing.uomId !== data.uomId)
  ) {
    throw new InvalidStateError(
      'Cannot change item/UOM on a BOM line that already has material reservation or issue — clear materials activity first',
    )
  }

  const netIssued = toDecimal(existing.issuedQty).minus(toDecimal(existing.returnedQty))
  if (data.requiredQty.lessThan(netIssued)) {
    throw new ValidationError(`Required qty cannot be less than net issued (${dec(netIssued)})`)
  }

  await tx.productionOrderMaterial.update({
    where: { id: existing.id },
    data: {
      itemId: data.itemId,
      uomId: data.uomId,
      requiredQty: data.requiredQty,
      updatedBy: data.userId,
    },
  })
}

export async function addWorkOrderBomLine(
  req: Request,
  tenantId: string,
  orderId: string,
  input: AddWorkOrderBomLineInput,
) {
  const userId = req.context?.userId ?? ''
  const order = await loadOrderBomContext(tenantId, orderId)
  await assertItem(tenantId, input.itemId)
  await assertUom(tenantId, input.uomId)

  let parentLevel = 0
  if (input.parentLineId) {
    const parent = await prisma.productionOrderBomLine.findFirst({
      where: { id: input.parentLineId, tenantId, bomSnapshotId: order.bomSnapshot!.id },
    })
    if (!parent) throw new ValidationError('Parent BOM line not found on this work order')
    parentLevel = parent.level
  }

  const planned = toDecimal(order.plannedQuantity)
  const perUnit = toDecimal(input.perUnitQuantity)
  const scrap = toDecimal(input.scrapPercent ?? 0)
  const required = requiredFromPerUnit(perUnit, scrap, planned)

  const line = await prisma.$transaction(async (tx) => {
    const maxSeq = await tx.productionOrderBomLine.aggregate({
      where: {
        tenantId,
        bomSnapshotId: order.bomSnapshot!.id,
        parentLineId: input.parentLineId ?? null,
      },
      _max: { sequence: true },
    })
    const sequence = (maxSeq._max.sequence ?? 0) + 10

    const created = await tx.productionOrderBomLine.create({
      data: {
        tenantId,
        bomSnapshotId: order.bomSnapshot!.id,
        sourceBomLineId: null,
        parentLineId: input.parentLineId ?? null,
        sequence,
        level: parentLevel + 1,
        itemId: input.itemId,
        descriptionOverride: input.descriptionOverride ?? null,
        perUnitQuantity: perUnit,
        uomId: input.uomId,
        scrapPercent: scrap,
        requiredQuantity: required,
        makeOrBuy: input.makeOrBuy,
        lineType: input.lineType,
        isOptional: input.isOptional,
      },
    })

    if (input.syncMaterial !== false) {
      const warehouseId = order.manufacturingProfile.productionWarehouseId
      await tx.productionOrderMaterial.create({
        data: {
          tenantId,
          productionOrderId: orderId,
          bomLineId: created.id,
          itemId: input.itemId,
          uomId: input.uomId,
          warehouseId: warehouseId ?? null,
          requiredQty: required,
          status: 'OPEN',
          createdBy: userId,
          updatedBy: userId,
        },
      })
      await tx.productionOrder.update({
        where: { id: orderId, tenantId },
        data: {
          materialControlStatus: warehouseId ? 'ACTIVE' : 'PENDING_INVENTORY',
          updatedBy: userId,
        },
      })
    }

    return created
  })

  return mapBomLine(line)
}

export async function updateWorkOrderBomLine(
  req: Request,
  tenantId: string,
  orderId: string,
  lineId: string,
  input: UpdateWorkOrderBomLineInput,
) {
  const userId = req.context?.userId ?? ''
  const order = await loadOrderBomContext(tenantId, orderId)

  const existing = await prisma.productionOrderBomLine.findFirst({
    where: { id: lineId, tenantId, bomSnapshotId: order.bomSnapshot!.id },
  })
  if (!existing) throw new NotFoundError('BOM line not found on this work order')

  if (input.itemId) await assertItem(tenantId, input.itemId)
  if (input.uomId) await assertUom(tenantId, input.uomId)

  if (input.parentLineId) {
    if (input.parentLineId === lineId) throw new ValidationError('A BOM line cannot be its own parent')
    const parent = await prisma.productionOrderBomLine.findFirst({
      where: { id: input.parentLineId, tenantId, bomSnapshotId: order.bomSnapshot!.id },
    })
    if (!parent) throw new ValidationError('Parent BOM line not found on this work order')
  }

  const planned = toDecimal(order.plannedQuantity)
  const scrap = input.scrapPercent !== undefined ? toDecimal(input.scrapPercent) : toDecimal(existing.scrapPercent)

  let perUnit = toDecimal(existing.perUnitQuantity)
  let required = toDecimal(existing.requiredQuantity)

  if (input.requiredQuantity !== undefined) {
    required = toDecimal(input.requiredQuantity)
    perUnit = perUnitFromRequired(required, scrap, planned)
  } else if (input.perUnitQuantity !== undefined || input.scrapPercent !== undefined) {
    if (input.perUnitQuantity !== undefined) perUnit = toDecimal(input.perUnitQuantity)
    required = requiredFromPerUnit(perUnit, scrap, planned)
  }

  let level = existing.level
  if (input.parentLineId !== undefined) {
    if (input.parentLineId === null) level = 1
    else {
      const parent = await prisma.productionOrderBomLine.findFirst({
        where: { id: input.parentLineId, tenantId, bomSnapshotId: order.bomSnapshot!.id },
        select: { level: true },
      })
      level = (parent?.level ?? 0) + 1
    }
  }

  const nextItemId = input.itemId ?? existing.itemId
  const nextUomId = input.uomId ?? existing.uomId

  const line = await prisma.$transaction(async (tx) => {
    const updated = await tx.productionOrderBomLine.update({
      where: { id: lineId },
      data: {
        itemId: nextItemId,
        uomId: nextUomId,
        perUnitQuantity: perUnit,
        scrapPercent: scrap,
        requiredQuantity: required,
        makeOrBuy: input.makeOrBuy ?? undefined,
        lineType: input.lineType ?? undefined,
        isOptional: input.isOptional ?? undefined,
        descriptionOverride:
          input.descriptionOverride === undefined ? undefined : input.descriptionOverride,
        parentLineId: input.parentLineId === undefined ? undefined : input.parentLineId,
        level,
      },
    })

    await syncLinkedMaterial(tx, tenantId, orderId, lineId, {
      itemId: nextItemId,
      uomId: nextUomId,
      requiredQty: required,
      warehouseId: order.manufacturingProfile.productionWarehouseId,
      userId,
    })

    await tx.productionOrder.update({
      where: { id: orderId, tenantId },
      data: { updatedBy: userId },
    })

    return updated
  })

  return mapBomLine(line)
}

export async function removeWorkOrderBomLine(req: Request, tenantId: string, orderId: string, lineId: string) {
  const userId = req.context?.userId ?? ''
  const order = await loadOrderBomContext(tenantId, orderId)

  const existing = await prisma.productionOrderBomLine.findFirst({
    where: { id: lineId, tenantId, bomSnapshotId: order.bomSnapshot!.id },
    include: { materials: true, childLines: { select: { id: true } } },
  })
  if (!existing) throw new NotFoundError('BOM line not found on this work order')
  if (existing.childLines.length > 0) {
    throw new InvalidStateError('Remove or re-parent child lines before deleting this BOM line')
  }

  for (const material of existing.materials) {
    if (toDecimal(material.reservedQty).greaterThan(0) || toDecimal(material.issuedQty).greaterThan(0)) {
      throw new InvalidStateError('Cannot remove a BOM line with material reservation or issue history')
    }
  }

  await prisma.$transaction(async (tx) => {
    if (existing.materials.length > 0) {
      await tx.productionOrderMaterial.deleteMany({
        where: { tenantId, productionOrderId: orderId, bomLineId: lineId },
      })
    }
    await tx.productionOrderBomLine.delete({ where: { id: lineId } })
    await tx.productionOrder.update({
      where: { id: orderId, tenantId },
      data: { updatedBy: userId },
    })
  })

  return { id: lineId }
}
