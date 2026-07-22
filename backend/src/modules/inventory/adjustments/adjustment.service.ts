import type { InventoryStockMovement, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { InventoryPostingService } from '../shared/stock-posting.service.js'
import { tryRecordInventoryAccountingEventsForMovements } from '../accounting/inventory-accounting-event.service.js'
import type { AdjustmentPostingInput, CreateAdjustmentInput, ListAdjustmentsInput } from './adjustment.schemas.js'

const include = {
  warehouse: { select: { id: true, code: true, name: true } },
  lines: {
    include: { item: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
}

async function load(tenantId: string, id: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const document = await tx.inventoryAdjustment.findFirst({ where: { tenantId, id }, include })
  if (!document) throw new NotFoundError('Inventory adjustment not found')
  return document
}

async function lock(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM inventory_adjustments WHERE id = ${id} AND tenantId = ${tenantId} FOR UPDATE
  `
  if (!rows.length) throw new NotFoundError('Inventory adjustment not found')
  return load(tenantId, id, tx)
}

export async function createAdjustment(tenantId: string, actorId: string, input: CreateAdjustmentInput) {
  const [warehouse, itemCount] = await Promise.all([
    prisma.masterWarehouse.findFirst({ where: { id: input.warehouseId, tenantId, deletedAt: null, status: 'ACTIVE' } }),
    prisma.masterItem.count({
      where: { id: { in: input.lines.map((line) => line.itemId) }, tenantId, deletedAt: null, status: 'ACTIVE', isStockable: true, isBlocked: false },
    }),
  ])
  if (!warehouse) throw new ValidationError('Active warehouse not found')
  if (itemCount !== input.lines.length) throw new ValidationError('Every adjustment item must be active, stockable, and belong to the tenant')
  return prisma.$transaction(async (tx) => {
    const adjustmentNumber = await nextCode(tenantId, 'INVENTORY_ADJUSTMENT', tx)
    const document = await tx.inventoryAdjustment.create({
      data: {
        tenantId,
        adjustmentNumber,
        warehouseId: input.warehouseId,
        adjustmentDate: input.adjustmentDate ?? new Date(),
        reason: input.reason,
        remarks: input.remarks,
        createdBy: actorId,
        updatedBy: actorId,
        lines: {
          create: input.lines.map((line) => ({
            tenantId,
            itemId: line.itemId,
            quantity: line.quantity,
            rate: line.rate ?? 0,
            reason: line.reason,
          })),
        },
      },
    })
    return load(tenantId, document.id, tx)
  })
}

export async function listAdjustments(tenantId: string, input: ListAdjustmentsInput) {
  const where: Prisma.InventoryAdjustmentWhereInput = {
    tenantId,
    status: input.status,
    warehouseId: input.warehouseId,
    OR: input.search
      ? [{ adjustmentNumber: { contains: input.search } }, { reason: { contains: input.search } }, { remarks: { contains: input.search } }]
      : undefined,
  }
  const skip = (input.page - 1) * input.limit
  const [items, total] = await Promise.all([
    prisma.inventoryAdjustment.findMany({ where, include, skip, take: input.limit, orderBy: { createdAt: 'desc' } }),
    prisma.inventoryAdjustment.count({ where }),
  ])
  return { items, total, page: input.page, limit: input.limit }
}

export const findAdjustment = load

async function transition(tenantId: string, id: string, actorId: string, from: string[], data: Prisma.InventoryAdjustmentUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const document = await lock(tx, tenantId, id)
    if (!from.includes(document.status)) throw new InvalidStateError(`Adjustment cannot transition from ${document.status}`)
    await tx.inventoryAdjustment.update({ where: { id }, data: { ...data, updatedBy: actorId } })
    return load(tenantId, id, tx)
  })
}

export function submitAdjustment(tenantId: string, id: string, actorId: string) {
  return transition(tenantId, id, actorId, ['DRAFT'], { status: 'SUBMITTED', submittedAt: new Date(), submittedBy: actorId })
}
export function approveAdjustment(tenantId: string, id: string, actorId: string) {
  return transition(tenantId, id, actorId, ['SUBMITTED'], { status: 'APPROVED', approvedAt: new Date(), approvedBy: actorId })
}

export async function postAdjustment(tenantId: string, id: string, actorId: string, input: AdjustmentPostingInput) {
  const movements: InventoryStockMovement[] = []
  const result = await prisma.$transaction(async (tx) => {
    const document = await lock(tx, tenantId, id)
    if (document.status === 'POSTED') return document
    if (document.status !== 'APPROVED') throw new InvalidStateError('Only approved adjustments can be posted')
    for (const line of [...document.lines].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
      movements.push(await InventoryPostingService.post({
        tenantId, itemId: line.itemId, warehouseId: document.warehouseId,
        movementType: 'ADJUSTMENT', referenceType: 'CONTROLLED_ADJUSTMENT', quantity: line.quantity,
        movementDate: document.adjustmentDate, referenceNo: document.adjustmentNumber,
        remarks: input.remarks ?? line.reason ?? document.reason,
        idempotencyKey: `INVADJ:${id}:POST:${line.id}`, rate: line.rate, createdBy: actorId,
      }, tx))
    }
    await tx.inventoryAdjustment.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date(), postedBy: actorId, updatedBy: actorId } })
    return load(tenantId, id, tx)
  })
  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, movements, {
    sourceDocumentType: 'INVENTORY_ADJUSTMENT',
    sourceDocumentId: id,
    userId: actorId,
  })
  return result
}

export async function reverseAdjustment(tenantId: string, id: string, actorId: string, input: AdjustmentPostingInput) {
  const movements: InventoryStockMovement[] = []
  const result = await prisma.$transaction(async (tx) => {
    const document = await lock(tx, tenantId, id)
    if (document.status === 'REVERSED') return document
    if (document.status !== 'POSTED') throw new InvalidStateError('Only posted adjustments can be reversed')
    for (const line of [...document.lines].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
      movements.push(await InventoryPostingService.post({
        tenantId, itemId: line.itemId, warehouseId: document.warehouseId,
        movementType: 'ADJUSTMENT', referenceType: 'ADJUSTMENT_REVERSAL', quantity: line.quantity.negated(),
        referenceNo: document.adjustmentNumber, remarks: input.remarks,
        idempotencyKey: `INVADJ:${id}:REVERSE:${line.id}`, rate: line.rate, createdBy: actorId,
      }, tx))
    }
    await tx.inventoryAdjustment.update({
      where: { id },
      data: { status: 'REVERSED', reversedAt: new Date(), reversedBy: actorId, reversalReason: input.remarks, updatedBy: actorId },
    })
    return load(tenantId, id, tx)
  })
  await tryRecordInventoryAccountingEventsForMovements(null, tenantId, movements, {
    sourceDocumentType: 'INVENTORY_ADJUSTMENT',
    sourceDocumentId: id,
    userId: actorId,
  })
  return result
}
