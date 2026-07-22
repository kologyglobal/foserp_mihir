import { Prisma, type InventoryStockMovement } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { InventoryPostingService } from '../shared/stock-posting.service.js'
import { tryRecordInventoryAccountingEventsForMovements } from '../accounting/inventory-accounting-event.service.js'
import type { CreateStockCountInput, EnterCountsInput, ListStockCountsInput, StockCountPostingInput } from './stock-count.schemas.js'

const include = {
  warehouse: { select: { id: true, code: true, name: true } },
  lines: {
    include: { item: { select: { id: true, code: true, name: true } } },
    orderBy: { item: { code: 'asc' as const } },
  },
}

async function load(tenantId: string, id: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const document = await tx.inventoryStockCount.findFirst({ where: { tenantId, id }, include })
  if (!document) throw new NotFoundError('Stock count not found')
  return document
}

async function lock(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM inventory_stock_counts WHERE id = ${id} AND tenantId = ${tenantId} FOR UPDATE
  `
  if (!rows.length) throw new NotFoundError('Stock count not found')
  return load(tenantId, id, tx)
}

export function redactSystemQuantity<T extends Awaited<ReturnType<typeof load>>>(document: T, reveal: boolean) {
  if (reveal) return document
  return {
    ...document,
    lines: document.lines.map(({ systemQty: _systemQty, varianceQty: _varianceQty, ...line }) => line),
  }
}

export async function createStockCount(tenantId: string, actorId: string, input: CreateStockCountInput) {
  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { id: input.warehouseId, tenantId, deletedAt: null, status: 'ACTIVE' },
  })
  if (!warehouse) throw new ValidationError('Active warehouse not found')
  if (input.itemIds) {
    const count = await prisma.masterItem.count({
      where: { id: { in: input.itemIds }, tenantId, deletedAt: null, status: 'ACTIVE', isStockable: true, isBlocked: false },
    })
    if (count !== new Set(input.itemIds).size) throw new ValidationError('Invalid or duplicate stock count item')
  }
  return prisma.$transaction(async (tx) => {
    const countNumber = await nextCode(tenantId, 'INVENTORY_STOCK_COUNT', tx)
    const document = await tx.inventoryStockCount.create({
      data: {
        tenantId,
        countNumber,
        warehouseId: input.warehouseId,
        countDate: input.countDate ?? new Date(),
        remarks: input.remarks,
        createdBy: actorId,
        updatedBy: actorId,
        lines: input.itemIds ? {
          create: [...new Set(input.itemIds)].map((itemId) => ({ tenantId, itemId, systemQty: 0 })),
        } : undefined,
      },
    })
    return load(tenantId, document.id, tx)
  })
}

export async function listStockCounts(tenantId: string, input: ListStockCountsInput, reveal: boolean) {
  const where: Prisma.InventoryStockCountWhereInput = {
    tenantId,
    status: input.status,
    warehouseId: input.warehouseId,
    OR: input.search ? [{ countNumber: { contains: input.search } }, { remarks: { contains: input.search } }] : undefined,
  }
  const skip = (input.page - 1) * input.limit
  const [documents, total] = await Promise.all([
    prisma.inventoryStockCount.findMany({ where, include, skip, take: input.limit, orderBy: { createdAt: 'desc' } }),
    prisma.inventoryStockCount.count({ where }),
  ])
  return { items: documents.map((document) => redactSystemQuantity(document, reveal)), total, page: input.page, limit: input.limit }
}

export async function findStockCount(tenantId: string, id: string, reveal: boolean) {
  return redactSystemQuantity(await load(tenantId, id), reveal)
}

export async function snapshotStockCount(tenantId: string, id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const document = await lock(tx, tenantId, id)
    if (document.status !== 'DRAFT') throw new InvalidStateError('Only draft stock counts can be snapshotted')
    const targetItems = document.lines.length ? [] : await tx.masterItem.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE', isStockable: true, isBlocked: false },
      select: { id: true, standardRate: true },
      orderBy: { id: 'asc' },
    })
    const itemIds = document.lines.length ? document.lines.map((line) => line.itemId) : targetItems.map((item) => item.id)
    const balances = await tx.inventoryStockBalance.findMany({
      where: { tenantId, warehouseId: document.warehouseId, itemId: { in: itemIds } },
    })
    const byItem = new Map(balances.map((balance) => [balance.itemId, balance.onHandQty]))
    if (document.lines.length) {
      const items = await tx.masterItem.findMany({ where: { tenantId, id: { in: itemIds } }, select: { id: true, standardRate: true } })
      for (const item of items) {
        await tx.inventoryStockCountLine.update({
          where: { stockCountId_itemId: { stockCountId: id, itemId: item.id } },
          data: { systemQty: byItem.get(item.id) ?? 0, rate: item.standardRate },
        })
      }
    } else {
      await tx.inventoryStockCountLine.createMany({
        data: targetItems.map((item) => ({
          tenantId,
          stockCountId: id,
          itemId: item.id,
          systemQty: byItem.get(item.id) ?? 0,
          rate: item.standardRate,
        })),
      })
    }
    await tx.inventoryStockCount.update({
      where: { id },
      data: { status: 'SNAPSHOTTED', snapshotAt: new Date(), updatedBy: actorId },
    })
    return load(tenantId, id, tx)
  })
}

export async function enterCounts(tenantId: string, id: string, actorId: string, input: EnterCountsInput) {
  return prisma.$transaction(async (tx) => {
    const document = await lock(tx, tenantId, id)
    if (!['SNAPSHOTTED', 'COUNTING'].includes(document.status)) {
      throw new InvalidStateError('Counted quantities can only be entered after snapshot')
    }
    const requested = new Map(input.lines.map((line) => [line.lineId, line]))
    if (requested.size !== input.lines.length) throw new ValidationError('Duplicate stock count lines are not allowed')
    for (const line of document.lines) {
      const entered = requested.get(line.id)
      if (!entered) continue
      await tx.inventoryStockCountLine.update({
        where: { id: line.id },
        data: {
          countedQty: entered.countedQty,
          varianceQty: new Prisma.Decimal(entered.countedQty).minus(line.systemQty),
          remarks: entered.remarks,
        },
      })
    }
    if ([...requested.keys()].some((lineId) => !document.lines.some((line) => line.id === lineId))) {
      throw new NotFoundError('Stock count line not found')
    }
    await tx.inventoryStockCount.update({ where: { id }, data: { status: 'COUNTING', updatedBy: actorId } })
    return load(tenantId, id, tx)
  })
}

async function transition(tenantId: string, id: string, actorId: string, from: string[], data: Prisma.InventoryStockCountUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const document = await lock(tx, tenantId, id)
    if (!from.includes(document.status)) throw new InvalidStateError(`Stock count cannot transition from ${document.status}`)
    if (data.status === 'SUBMITTED' && document.lines.some((line) => line.countedQty === null)) {
      throw new ValidationError('Every line requires a counted quantity')
    }
    await tx.inventoryStockCount.update({ where: { id }, data: { ...data, updatedBy: actorId } })
    return load(tenantId, id, tx)
  })
}

export function submitStockCount(tenantId: string, id: string, actorId: string) {
  return transition(tenantId, id, actorId, ['COUNTING'], { status: 'SUBMITTED', submittedAt: new Date(), submittedBy: actorId })
}
export function approveStockCount(tenantId: string, id: string, actorId: string) {
  return transition(tenantId, id, actorId, ['SUBMITTED'], { status: 'APPROVED', approvedAt: new Date(), approvedBy: actorId })
}

export async function postStockCount(tenantId: string, id: string, actorId: string, input: StockCountPostingInput) {
  const movements: InventoryStockMovement[] = []
  const result = await prisma.$transaction(async (tx) => {
    const document = await lock(tx, tenantId, id)
    if (document.status === 'POSTED') return document
    if (document.status !== 'APPROVED') throw new InvalidStateError('Only approved stock counts can be posted')
    for (const line of [...document.lines].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
      if (!line.varianceQty || line.varianceQty.isZero()) continue
      movements.push(await InventoryPostingService.post({
        tenantId, itemId: line.itemId, warehouseId: document.warehouseId,
        movementType: 'ADJUSTMENT', referenceType: 'STOCK_COUNT', quantity: line.varianceQty,
        movementDate: document.countDate, referenceNo: document.countNumber,
        remarks: input.remarks ?? line.remarks ?? document.remarks ?? undefined,
        idempotencyKey: `INVCOUNT:${id}:POST:${line.id}`, rate: line.rate, createdBy: actorId,
      }, tx))
    }
    await tx.inventoryStockCount.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date(), postedBy: actorId, updatedBy: actorId } })
    return load(tenantId, id, tx)
  })
  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, movements, {
    sourceDocumentType: 'INVENTORY_STOCK_COUNT',
    sourceDocumentId: id,
    userId: actorId,
  })
  return result
}

export async function reverseStockCount(tenantId: string, id: string, actorId: string, input: StockCountPostingInput) {
  const movements: InventoryStockMovement[] = []
  const result = await prisma.$transaction(async (tx) => {
    const document = await lock(tx, tenantId, id)
    if (document.status === 'REVERSED') return document
    if (document.status !== 'POSTED') throw new InvalidStateError('Only posted stock counts can be reversed')
    for (const line of [...document.lines].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
      if (!line.varianceQty || line.varianceQty.isZero()) continue
      movements.push(await InventoryPostingService.post({
        tenantId, itemId: line.itemId, warehouseId: document.warehouseId,
        movementType: 'ADJUSTMENT', referenceType: 'STOCK_COUNT_REVERSAL', quantity: line.varianceQty.negated(),
        referenceNo: document.countNumber, remarks: input.remarks,
        idempotencyKey: `INVCOUNT:${id}:REVERSE:${line.id}`, rate: line.rate, createdBy: actorId,
      }, tx))
    }
    await tx.inventoryStockCount.update({
      where: { id },
      data: { status: 'REVERSED', reversedAt: new Date(), reversedBy: actorId, reversalReason: input.remarks, updatedBy: actorId },
    })
    return load(tenantId, id, tx)
  })
  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, movements, {
    sourceDocumentType: 'INVENTORY_STOCK_COUNT',
    sourceDocumentId: id,
    userId: actorId,
  })
  return result
}
