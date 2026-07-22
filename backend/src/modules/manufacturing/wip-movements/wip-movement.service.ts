import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { postStockMovement } from '../../inventory/shared/stock-posting.service.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { toDecimal, subDec, addDec } from '../shared/quantity.service.js'
import { OPEN_WO_STATUSES } from './wip-movement.enums.js'
import { WipMovementInvalidStateError, WipMovementValidationError } from './wip-movement.errors.js'
import * as repo from './wip-movement.repository.js'
import type { CreateWipMovementInput, ListWipMovementsQuery, TransferToWorkOrderInput } from './wip-movement.schemas.js'

function userOf(req: Request) {
  return req.context?.userId ?? ''
}

function canOverrideNegative(req: Request) {
  return (
    req.context?.permissions.includes('inventory.issues.override_negative_stock') === true ||
    req.context?.permissions.includes('tenant.manage') === true
  )
}

function mapMovement(row: repo.WipMovementRow) {
  return {
    id: row.id,
    movementNumber: row.movementNumber,
    movementType: row.movementType,
    status: row.status,
    productionOrderId: row.productionOrderId,
    productionOrderNumber: row.productionOrder.orderNumber,
    targetProductionOrderId: row.targetProductionOrderId,
    targetProductionOrderNumber: row.targetProductionOrder?.orderNumber ?? null,
    itemId: row.itemId,
    itemCode: row.item.code,
    itemName: row.item.name,
    quantity: row.quantity.toString(),
    uomId: row.uomId,
    fromWarehouseId: row.fromWarehouseId,
    fromWarehouseCode: row.fromWarehouse.code,
    fromWarehouseName: row.fromWarehouse.name,
    toWarehouseId: row.toWarehouseId,
    toWarehouseCode: row.toWarehouse.code,
    toWarehouseName: row.toWarehouse.name,
    stageId: row.stageId,
    operationId: row.operationId,
    materialLineId: row.materialLineId,
    reason: row.reason,
    remarks: row.remarks,
    physicalPosted: row.physicalPosted,
    outboundMovementId: row.outboundMovementId,
    inboundMovementId: row.inboundMovementId,
    postedAt: row.postedAt?.toISOString() ?? null,
    postedBy: row.postedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadOpenOrder(tenantId: string, orderId: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId, tenantId, deletedAt: null },
    include: {
      manufacturingProfile: {
        select: {
          wipTrackingMethod: true,
          wipWarehouseId: true,
          productionWarehouseId: true,
        },
      },
      productItem: { select: { id: true, code: true, name: true, isStockable: true, baseUomId: true } },
    },
  })
  if (!order) throw new NotFoundError('Work order not found')
  if (!OPEN_WO_STATUSES.includes(order.status as (typeof OPEN_WO_STATUSES)[number])) {
    throw new WipMovementInvalidStateError(
      `Cannot transfer on a work order in ${order.status} status (expected RELEASED, IN_PROGRESS, or ON_HOLD)`,
    )
  }
  return order
}

async function assertWarehouse(tenantId: string, warehouseId: string) {
  const wh = await prisma.masterWarehouse.findFirst({
    where: { id: warehouseId, tenantId, deletedAt: null },
    select: { id: true, status: true },
  })
  if (!wh) throw new NotFoundError('Warehouse not found')
  if (wh.status !== 'ACTIVE') throw new WipMovementValidationError('Warehouse is not active')
}

async function postPairedTransfer(
  req: Request,
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string
    itemId: string
    quantity: Prisma.Decimal
    fromWarehouseId: string
    toWarehouseId: string
    workOrderId: string
    sourceWorkOrderId?: string
    referenceNo: string
    remarks?: string
    idempotencyBase: string
  },
) {
  const allowNegative = canOverrideNegative(req)
  const outbound = await postStockMovement(
    {
      tenantId: args.tenantId,
      itemId: args.itemId,
      warehouseId: args.fromWarehouseId,
      movementType: 'ISSUE',
      referenceType: 'WIP_TRANSFER',
      quantity: args.quantity,
      workOrderId: args.workOrderId,
      sourceWorkOrderId: args.sourceWorkOrderId,
      referenceNo: args.referenceNo,
      remarks: args.remarks,
      idempotencyKey: `${args.idempotencyBase}:OUT`,
      createdBy: userOf(req),
      allowNegativeStock: allowNegative,
      consumeWoReservation: false,
    },
    tx,
  )
  const inbound = await postStockMovement(
    {
      tenantId: args.tenantId,
      itemId: args.itemId,
      warehouseId: args.toWarehouseId,
      movementType: 'INWARD',
      referenceType: 'WIP_TRANSFER',
      quantity: args.quantity,
      workOrderId: args.workOrderId,
      sourceWorkOrderId: args.sourceWorkOrderId,
      referenceNo: args.referenceNo,
      remarks: args.remarks,
      idempotencyKey: `${args.idempotencyBase}:IN`,
      createdBy: userOf(req),
    },
    tx,
  )
  return { outbound, inbound }
}

