import { prisma } from '../../../config/database.js'
import { getStockPosition } from '../../inventory/balances/balance.service.js'
import { isPositive, subDec, toDecimal } from '../shared/quantity.service.js'
import { dec } from '../shared/manufacturing.mappers.js'

const OPEN_WO = ['READY', 'IN_PROGRESS', 'ON_HOLD'] as const

/**
 * Thin KPI summary for store workbench (Phase 7A5 UI).
 * Counts are approximate operational queues — not transactional locks.
 */
export async function getStoreWorkbenchSummary(tenantId: string) {
  const openOrders = await prisma.productionOrder.findMany({
    where: { tenantId, deletedAt: null, status: { in: [...OPEN_WO] } },
    select: {
      id: true,
      completedGoodQuantity: true,
      materials: {
        select: {
          requiredQty: true,
          reservedQty: true,
          issuedQty: true,
          returnedQty: true,
          reservationId: true,
          reservation: { select: { status: true } },
        },
      },
    },
  })

  let waitingReservation = 0
  let waitingIssue = 0
  let waitingReturns = 0

  for (const order of openOrders) {
    for (const m of order.materials) {
      const required = toDecimal(m.requiredQty)
      const reserved = toDecimal(m.reservedQty)
      const issued = toDecimal(m.issuedQty)
      const returned = toDecimal(m.returnedQty)
      const netIssued = issued.minus(returned)
      const remainingReserve = required.minus(reserved)
      const remainingIssue = required.minus(netIssued)
      const held = netIssued

      if (remainingReserve.greaterThan(0)) waitingReservation += 1
      if (remainingIssue.greaterThan(0)) waitingIssue += 1
      if (isPositive(held)) waitingReturns += 1
    }
  }

  const waitingWip = await prisma.productionWipMovement.count({
    where: {
      tenantId,
      deletedAt: null,
      status: 'POSTED',
      movementType: 'LOCATION_WIP',
      productionOrder: { status: { in: [...OPEN_WO] }, deletedAt: null },
    },
  })

  const fgCandidates = await prisma.productionOrder.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['IN_PROGRESS', 'COMPLETED', 'ON_HOLD'] },
      completedGoodQuantity: { gt: 0 },
    },
    select: {
      id: true,
      completedGoodQuantity: true,
      finishedGoodsReceipts: {
        where: {
          deletedAt: null,
          status: { in: ['POSTED', 'PARTIALLY_REVERSED'] },
        },
        select: { acceptedQuantity: true, reversedQuantity: true },
      },
    },
  })

  let waitingFg = 0
  for (const o of fgCandidates) {
    let received = toDecimal(0)
    for (const r of o.finishedGoodsReceipts) {
      received = received.plus(
        toDecimal(r.acceptedQuantity).minus(toDecimal(r.reversedQuantity ?? 0)),
      )
    }
    if (isPositive(subDec(o.completedGoodQuantity, received))) waitingFg += 1
  }

  const activeReservationCount = await prisma.inventoryStockReservation.count({
    where: { tenantId, demandType: 'WO', status: 'ACTIVE' },
  })

  return {
    asOf: new Date().toISOString(),
    openWorkOrders: openOrders.length,
    kpis: {
      waitingReservation,
      waitingIssue,
      waitingReturns,
      waitingWip,
      waitingFg,
      activeWoReservations: activeReservationCount,
    },
  }
}

type QueueOpts = { limit?: number }

function limitOf(opts?: QueueOpts) {
  return Math.min(Math.max(opts?.limit ?? 50, 1), 200)
}

/** Queue rows for Store Workbench tabs (read-only; posting uses WO/Inventory APIs). */
export async function listStoreWorkbenchReservations(tenantId: string, opts?: QueueOpts) {
  const limit = limitOf(opts)
  const materials = await prisma.productionOrderMaterial.findMany({
    where: {
      tenantId,
      productionOrder: { status: { in: [...OPEN_WO] }, deletedAt: null },
    },
    take: limit * 3,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      requiredQty: true,
      reservedQty: true,
      itemId: true,
      item: { select: { code: true, name: true } },
      productionOrder: {
        select: {
          id: true,
          orderNumber: true,
          priority: true,
          requiredCompletionDate: true,
          productItem: { select: { code: true, name: true } },
        },
      },
    },
  })

  const rows = []
  for (const m of materials) {
    const required = toDecimal(m.requiredQty)
    const reserved = toDecimal(m.reservedQty)
    const shortage = subDec(required, reserved)
    if (!isPositive(shortage)) continue
    rows.push({
      workOrderId: m.productionOrder.id,
      orderNumber: m.productionOrder.orderNumber,
      product: m.productionOrder.productItem,
      materialId: m.id,
      itemId: m.itemId,
      item: m.item,
      requiredQty: dec(required),
      reservedQty: dec(reserved),
      shortageQty: dec(shortage),
      priority: m.productionOrder.priority,
      requiredDate: m.productionOrder.requiredCompletionDate,
      status: reserved.greaterThan(0) ? 'PARTIALLY_RESERVED' : 'NOT_RESERVED',
    })
    if (rows.length >= limit) break
  }
  return { asOf: new Date().toISOString(), rows }
}

