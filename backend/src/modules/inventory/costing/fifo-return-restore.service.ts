import type { Prisma } from '@prisma/client'
import { toDecimal } from '../shared/quantity.helpers.js'

export interface FifoReturnRestoreAllocation {
  layerId: string
  quantity: Prisma.Decimal
  unitCost: Prisma.Decimal
  totalCost: Prisma.Decimal
  originalIssueCostEntryId: string
  originalIssueMovementId: string
}

export interface PlanFifoReturnRestoreInput {
  tenantId: string
  itemId: string
  warehouseId: string
  returnQty: Prisma.Decimal
  workOrderId?: string | null
  /** When set, restore only against this ISSUE_TO_WO movement's consumptions. */
  reversalOfMovementId?: string | null
}

export interface PlanFifoReturnRestoreResult {
  allocations: FifoReturnRestoreAllocation[]
  restoredQty: Prisma.Decimal
  remainderQty: Prisma.Decimal
}

/**
 * Plan FIFO return restorations against originally consumed cost layers.
 *
 * Strategy:
 * - Load ISSUE_TO_WO movements (optionally one specific movement) for WO+item+warehouse
 * - Build a LIFO stream of positive layer consumptions
 * - Skip qty already returned (prior RETURN_FROM_WO for the same scope)
 * - Allocate current returnQty onto remaining consumptions, restoring original unit costs
 */
export async function planFifoReturnRestoreInTx(
  tx: Prisma.TransactionClient,
  input: PlanFifoReturnRestoreInput,
): Promise<PlanFifoReturnRestoreResult> {
  const returnQty = toDecimal(input.returnQty).abs()
  if (returnQty.isZero()) {
    return { allocations: [], restoredQty: toDecimal(0), remainderQty: toDecimal(0) }
  }

  const issueWhere: Prisma.InventoryStockMovementWhereInput = {
    tenantId: input.tenantId,
    itemId: input.itemId,
    warehouseId: input.warehouseId,
    referenceType: 'ISSUE_TO_WO',
    ...(input.reversalOfMovementId
      ? { id: input.reversalOfMovementId }
      : input.workOrderId
        ? { workOrderId: input.workOrderId }
        : {}),
  }

  const issues = await tx.inventoryStockMovement.findMany({
    where: issueWhere,
    orderBy: [{ movementDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, movementNumber: true, quantity: true },
  })

  type StreamRow = {
    layerId: string
    qty: Prisma.Decimal
    unitCost: Prisma.Decimal
    issueCostEntryId: string
    issueMovementId: string
  }
  const stream: StreamRow[] = []

  for (const issue of issues) {
    const entry = await tx.inventoryCostEntry.findFirst({
      where: {
        tenantId: input.tenantId,
        inventoryMovementId: issue.id,
      },
      select: { id: true },
    })
    if (!entry) continue

    const consumptions = await tx.inventoryCostLayerConsumption.findMany({
      where: {
        tenantId: input.tenantId,
        issueCostEntryId: entry.id,
        quantityConsumed: { gt: 0 },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    for (const c of consumptions) {
      stream.push({
        layerId: c.layerId,
        qty: toDecimal(c.quantityConsumed),
        unitCost: toDecimal(c.unitCost),
        issueCostEntryId: entry.id,
        issueMovementId: issue.id,
      })
    }
  }

  const priorReturned = await resolvePriorReturnedQty(tx, input, issues)
  let skipQty = priorReturned
  let remaining = returnQty
  const allocations: FifoReturnRestoreAllocation[] = []

  for (const row of stream) {
    if (remaining.isZero()) break
    let available = row.qty
    if (skipQty.greaterThan(0)) {
      const skipped = available.greaterThan(skipQty) ? skipQty : available
      skipQty = skipQty.minus(skipped).toDecimalPlaces(4)
      available = available.minus(skipped).toDecimalPlaces(4)
    }
    if (available.isZero()) continue

    const take = available.greaterThan(remaining) ? remaining : available
    const totalCost = take.times(row.unitCost).toDecimalPlaces(2)
    allocations.push({
      layerId: row.layerId,
      quantity: take,
      unitCost: row.unitCost,
      totalCost,
      originalIssueCostEntryId: row.issueCostEntryId,
      originalIssueMovementId: row.issueMovementId,
    })
    remaining = remaining.minus(take).toDecimalPlaces(4)
  }

  // Distribute rounding so sum(totalCost) matches qty * blended rate later in posting.
  const restoredQty = returnQty.minus(remaining).toDecimalPlaces(4)
  return {
    allocations,
    restoredQty,
    remainderQty: remaining,
  }
}

async function resolvePriorReturnedQty(
  tx: Prisma.TransactionClient,
  input: PlanFifoReturnRestoreInput,
  issues: Array<{ id: string; movementNumber: string }>,
): Promise<Prisma.Decimal> {
  if (input.reversalOfMovementId) {
    const issue = issues.find((i) => i.id === input.reversalOfMovementId) ?? issues[0]
    if (!issue) return toDecimal(0)
    const returns = await tx.inventoryStockMovement.findMany({
      where: {
        tenantId: input.tenantId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        referenceType: 'RETURN_FROM_WO',
        OR: [
          { referenceNo: `REV-${issue.movementNumber}` },
          { idempotencyKey: { startsWith: `MAT_ISSUE_REV:${issue.id}:` } },
          {
            AND: [
              { workOrderId: input.workOrderId ?? undefined },
              { remarks: { contains: issue.id } },
            ],
          },
        ],
      },
      select: { quantity: true },
    })
    return returns.reduce((sum, r) => sum.plus(toDecimal(r.quantity).abs()), toDecimal(0)).toDecimalPlaces(4)
  }

  if (!input.workOrderId) return toDecimal(0)

  const returns = await tx.inventoryStockMovement.findMany({
    where: {
      tenantId: input.tenantId,
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      workOrderId: input.workOrderId,
      referenceType: 'RETURN_FROM_WO',
    },
    select: { quantity: true },
  })
  return returns.reduce((sum, r) => sum.plus(toDecimal(r.quantity).abs()), toDecimal(0)).toDecimalPlaces(4)
}

export async function applyFifoReturnRestoreInTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  allocations: FifoReturnRestoreAllocation[],
): Promise<void> {
  for (const allocation of allocations) {
    const layer = await tx.inventoryCostLayer.findFirst({
      where: { id: allocation.layerId, tenantId },
    })
    if (!layer) continue

    const newRemainingQty = toDecimal(layer.remainingQuantity).plus(allocation.quantity).toDecimalPlaces(4)
    // Restore value from original unit cost to avoid drifting layer value.
    const restoredValue = allocation.quantity.times(toDecimal(layer.unitCost)).toDecimalPlaces(2)
    const newRemainingValue = toDecimal(layer.remainingValue).plus(restoredValue).toDecimalPlaces(2)

    await tx.inventoryCostLayer.update({
      where: { id: layer.id },
      data: {
        remainingQuantity: newRemainingQty,
        remainingValue: newRemainingValue,
        status: newRemainingQty.greaterThan(0) ? 'OPEN' : layer.status,
      },
    })
  }
}
