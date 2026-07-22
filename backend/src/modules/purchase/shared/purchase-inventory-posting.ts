import type { InventoryStockMovement, Prisma } from '@prisma/client'
import { postStockMovement } from '../../inventory/shared/stock-posting.service.js'

type QtyLine = {
  id: string
  itemId: string | null
  receivedQuantity?: unknown
  acceptedQuantity?: unknown
  rejectedQuantity?: unknown
  acceptedForQcQuantity?: unknown
  returnQuantity?: unknown
  rate?: unknown
  batchNumber?: string | null
  lotNumber?: string | null
  heatNumber?: string | null
  serialNumber?: string | null
  manufacturingDate?: Date | null
  expiryDate?: Date | null
}

function qty(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Post GRN accepted (or received when QC not required) stock inward. Idempotent per line. */
export async function postGrnStockInward(input: {
  tenantId: string
  grnId: string
  grnNumber: string
  warehouseId: string
  lines: QtyLine[]
  useAcceptedQuantity: boolean
  actorId: string
  tx?: Prisma.TransactionClient
}): Promise<InventoryStockMovement[]> {
  const movements: InventoryStockMovement[] = []
  for (const line of input.lines) {
    if (!line.itemId) continue
    const quantity = input.useAcceptedQuantity
      ? qty(line.acceptedForQcQuantity ?? line.acceptedQuantity)
      : qty(line.receivedQuantity)
    if (quantity <= 0) continue
    const movement = await postStockMovement(
      {
        tenantId: input.tenantId,
        itemId: line.itemId,
        warehouseId: input.warehouseId,
        movementType: 'INWARD',
        referenceType: 'GRN',
        quantity,
        stockStatus: input.useAcceptedQuantity ? 'QC_HOLD' : 'UNRESTRICTED',
        batchNumber: line.batchNumber ?? undefined,
        lotNumber: line.lotNumber ?? undefined,
        heatNumber: line.heatNumber ?? undefined,
        serialNumber: line.serialNumber ?? undefined,
        manufacturingDate: line.manufacturingDate ?? undefined,
        expiryDate: line.expiryDate ?? undefined,
        rate: qty(line.rate),
        referenceNo: input.grnNumber,
        remarks: `GRN inward ${input.grnNumber}`,
        idempotencyKey: `grn-in:${input.grnId}:${line.id}`,
        createdBy: input.actorId,
      },
      input.tx,
    )
    if (line.lotNumber?.trim() && input.tx) {
      const lot = await input.tx.inventoryLot.findFirst({
        where: {
          tenantId: input.tenantId,
          itemId: line.itemId,
          lotNumber: line.lotNumber.trim(),
          deletedAt: null,
        },
        select: { id: true },
      })
      if (lot) {
        await input.tx.goodsReceiptLine.updateMany({
          where: { id: line.id, tenantId: input.tenantId },
          data: { inventoryLotId: lot.id },
        })
      }
    }
    movements.push(movement)
  }
  return movements
}

/** Compensating ISSUE for previously posted GRN inward lines. Idempotent per line. */
export async function reverseGrnStockInward(input: {
  tenantId: string
  grnId: string
  grnNumber: string
  warehouseId: string
  lines: QtyLine[]
  useAcceptedQuantity: boolean
  actorId: string
  tx?: Prisma.TransactionClient
}): Promise<InventoryStockMovement[]> {
  const movements: InventoryStockMovement[] = []
  for (const line of input.lines) {
    if (!line.itemId) continue
    if (input.useAcceptedQuantity) {
      const quantities = [
        { quantity: qty(line.acceptedQuantity), stockStatus: 'UNRESTRICTED' as const, suffix: 'accepted' },
        { quantity: qty(line.rejectedQuantity), stockStatus: 'REJECTED' as const, suffix: 'rejected' },
      ]
      for (const part of quantities) {
        if (part.quantity <= 0) continue
        const movement = await postStockMovement({
          tenantId: input.tenantId,
          itemId: line.itemId,
          warehouseId: input.warehouseId,
          movementType: 'ISSUE',
          referenceType: 'GRN',
          quantity: part.quantity,
          stockStatus: part.stockStatus,
          batchNumber: line.batchNumber ?? undefined,
          serialNumber: line.serialNumber ?? undefined,
          referenceNo: input.grnNumber,
          remarks: `GRN reverse ${input.grnNumber}`,
          idempotencyKey: `grn-rev:${input.grnId}:${line.id}:${part.suffix}`,
          createdBy: input.actorId,
          allowNegativeStock: true,
        }, input.tx)
        movements.push(movement)
      }
      continue
    }
    const quantity = input.useAcceptedQuantity
      ? qty(line.acceptedForQcQuantity ?? line.acceptedQuantity)
      : qty(line.receivedQuantity)
    if (quantity <= 0) continue
    const movement = await postStockMovement(
      {
        tenantId: input.tenantId,
        itemId: line.itemId,
        warehouseId: input.warehouseId,
        movementType: 'ISSUE',
        referenceType: 'GRN',
        quantity,
        stockStatus: 'UNRESTRICTED',
        batchNumber: line.batchNumber ?? undefined,
        serialNumber: line.serialNumber ?? undefined,
        referenceNo: input.grnNumber,
        remarks: `GRN reverse ${input.grnNumber}`,
        idempotencyKey: `grn-rev:${input.grnId}:${line.id}`,
        createdBy: input.actorId,
        allowNegativeStock: true,
      },
      input.tx,
    )
    movements.push(movement)
  }
  return movements
}

/** Remove a QC-pending GRN from QC_HOLD before cancellation. */
export async function reverseGrnQcHold(input: {
  tenantId: string
  grnId: string
  grnNumber: string
  warehouseId: string
  lines: QtyLine[]
  actorId: string
  tx?: Prisma.TransactionClient
}): Promise<InventoryStockMovement[]> {
  const movements: InventoryStockMovement[] = []
  for (const line of input.lines) {
    if (!line.itemId) continue
    const quantity = qty(line.acceptedForQcQuantity)
    if (quantity <= 0) continue
    const movement = await postStockMovement({
      tenantId: input.tenantId,
      itemId: line.itemId,
      warehouseId: input.warehouseId,
      movementType: 'ISSUE',
      referenceType: 'GRN',
      quantity,
      stockStatus: 'QC_HOLD',
      batchNumber: line.batchNumber ?? undefined,
      serialNumber: line.serialNumber ?? undefined,
      referenceNo: input.grnNumber,
      remarks: `GRN QC hold cancel ${input.grnNumber}`,
      idempotencyKey: `grn-qc-cancel:${input.grnId}:${line.id}`,
      createdBy: input.actorId,
      allowNegativeStock: true,
    }, input.tx)
    movements.push(movement)
  }
  return movements
}

/** Issue stock for completed purchase return lines. Idempotent per line. */
export async function postPurchaseReturnStockIssue(input: {
  tenantId: string
  returnId: string
  returnNumber: string
  warehouseId: string
  lines: QtyLine[]
  actorId: string
  tx?: Prisma.TransactionClient
}): Promise<InventoryStockMovement[]> {
  const movements: InventoryStockMovement[] = []
  for (const line of input.lines) {
    if (!line.itemId) continue
    const quantity = qty(line.returnQuantity)
    if (quantity <= 0) continue
    const movement = await postStockMovement(
      {
        tenantId: input.tenantId,
        itemId: line.itemId,
        warehouseId: input.warehouseId,
        movementType: 'ISSUE',
        referenceType: 'ISS',
        quantity,
        referenceNo: input.returnNumber,
        remarks: `Purchase return ${input.returnNumber}`,
        idempotencyKey: `prt-out:${input.returnId}:${line.id}`,
        createdBy: input.actorId,
      },
      input.tx,
    )
    movements.push(movement)
  }
  return movements
}
