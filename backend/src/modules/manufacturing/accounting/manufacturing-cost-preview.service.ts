import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { dec } from '../shared/manufacturing.mappers.js'
import { toDecimal } from '../shared/quantity.service.js'
import { getManufacturingAccountingGateStatus } from './manufacturing-accounting-gate.service.js'
import * as eventService from './manufacturing-accounting-event.service.js'

/**
 * Read-only WO cost preview — does not require MANUFACTURING_ACCOUNTING flag.
 * Uses issued material qty × movement rate/value when present (often 0 until valuation matures).
 */
export async function getWorkOrderCostPreview(tenantId: string, productionOrderId: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: productionOrderId, tenantId, deletedAt: null },
    include: {
      productItem: { select: { id: true, code: true, name: true } },
      materials: true,
    },
  })
  if (!order) throw new NotFoundError('Work order not found')

  const movements = await prisma.inventoryStockMovement.findMany({
    where: {
      tenantId,
      workOrderId: productionOrderId,
      referenceType: { in: ['ISSUE_TO_WO', 'RETURN_FROM_WO', 'FG_RECEIPT'] },
    },
    orderBy: { createdAt: 'asc' },
  })

  let materialIssuedValue = new Prisma.Decimal(0)
  let materialReturnedValue = new Prisma.Decimal(0)
  let fgReceiptValue = new Prisma.Decimal(0)

  for (const m of movements) {
    const value = toDecimal(m.value)
    if (m.referenceType === 'ISSUE_TO_WO') materialIssuedValue = materialIssuedValue.plus(value)
    else if (m.referenceType === 'RETURN_FROM_WO') materialReturnedValue = materialReturnedValue.plus(value)
    else if (m.referenceType === 'FG_RECEIPT') fgReceiptValue = fgReceiptValue.plus(value)
  }

  const netMaterialValue = materialIssuedValue.minus(materialReturnedValue)
  const events = await eventService.listAccountingEvents(tenantId, {
    productionOrderId,
    limit: 100,
  })
  const gate = await getManufacturingAccountingGateStatus(tenantId)

  return {
    productionOrderId: order.id,
    orderNumber: order.orderNumber,
    productItem: order.productItem,
    plannedQuantity: dec(order.plannedQuantity),
    completedGoodQuantity: dec(order.completedGoodQuantity),
    materials: {
      lineCount: order.materials.length,
      issuedValue: dec(materialIssuedValue),
      returnedValue: dec(materialReturnedValue),
      netValue: dec(netMaterialValue),
    },
    finishedGoods: {
      receiptValue: dec(fgReceiptValue),
    },
    estimatedTotalCost: dec(netMaterialValue),
    accountingGate: gate,
    events: events.data.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      status: e.status,
      quantity: dec(e.quantity),
      amount: dec(e.amount),
      voucherId: e.voucherId,
      postingEventId: e.postingEventId,
      postedAt: e.postedAt?.toISOString() ?? null,
      idempotencyKey: e.idempotencyKey,
      createdAt: e.createdAt.toISOString(),
    })),
    notes: [
      'Cost preview uses inventory movement value/rate (often zero until valuation rules mature).',
      'GL vouchers post only when FinanceFeatureKey.MANUFACTURING_ACCOUNTING is enabled.',
    ],
  }
}