export async function listStoreWorkbenchIssues(tenantId: string, opts?: QueueOpts) {
  const limit = limitOf(opts)
  const materials = await prisma.productionOrderMaterial.findMany({
    where: {
      tenantId,
      productionOrder: { status: { in: [...OPEN_WO] }, deletedAt: null },
    },
    take: limit * 3,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      requiredQty: true,
      reservedQty: true,
      issuedQty: true,
      returnedQty: true,
      shortageQty: true,
      warehouseId: true,
      itemId: true,
      purchaseRequisitionId: true,
      item: { select: { code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      purchaseRequisition: { select: { id: true, requisitionNumber: true, status: true } },
      productionOrder: {
        select: {
          id: true,
          orderNumber: true,
          productItem: { select: { code: true, name: true } },
        },
      },
    },
  })

  const rows = []
  for (const m of materials) {
    const required = toDecimal(m.requiredQty)
    const netIssued = toDecimal(m.issuedQty).minus(toDecimal(m.returnedQty))
    const balance = subDec(required, netIssued)
    if (!isPositive(balance)) continue

    let freeQty: string | null = null
    let hasShortage = toDecimal(m.shortageQty).greaterThan(0)
    if (m.warehouseId) {
      try {
        const position = await getStockPosition(tenantId, m.itemId, m.warehouseId)
        freeQty = position.freeQty
        const free = toDecimal(position.freeQty)
        if (balance.greaterThan(free)) hasShortage = true
      } catch {
        freeQty = '0'
        hasShortage = true
      }
    } else {
      freeQty = null
      hasShortage = true
    }

    const freeDec = freeQty != null ? toDecimal(freeQty) : null
    const issuable =
      freeDec == null ? balance : balance.lessThanOrEqualTo(freeDec) ? balance : freeDec.lessThan(0) ? toDecimal(0) : freeDec
    const shortQty = freeDec == null ? balance : subDec(balance, freeDec).lessThan(0) ? toDecimal(0) : subDec(balance, freeDec)

    rows.push({
      workOrderId: m.productionOrder.id,
      orderNumber: m.productionOrder.orderNumber,
      product: m.productionOrder.productItem,
      materialId: m.id,
      itemId: m.itemId,
      item: m.item,
      warehouseId: m.warehouseId,
      warehouse: m.warehouse,
      requiredQty: dec(required),
      reservedQty: dec(m.reservedQty),
      issuedQty: dec(m.issuedQty),
      balanceToIssue: dec(balance),
      freeQty: freeQty == null ? null : dec(freeDec!),
      issuableQty: dec(issuable.lessThan(0) ? toDecimal(0) : issuable),
      shortageQty: dec(shortQty),
      hasShortage,
      purchaseRequisitionId: m.purchaseRequisitionId,
      purchaseRequisition: m.purchaseRequisition,
      status: netIssued.greaterThan(0) ? 'PARTIALLY_ISSUED' : 'NOT_ISSUED',
    })
    if (rows.length >= limit) break
  }
  return { asOf: new Date().toISOString(), rows }
}

export async function listStoreWorkbenchReturns(tenantId: string, opts?: QueueOpts) {
  const limit = limitOf(opts)
  const materials = await prisma.productionOrderMaterial.findMany({
    where: {
      tenantId,
      productionOrder: { status: { in: [...OPEN_WO, 'COMPLETED'] }, deletedAt: null },
      issuedQty: { gt: 0 },
    },
    take: limit * 3,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      issuedQty: true,
      returnedQty: true,
      itemId: true,
      item: { select: { code: true, name: true } },
      productionOrder: {
        select: { id: true, orderNumber: true, status: true },
      },
    },
  })

  const rows = []
  for (const m of materials) {
    const held = toDecimal(m.issuedQty).minus(toDecimal(m.returnedQty))
    if (!isPositive(held)) continue
    rows.push({
      workOrderId: m.productionOrder.id,
      orderNumber: m.productionOrder.orderNumber,
      orderStatus: m.productionOrder.status,
      materialId: m.id,
      itemId: m.itemId,
      item: m.item,
      issuedQty: dec(m.issuedQty),
      returnedQty: dec(m.returnedQty),
      eligibleReturnQty: dec(held),
      status: 'HELD_AT_WO',
    })
    if (rows.length >= limit) break
  }
  return { asOf: new Date().toISOString(), rows }
}

