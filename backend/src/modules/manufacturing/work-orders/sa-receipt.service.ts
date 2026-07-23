import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { postSaReceipt as postInventorySaReceipt } from '../../inventory/movements/movement.service.js'
import { tryRecordManufacturingAccountingEvent } from '../accounting/manufacturing-accounting-event.service.js'
import { logProductionActivity } from '../shared/activity.service.js'
import { isPositive, toDecimal } from '../shared/quantity.service.js'
import { resolveWarehouseMapping } from '../warehouse-mappings/warehouse-mapping.service.js'
import type { PostSaReceiptInput } from './sa-receipt.schemas.js'

function userOf(req: Request) {
  return req.context?.userId ?? ''
}

async function resolveSaWarehouse(
  tenantId: string,
  plantCode: string | null,
  profileId: string,
  profileWipWarehouseId: string | null,
  overrideWarehouseId?: string,
) {
  if (overrideWarehouseId) {
    const wh = await prisma.masterWarehouse.findFirst({
      where: { id: overrideWarehouseId, tenantId, deletedAt: null },
      select: { id: true, status: true, code: true, name: true },
    })
    if (!wh) throw new NotFoundError('Warehouse not found')
    if (wh.status !== 'ACTIVE') throw new ValidationError('Warehouse is not active')
    return wh
  }

  const mapping = await resolveWarehouseMapping(tenantId, plantCode ?? undefined, profileId)
  const warehouseId = mapping?.wipWarehouseId ?? profileWipWarehouseId
  if (!warehouseId) {
    throw new ValidationError(
      'WIP / semi-finished warehouse is not configured (warehouse mapping or manufacturing profile)',
    )
  }
  const wh = await prisma.masterWarehouse.findFirst({
    where: { id: warehouseId, tenantId, deletedAt: null },
    select: { id: true, code: true, name: true, status: true },
  })
  if (!wh || wh.status !== 'ACTIVE') {
    throw new ValidationError('Configured WIP warehouse is missing or inactive')
  }
  return wh
}

/**
 * Post semi-finished (SA) receipt for a child / stocked-SA work order into WIP warehouse.
 * Mirrors demo FE `postSaReceipt` — inventory `SA_RECEIPT` + activity + optional accounting event.
 */
export async function postSemiFinishedReceipt(
  req: Request,
  tenantId: string,
  workOrderId: string,
  input: PostSaReceiptInput,
) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: workOrderId, tenantId, deletedAt: null },
    include: {
      productItem: { select: { id: true, code: true, name: true, isStockable: true } },
      manufacturingProfile: true,
      parentProductionOrder: { select: { id: true, orderNumber: true } },
      uom: { select: { id: true, code: true } },
    },
  })
  if (!order) throw new NotFoundError('Work order not found')

  if (!order.parentProductionOrderId && !input.allowWithoutParent) {
    throw new ValidationError(
      'SA receipt is intended for child / sub-assembly work orders — pass allowWithoutParent=true to override',
    )
  }

  if (!['COMPLETED', 'IN_PROGRESS', 'READY'].includes(order.status)) {
    throw new ValidationError(
      `Work order must be READY, IN_PROGRESS, or COMPLETED before SA receipt (current: ${order.status})`,
    )
  }

  if (!order.productItem.isStockable) {
    throw new ValidationError(`${order.productItem.code} is not stockable — enable stockable on the item master`)
  }

  const qty = toDecimal(input.quantity ?? order.plannedQuantity)
  if (!isPositive(qty)) throw new ValidationError('Receipt quantity must be positive')

  const warehouse = await resolveSaWarehouse(
    tenantId,
    order.plantCode,
    order.manufacturingProfileId,
    order.manufacturingProfile.wipWarehouseId,
    input.warehouseId,
  )

  const movement = await postInventorySaReceipt(req, tenantId, {
    itemId: order.productItemId,
    warehouseId: warehouse.id,
    quantity: qty.toNumber(),
    workOrderId: order.id,
    referenceNo: order.orderNumber,
    remarks:
      input.remarks ??
      `SA receipt — ${order.productItem.code} from ${order.orderNumber}${
        order.parentProductionOrder ? ` → parent ${order.parentProductionOrder.orderNumber}` : ''
      }`,
    idempotencyKey: input.idempotencyKey,
    rate: input.rate,
    movementDate: input.receiptDate ? new Date(input.receiptDate) : undefined,
  })

  await logProductionActivity({
    tenantId,
    productionOrderId: order.id,
    activityType: 'CREATED',
    userId: userOf(req),
    message: `Semi-finished receipt posted into ${warehouse.code} · ${qty.toString()} × ${order.productItem.code}`,
    newValue: { movementId: movement.id, warehouseId: warehouse.id, quantity: qty.toString() },
  })

  await tryRecordManufacturingAccountingEvent(req, tenantId, {
    eventType: 'SEMI_FINISHED_RECEIVED',
    idempotencyKey: `PROD_SA_RCV:${movement.id}:V1`,
    sourceDocumentType: 'INVENTORY_STOCK_MOVEMENT',
    sourceDocumentId: movement.id,
    productionOrderId: order.id,
    quantity: qty,
    amount: 0,
    narration: `SA receipt for WO ${order.orderNumber} into ${warehouse.code}`,
    payloadJson: {
      warehouseId: warehouse.id,
      itemId: order.productItemId,
      parentProductionOrderId: order.parentProductionOrderId,
    },
  }).catch(() => undefined)

  return {
    workOrderId: order.id,
    orderNumber: order.orderNumber,
    parentProductionOrderId: order.parentProductionOrderId,
    parentOrderNumber: order.parentProductionOrder?.orderNumber ?? null,
    itemId: order.productItemId,
    itemCode: order.productItem.code,
    warehouseId: warehouse.id,
    warehouseCode: warehouse.code,
    quantity: qty.toString(),
    movement,
  }
}

export async function listChildOrders(tenantId: string, parentOrderId: string) {
  const parent = await prisma.productionOrder.findFirst({
    where: { id: parentOrderId, tenantId, deletedAt: null },
    select: { id: true },
  })
  if (!parent) throw new NotFoundError('Work order not found')

  return prisma.productionOrder.findMany({
    where: { tenantId, parentProductionOrderId: parentOrderId, deletedAt: null },
    include: {
      productItem: { select: { id: true, code: true, name: true } },
    },
    orderBy: { orderNumber: 'asc' },
  })
}