export async function list(tenantId: string, workOrderId: string, query: ListWipMovementsQuery) {
  const exists = await prisma.productionOrder.findFirst({
    where: { id: workOrderId, tenantId, deletedAt: null },
    select: { id: true },
  })
  if (!exists) throw new NotFoundError('Work order not found')
  const result = await repo.listMovements(tenantId, workOrderId, query)
  return { total: result.total, data: result.data.map(mapMovement) }
}

export async function get(tenantId: string, workOrderId: string, movementId: string) {
  return mapMovement(await repo.findMovement(tenantId, workOrderId, movementId))
}

export async function createAndPost(req: Request, tenantId: string, workOrderId: string, input: CreateWipMovementInput) {
  const userId = userOf(req)

  if (input.idempotencyKey) {
    const existing = await repo.findByIdempotencyKey(tenantId, input.idempotencyKey)
    if (existing && existing.productionOrderId === workOrderId) return mapMovement(existing)
  }

  const order = await loadOpenOrder(tenantId, workOrderId)
  await assertWarehouse(tenantId, input.fromWarehouseId)
  await assertWarehouse(tenantId, input.toWarehouseId)

  let itemId = input.itemId ?? order.productItemId
  let materialLine: {
    id: string
    itemId: string
    issuedQty: Prisma.Decimal
    returnedQty: Prisma.Decimal
    warehouseId: string | null
  } | null = null

  if (input.movementType === 'MATERIAL_RELOCATE' || input.materialLineId) {
    if (!input.materialLineId) throw new WipMovementValidationError('materialLineId is required')
    const line = await prisma.productionOrderMaterial.findFirst({
      where: { id: input.materialLineId, tenantId, productionOrderId: workOrderId },
    })
    if (!line) throw new NotFoundError('Material line not found on this work order')
    materialLine = line
    itemId = line.itemId
    const netIssued = subDec(line.issuedQty, line.returnedQty)
    if (toDecimal(input.quantity).greaterThan(netIssued)) {
      throw new WipMovementValidationError(
        `Cannot relocate more than net issued quantity (${netIssued.toString()})`,
      )
    }
  }

  if (input.movementType === 'WO_TO_WO') {
    if (!input.targetProductionOrderId) {
      throw new WipMovementValidationError('targetProductionOrderId is required')
    }
    if (input.targetProductionOrderId === workOrderId) {
      throw new WipMovementValidationError('Cannot transfer a work order to itself')
    }
    await loadOpenOrder(tenantId, input.targetProductionOrderId)
  }

  const item = await prisma.masterItem.findFirst({
    where: { id: itemId, tenantId, deletedAt: null },
    select: { id: true, isStockable: true, baseUomId: true, code: true, name: true },
  })
  if (!item) throw new NotFoundError('Item not found')

  const tracking = order.manufacturingProfile.wipTrackingMethod
  const needsPhysical =
    input.movementType === 'MATERIAL_RELOCATE' ||
    input.movementType === 'WO_TO_WO' ||
    tracking === 'STOCKED_SEMI_FINISHED' ||
    tracking === 'BOTH'

  if (needsPhysical && !item.isStockable) {
    throw new WipMovementValidationError('Item is not stockable; cannot post a physical transfer')
  }

  // LOGICAL_WIP location moves: activity-only (no inventory post)
  const physicalRequired =
    needsPhysical &&
    !(input.movementType === 'LOCATION_WIP' && tracking === 'LOGICAL_WIP')

  if (physicalRequired && input.fromWarehouseId === input.toWarehouseId && input.movementType !== 'WO_TO_WO') {
    throw new WipMovementValidationError('Source and destination warehouses must differ')
  }

  const created = await prisma.$transaction(async (tx) => {
    const movementNumber = await nextCode(tenantId, 'PRODUCTION_WIP_MOVEMENT', tx)
    let outboundMovementId: string | null = null
    let inboundMovementId: string | null = null
    let physicalPosted = false

    const attributionWoId =
      input.movementType === 'WO_TO_WO' && input.targetProductionOrderId
        ? input.targetProductionOrderId
        : workOrderId

    if (physicalRequired) {
      const paired = await postPairedTransfer(req, tx, {
        tenantId,
        itemId,
        quantity: toDecimal(input.quantity),
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        workOrderId: attributionWoId,
        sourceWorkOrderId: input.movementType === 'WO_TO_WO' ? workOrderId : undefined,
        referenceNo: movementNumber,
        remarks: input.remarks ?? input.reason,
        idempotencyBase: input.idempotencyKey
          ? `wip:${input.idempotencyKey}`
          : `wip:${tenantId}:${movementNumber}`,
      })
      outboundMovementId = paired.outbound.id
      inboundMovementId = paired.inbound.id
      physicalPosted = true
    }

    if (input.movementType === 'MATERIAL_RELOCATE' && materialLine) {
      await tx.productionOrderMaterial.update({
        where: { id: materialLine.id },
        data: { warehouseId: input.toWarehouseId, updatedBy: userId },
      })
    }

    if (input.movementType === 'WO_TO_WO' && materialLine && input.targetProductionOrderId) {
      const qty = toDecimal(input.quantity)
      const newReturned = addDec(materialLine.returnedQty, qty)
      await tx.productionOrderMaterial.update({
        where: { id: materialLine.id },
        data: { returnedQty: newReturned, updatedBy: userId },
      })

      const targetLine = await tx.productionOrderMaterial.findFirst({
        where: {
          tenantId,
          productionOrderId: input.targetProductionOrderId,
          itemId: materialLine.itemId,
        },
      })
      if (targetLine) {
        await tx.productionOrderMaterial.update({
          where: { id: targetLine.id },
          data: {
            issuedQty: addDec(targetLine.issuedQty, qty),
            warehouseId: input.toWarehouseId,
            updatedBy: userId,
          },
        })
      }
    }

    const row = await tx.productionWipMovement.create({
      data: {
        tenantId,
        movementNumber,
        movementType: input.movementType,
        status: 'POSTED',
        productionOrderId: workOrderId,
        targetProductionOrderId: input.targetProductionOrderId ?? null,
        itemId,
        quantity: toDecimal(input.quantity),
        uomId: item.baseUomId,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        stageId: input.stageId ?? null,
        operationId: input.operationId ?? null,
        materialLineId: materialLine?.id ?? null,
        reason: input.reason,
        remarks: input.remarks ?? null,
        physicalPosted,
        outboundMovementId,
        inboundMovementId,
        idempotencyKey: input.idempotencyKey ?? null,
        postedBy: userId,
        postedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
      include: repo.wipMovementInclude,
    })

    const activityType =
      input.movementType === 'MATERIAL_RELOCATE'
        ? 'MATERIAL_TRANSFERRED'
        : input.movementType === 'WO_TO_WO'
          ? 'WO_TO_WO_TRANSFERRED'
          : 'WIP_MOVED'

    await logProductionActivity(
      {
        tenantId,
        productionOrderId: workOrderId,
        activityType,
        userId,
        message: `${input.movementType} ${row.movementNumber}: ${input.quantity} of ${item.code} (${row.fromWarehouse.code} → ${row.toWarehouse.code})`,
        reason: input.reason,
        sourceTransactionId: row.id,
        newValue: {
          movementType: input.movementType,
          quantity: toDecimal(input.quantity).toString(),
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          targetProductionOrderId: input.targetProductionOrderId ?? null,
          physicalPosted,
        },
      },
      tx,
    )

    if (input.movementType === 'WO_TO_WO' && input.targetProductionOrderId) {
      await logProductionActivity(
        {
          tenantId,
          productionOrderId: input.targetProductionOrderId,
          activityType: 'WO_TO_WO_TRANSFERRED',
          userId,
          message: `Received transfer ${row.movementNumber} from ${order.orderNumber}: ${input.quantity} of ${item.code}`,
          reason: input.reason,
          sourceTransactionId: row.id,
        },
        tx,
      )
    }

    return row
  })

  return mapMovement(created)
}

export async function transferTo(
  req: Request,
  tenantId: string,
  workOrderId: string,
  targetId: string,
  input: TransferToWorkOrderInput,
) {
  return createAndPost(req, tenantId, workOrderId, {
    movementType: 'WO_TO_WO',
    targetProductionOrderId: targetId,
    itemId: input.itemId,
    quantity: input.quantity,
    fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId,
    materialLineId: input.materialLineId,
    reason: input.reason,
    remarks: input.remarks,
    idempotencyKey: input.idempotencyKey,
  })
}