export async function listStoreWorkbenchWip(tenantId: string, opts?: QueueOpts) {
  const limit = limitOf(opts)
  const movements = await prisma.productionWipMovement.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: 'POSTED',
      productionOrder: { status: { in: [...OPEN_WO] }, deletedAt: null },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      movementNumber: true,
      movementType: true,
      quantity: true,
      stageId: true,
      physicalPosted: true,
      outboundMovementId: true,
      inboundMovementId: true,
      productionOrder: {
        select: {
          id: true,
          orderNumber: true,
          productItem: { select: { code: true, name: true } },
          manufacturingProfile: { select: { wipTrackingMethod: true } },
        },
      },
    },
  })

  return {
    asOf: new Date().toISOString(),
    rows: movements.map((m) => ({
      workOrderId: m.productionOrder.id,
      orderNumber: m.productionOrder.orderNumber,
      product: m.productionOrder.productItem,
      wipMode:
        m.productionOrder.manufacturingProfile.wipTrackingMethod === 'STOCKED_SEMI_FINISHED'
          ? 'STOCKED_WIP'
          : 'LOGICAL_WIP',
      movementId: m.id,
      movementNumber: m.movementNumber,
      movementType: m.movementType,
      quantity: dec(m.quantity),
      stageId: m.stageId,
      physicalPosted: m.physicalPosted,
      hasInventoryMovement: Boolean(m.outboundMovementId || m.inboundMovementId),
    })),
  }
}

export async function listStoreWorkbenchFinishedGoods(tenantId: string, opts?: QueueOpts) {
  const limit = limitOf(opts)
  const orders = await prisma.productionOrder.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['IN_PROGRESS', 'COMPLETED', 'ON_HOLD'] },
      completedGoodQuantity: { gt: 0 },
    },
    take: limit * 2,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      plannedQuantity: true,
      completedGoodQuantity: true,
      productItem: { select: { code: true, name: true } },
      manufacturingProfile: {
        select: {
          finishedGoodsWarehouseId: true,
          batchTrackingRequired: true,
          serialTrackingRequired: true,
        },
      },
      finishedGoodsReceipts: {
        where: { deletedAt: null, status: { in: ['POSTED', 'PARTIALLY_REVERSED'] } },
        select: { acceptedQuantity: true, reversedQuantity: true },
      },
    },
  })

  const rows = []
  for (const o of orders) {
    let received = toDecimal(0)
    for (const r of o.finishedGoodsReceipts) {
      received = received.plus(
        toDecimal(r.acceptedQuantity).minus(toDecimal(r.reversedQuantity ?? 0)),
      )
    }
    const eligible = subDec(o.completedGoodQuantity, received)
    if (!isPositive(eligible)) continue
    rows.push({
      workOrderId: o.id,
      orderNumber: o.orderNumber,
      product: o.productItem,
      plannedQty: dec(o.plannedQuantity),
      completedGoodQty: dec(o.completedGoodQuantity),
      alreadyReceivedQty: dec(received),
      eligibleQty: dec(eligible),
      warehouseId: o.manufacturingProfile.finishedGoodsWarehouseId,
      batchTrackingRequired: o.manufacturingProfile.batchTrackingRequired,
      serialTrackingRequired: o.manufacturingProfile.serialTrackingRequired,
      status: received.greaterThan(0) ? 'PARTIALLY_RECEIVED' : 'READY_FOR_FG_RECEIPT',
    })
    if (rows.length >= limit) break
  }
  return { asOf: new Date().toISOString(), rows }
}

export async function listStoreWorkbenchReconciliation(tenantId: string, opts?: QueueOpts) {
  const limit = limitOf(opts)
  const orders = await prisma.productionOrder.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: [...OPEN_WO, 'COMPLETED'] },
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      productItem: { select: { code: true, name: true } },
      materials: {
        select: {
          requiredQty: true,
          reservedQty: true,
          issuedQty: true,
          returnedQty: true,
          reservation: { select: { status: true } },
        },
      },
    },
  })

  const rows = []
  for (const o of orders) {
    let openReservations = 0
    let heldLines = 0
    let underIssuedLines = 0
    for (const m of o.materials) {
      if (m.reservation?.status === 'ACTIVE') openReservations += 1
      const held = toDecimal(m.issuedQty).minus(toDecimal(m.returnedQty))
      if (isPositive(held)) heldLines += 1
      const netIssued = toDecimal(m.issuedQty).minus(toDecimal(m.returnedQty))
      if (toDecimal(m.requiredQty).greaterThan(netIssued)) underIssuedLines += 1
    }
    if (openReservations === 0 && heldLines === 0 && underIssuedLines === 0) continue
    rows.push({
      workOrderId: o.id,
      orderNumber: o.orderNumber,
      orderStatus: o.status,
      product: o.productItem,
      openReservations,
      heldLines,
      underIssuedLines,
      status: openReservations > 0 || underIssuedLines > 0 ? 'RECONCILIATION_REQUIRED' : 'HELD_MATERIAL',
    })
  }
  return { asOf: new Date().toISOString(), rows }
}
