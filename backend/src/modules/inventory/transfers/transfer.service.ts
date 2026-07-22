import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getOrCreateBalance } from '../shared/balance.service.js'
import { InventoryPostingService } from '../shared/stock-posting.service.js'
import type { CreateTransferInput, ListTransfersInput, PostingActionInput, ReceiveTransferInput } from './transfer.schemas.js'

const include = {
  fromWarehouse: { select: { id: true, code: true, name: true } },
  toWarehouse: { select: { id: true, code: true, name: true } },
  lines: {
    include: { item: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
}

async function getTransfer(tenantId: string, id: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const document = await tx.inventoryTransfer.findFirst({ where: { id, tenantId }, include })
  if (!document) throw new NotFoundError('Inventory transfer not found')
  return document
}

async function lockTransfer(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM inventory_transfers WHERE id = ${id} AND tenantId = ${tenantId} FOR UPDATE
  `
  if (!rows.length) throw new NotFoundError('Inventory transfer not found')
  return getTransfer(tenantId, id, tx)
}

async function validateReferences(tenantId: string, input: CreateTransferInput) {
  const [warehouses, items] = await Promise.all([
    prisma.masterWarehouse.count({
      where: { tenantId, id: { in: [input.fromWarehouseId, input.toWarehouseId] }, deletedAt: null, status: 'ACTIVE' },
    }),
    prisma.masterItem.count({
      where: { tenantId, id: { in: input.lines.map((line) => line.itemId) }, deletedAt: null, status: 'ACTIVE', isStockable: true, isBlocked: false },
    }),
  ])
  if (warehouses !== 2) throw new ValidationError('Both warehouses must be active and belong to the tenant')
  if (items !== input.lines.length) throw new ValidationError('Every transfer item must be active, stockable, and belong to the tenant')
}

export async function createTransfer(tenantId: string, actorId: string, input: CreateTransferInput) {
  await validateReferences(tenantId, input)
  return prisma.$transaction(async (tx) => {
    const transferNumber = await nextCode(tenantId, 'INVENTORY_TRANSFER', tx)
    const created = await tx.inventoryTransfer.create({
      data: {
        tenantId,
        transferNumber,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        transferDate: input.transferDate ?? new Date(),
        remarks: input.remarks,
        createdBy: actorId,
        updatedBy: actorId,
        lines: {
          create: input.lines.map((line) => ({
            tenantId,
            itemId: line.itemId,
            batchId: line.batchId ?? null,
            serialId: line.serialId ?? null,
            batchNumberSnapshot: line.batchNumber ?? null,
            serialNumberSnapshot: line.serialNumber ?? null,
            quantity: line.quantity,
            rate: line.rate ?? 0,
            remarks: line.remarks,
          })),
        },
      },
    })
    return getTransfer(tenantId, created.id, tx)
  })
}

export async function listTransfers(tenantId: string, input: ListTransfersInput) {
  const where: Prisma.InventoryTransferWhereInput = {
    tenantId,
    status: input.status,
    OR: input.warehouseId
      ? [{ fromWarehouseId: input.warehouseId }, { toWarehouseId: input.warehouseId }]
      : input.search
        ? [{ transferNumber: { contains: input.search } }, { remarks: { contains: input.search } }]
        : undefined,
  }
  const skip = (input.page - 1) * input.limit
  const [items, total] = await Promise.all([
    prisma.inventoryTransfer.findMany({ where, include, skip, take: input.limit, orderBy: { createdAt: 'desc' } }),
    prisma.inventoryTransfer.count({ where }),
  ])
  return { items, total, page: input.page, limit: input.limit }
}

export const findTransfer = getTransfer

async function transition(
  tenantId: string,
  id: string,
  actorId: string,
  from: string[],
  data: Prisma.InventoryTransferUpdateInput,
) {
  return prisma.$transaction(async (tx) => {
    const document = await lockTransfer(tx, tenantId, id)
    if (!from.includes(document.status)) throw new InvalidStateError(`Transfer cannot transition from ${document.status}`)
    await tx.inventoryTransfer.update({ where: { id }, data: { ...data, updatedBy: actorId } })
    return getTransfer(tenantId, id, tx)
  })
}

export function submitTransfer(tenantId: string, id: string, actorId: string) {
  return transition(tenantId, id, actorId, ['DRAFT'], { status: 'SUBMITTED', submittedAt: new Date(), submittedBy: actorId })
}

export function approveTransfer(tenantId: string, id: string, actorId: string) {
  return transition(tenantId, id, actorId, ['SUBMITTED'], { status: 'APPROVED', approvedAt: new Date(), approvedBy: actorId })
}

export function cancelTransfer(tenantId: string, id: string, actorId: string) {
  return transition(tenantId, id, actorId, ['DRAFT', 'SUBMITTED', 'APPROVED'], { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: actorId })
}

export async function dispatchTransfer(tenantId: string, id: string, actorId: string, input: PostingActionInput) {
  return prisma.$transaction(async (tx) => {
    const document = await lockTransfer(tx, tenantId, id)
    if (document.status === 'IN_TRANSIT' || document.status === 'PARTIALLY_RECEIVED' || document.status === 'RECEIVED') return document
    if (document.status !== 'APPROVED') throw new InvalidStateError('Only approved transfers can be dispatched')
    for (const line of [...document.lines].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
      await InventoryPostingService.post({
        tenantId,
        itemId: line.itemId,
        warehouseId: document.fromWarehouseId,
        movementType: 'ISSUE',
        referenceType: 'TRANSFER_DISPATCH',
        quantity: line.quantity,
        batchId: line.batchId ?? undefined,
        batchNumber: line.batchNumberSnapshot ?? undefined,
        serialId: line.serialId ?? undefined,
        serialNumber: line.serialNumberSnapshot ?? undefined,
        movementDate: document.transferDate,
        referenceNo: document.transferNumber,
        remarks: input.remarks ?? document.remarks ?? undefined,
        idempotencyKey: `INVTR:${id}:DISPATCH:${line.id}`,
        rate: line.rate,
        createdBy: actorId,
      }, tx)
      await tx.inventoryTransferLine.update({ where: { id: line.id }, data: { dispatchedQty: line.quantity } })
    }
    await tx.inventoryTransfer.update({
      where: { id },
      data: { status: 'IN_TRANSIT', dispatchedAt: new Date(), dispatchedBy: actorId, updatedBy: actorId },
    })
    return getTransfer(tenantId, id, tx)
  })
}

export async function receiveTransfer(tenantId: string, id: string, actorId: string, input: ReceiveTransferInput) {
  return prisma.$transaction(async (tx) => {
    const document = await lockTransfer(tx, tenantId, id)
    const requestKey = createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 24)
    const replayKey = `INVTR:${id}:RECEIVE:${requestKey}:${input.lines[0]!.lineId}`
    if (await tx.inventoryStockMovement.findFirst({ where: { tenantId, idempotencyKey: replayKey } })) return document
    if (!['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(document.status)) {
      throw new InvalidStateError('Only dispatched transfers can be received')
    }
    const requested = new Map(input.lines.map((line) => [line.lineId, line.quantity]))
    if (requested.size !== input.lines.length) throw new ValidationError('Duplicate transfer lines are not allowed')
    for (const line of document.lines) {
      const quantity = requested.get(line.id)
      if (quantity === undefined) continue
      const remaining = line.dispatchedQty.minus(line.receivedQty)
      if (remaining.lessThan(quantity)) throw new ConflictError(`Receipt exceeds remaining quantity for item ${line.item.code}`)
      await InventoryPostingService.post({
        tenantId,
        itemId: line.itemId,
        warehouseId: document.toWarehouseId,
        movementType: 'INWARD',
        referenceType: 'TRANSFER_RECEIPT',
        quantity,
        batchId: line.batchId ?? undefined,
        batchNumber: line.batchNumberSnapshot ?? undefined,
        serialId: line.serialId ?? undefined,
        serialNumber: line.serialNumberSnapshot ?? undefined,
        movementDate: new Date(),
        referenceNo: document.transferNumber,
        idempotencyKey: `INVTR:${id}:RECEIVE:${requestKey}:${line.id}`,
        rate: line.rate,
        createdBy: actorId,
      }, tx)
      await tx.inventoryTransferLine.update({
        where: { id: line.id },
        data: { receivedQty: { increment: quantity } },
      })
    }
    if ([...requested.keys()].some((lineId) => !document.lines.some((line) => line.id === lineId))) {
      throw new NotFoundError('Transfer line not found')
    }
    const lines = await tx.inventoryTransferLine.findMany({ where: { transferId: id } })
    const complete = lines.every((line) => line.receivedQty.equals(line.dispatchedQty))
    await tx.inventoryTransfer.update({
      where: { id },
      data: {
        status: complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        receivedAt: complete ? new Date() : null,
        receivedBy: actorId,
        updatedBy: actorId,
      },
    })
    return getTransfer(tenantId, id, tx)
  })
}

export async function reverseTransfer(tenantId: string, id: string, actorId: string, input: PostingActionInput) {
  return prisma.$transaction(async (tx) => {
    const document = await lockTransfer(tx, tenantId, id)
    if (document.status === 'REVERSED') return document
    if (!['IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(document.status)) {
      throw new InvalidStateError('Only dispatched transfers can be reversed')
    }
    const positions = document.lines
      .flatMap((line) => [
        { itemId: line.itemId, warehouseId: document.fromWarehouseId },
        { itemId: line.itemId, warehouseId: document.toWarehouseId },
      ])
      .sort((a, b) => `${a.warehouseId}:${a.itemId}`.localeCompare(`${b.warehouseId}:${b.itemId}`))
    for (const position of positions) {
      await getOrCreateBalance(tx, tenantId, position.itemId, position.warehouseId)
    }
    for (const line of [...document.lines].sort((a, b) => a.itemId.localeCompare(b.itemId))) {
      if (line.receivedQty.greaterThan(0)) {
        await InventoryPostingService.post({
          tenantId, itemId: line.itemId, warehouseId: document.toWarehouseId,
          movementType: 'ISSUE', referenceType: 'TRANSFER_REVERSAL', quantity: line.receivedQty,
          batchId: line.batchId ?? undefined, batchNumber: line.batchNumberSnapshot ?? undefined,
          serialId: line.serialId ?? undefined, serialNumber: line.serialNumberSnapshot ?? undefined,
          referenceNo: document.transferNumber, remarks: input.remarks,
          idempotencyKey: `INVTR:${id}:REVERSE:DEST:${line.id}`, rate: line.rate, createdBy: actorId,
        }, tx)
      }
      if (line.dispatchedQty.greaterThan(0)) {
        await InventoryPostingService.post({
          tenantId, itemId: line.itemId, warehouseId: document.fromWarehouseId,
          movementType: 'INWARD', referenceType: 'TRANSFER_REVERSAL', quantity: line.dispatchedQty,
          batchId: line.batchId ?? undefined, batchNumber: line.batchNumberSnapshot ?? undefined,
          serialId: line.serialId ?? undefined, serialNumber: line.serialNumberSnapshot ?? undefined,
          referenceNo: document.transferNumber, remarks: input.remarks,
          idempotencyKey: `INVTR:${id}:REVERSE:SOURCE:${line.id}`, rate: line.rate, createdBy: actorId,
        }, tx)
      }
    }
    await tx.inventoryTransfer.update({
      where: { id },
      data: { status: 'REVERSED', reversedAt: new Date(), reversedBy: actorId, reversalReason: input.remarks, updatedBy: actorId },
    })
    return getTransfer(tenantId, id, tx)
  })
}
