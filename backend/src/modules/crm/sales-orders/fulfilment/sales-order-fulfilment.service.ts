import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { NotFoundError, ValidationError } from '../../../../utils/errors.js'
import type { SalesOrderLineDto } from '../sales-order.types.js'
import type { SetCancelledQtyInput } from './sales-order-fulfilment.schemas.js'

function parseLines(value: unknown): SalesOrderLineDto[] {
  return Array.isArray(value) ? (value as SalesOrderLineDto[]) : []
}

function d(value: Prisma.Decimal | number | string): number {
  return Number(value)
}

export interface SalesOrderLineFulfilmentDto {
  salesOrderLineId: string
  lineNo: number
  productId: string | null
  productOrItem: string
  orderedQty: number
  cancelledQty: number
  netOrderedQty: number
  dispatchedQty: number
  remainingQty: number
  uom: string
}

export interface SalesOrderFulfilmentDto {
  salesOrderId: string
  salesOrderNo: string
  status: string
  lines: SalesOrderLineFulfilmentDto[]
  totals: {
    orderedQty: number
    cancelledQty: number
    netOrderedQty: number
    dispatchedQty: number
    remainingQty: number
  }
}

async function loadDispatchedByLine(
  tenantId: string,
  salesOrderId: string,
): Promise<Map<string, number>> {
  const rows = await prisma.outboundDispatchLine.findMany({
    where: {
      tenantId,
      salesOrderId,
      salesOrderLineId: { not: null },
      outboundDispatch: { tenantId, status: 'CONFIRMED', deletedAt: null },
    },
    select: { salesOrderLineId: true, quantity: true, id: true },
  })
  const map = new Map<string, number>()
  for (const row of rows) {
    if (!row.salesOrderLineId) continue
    map.set(row.salesOrderLineId, (map.get(row.salesOrderLineId) ?? 0) + d(row.quantity))
  }

  // Net out applied partial reversals (posting line reversedQuantity).
  const postingLines = await prisma.dispatchPostingLine.findMany({
    where: {
      tenantId,
      salesOrderId,
      salesOrderLineId: { not: null },
      reversedQuantity: { gt: 0 },
      posting: {
        tenantId,
        status: { in: ['POSTED', 'PARTIALLY_REVERSED', 'LEGACY_POSTED'] },
      },
    },
    select: { salesOrderLineId: true, reversedQuantity: true },
  })
  for (const pl of postingLines) {
    if (!pl.salesOrderLineId) continue
    const prev = map.get(pl.salesOrderLineId) ?? 0
    map.set(pl.salesOrderLineId, Math.max(0, prev - d(pl.reversedQuantity)))
  }

  return map
}

export async function getSalesOrderFulfilment(
  tenantId: string,
  salesOrderId: string,
): Promise<SalesOrderFulfilmentDto> {
  const order = await prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, tenantId, deletedAt: null },
  })
  if (!order) throw new NotFoundError('Sales order not found')

  const lines = parseLines(order.lines)
  const cancelledRows = await prisma.salesOrderLineFulfilment.findMany({
    where: { tenantId, salesOrderId },
  })
  const cancelledMap = new Map(cancelledRows.map((r) => [r.salesOrderLineId, d(r.cancelledQty)]))
  const dispatchedMap = await loadDispatchedByLine(tenantId, salesOrderId)

  const lineDtos: SalesOrderLineFulfilmentDto[] = lines.map((line) => {
    const orderedQty = line.qty
    const cancelledQty = cancelledMap.get(line.id) ?? 0
    const netOrderedQty = Math.max(0, orderedQty - cancelledQty)
    const dispatchedQty = dispatchedMap.get(line.id) ?? 0
    const remainingQty = Math.max(0, Math.round((netOrderedQty - dispatchedQty) * 10000) / 10000)
    return {
      salesOrderLineId: line.id,
      lineNo: line.lineNo,
      productId: line.productId ?? null,
      productOrItem: line.productOrItem,
      orderedQty,
      cancelledQty,
      netOrderedQty,
      dispatchedQty,
      remainingQty,
      uom: line.uom,
    }
  })

  const totals = lineDtos.reduce(
    (acc, line) => {
      acc.orderedQty += line.orderedQty
      acc.cancelledQty += line.cancelledQty
      acc.netOrderedQty += line.netOrderedQty
      acc.dispatchedQty += line.dispatchedQty
      acc.remainingQty += line.remainingQty
      return acc
    },
    { orderedQty: 0, cancelledQty: 0, netOrderedQty: 0, dispatchedQty: 0, remainingQty: 0 },
  )

  return {
    salesOrderId: order.id,
    salesOrderNo: order.salesOrderNo,
    status: order.status,
    lines: lineDtos,
    totals,
  }
}

export async function setLineCancelledQty(
  tenantId: string,
  salesOrderId: string,
  salesOrderLineId: string,
  input: SetCancelledQtyInput,
  userId?: string,
): Promise<SalesOrderFulfilmentDto> {
  const order = await prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, tenantId, deletedAt: null },
  })
  if (!order) throw new NotFoundError('Sales order not found')

  const lines = parseLines(order.lines)
  const line = lines.find((l) => l.id === salesOrderLineId)
  if (!line) throw new NotFoundError('Sales order line not found')

  const dispatchedMap = await loadDispatchedByLine(tenantId, salesOrderId)
  const dispatchedQty = dispatchedMap.get(salesOrderLineId) ?? 0
  const maxCancellable = Math.max(0, line.qty - dispatchedQty)
  if (input.cancelledQty > maxCancellable + 1e-9) {
    throw new ValidationError(
      `cancelledQty ${input.cancelledQty} exceeds max cancellable ${maxCancellable} (ordered ${line.qty} − dispatched ${dispatchedQty})`,
    )
  }

  await prisma.salesOrderLineFulfilment.upsert({
    where: {
      tenantId_salesOrderId_salesOrderLineId: {
        tenantId,
        salesOrderId,
        salesOrderLineId,
      },
    },
    create: {
      tenantId,
      salesOrderId,
      salesOrderLineId,
      cancelledQty: input.cancelledQty,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    },
    update: {
      cancelledQty: input.cancelledQty,
      updatedBy: userId ?? null,
    },
  })

  return getSalesOrderFulfilment(tenantId, salesOrderId)
}

/** Remaining qty that may still be dispatched for a line (server-side gate). */
export async function assertDispatchQtyAllowed(
  tenantId: string,
  salesOrderId: string,
  salesOrderLineId: string,
  qty: number,
): Promise<void> {
  const fulfilment = await getSalesOrderFulfilment(tenantId, salesOrderId)
  const line = fulfilment.lines.find((l) => l.salesOrderLineId === salesOrderLineId)
  if (!line) throw new ValidationError('Sales order line not found on fulfilment projection')
  if (qty > line.remainingQty + 1e-9) {
    throw new ValidationError(
      `Dispatch qty ${qty} exceeds remaining ${line.remainingQty} for SO line ${salesOrderLineId}`,
    )
  }
}
