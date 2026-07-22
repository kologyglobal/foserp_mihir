import { prisma } from '../../../config/database.js'
import { dec, toDecimal } from '../shared/quantity.helpers.js'

export interface ReconcileBalancesQuery {
  itemId?: string
  warehouseId?: string
  mismatchesOnly?: boolean
}

interface ReconciliationRow {
  itemId: string
  warehouseId: string
  item?: { id: string; code: string; name: string }
  warehouse?: { id: string; code: string; name: string }
  storedOnHandQty: string
  ledgerOnHandQty: string
  onHandDifference: string
  storedReservedQty: string
  activeReservedQty: string
  reservedDifference: string
  status: 'MATCHED' | 'MISMATCHED'
  updatedAt: string | null
}

function positionKey(itemId: string, warehouseId: string): string {
  return `${itemId}:${warehouseId}`
}

/**
 * Read-only diagnostic. The immutable movement ledger remains authoritative;
 * this service never overwrites stored balances.
 */
export async function reconcileInventoryBalances(
  tenantId: string,
  query: ReconcileBalancesQuery,
) {
  const where = {
    tenantId,
    ...(query.itemId ? { itemId: query.itemId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
  }

  const [balances, ledgerGroups, reservationGroups] = await Promise.all([
    prisma.inventoryStockBalance.findMany({
      where,
      include: {
        item: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ itemId: 'asc' }, { warehouseId: 'asc' }],
    }),
    prisma.inventoryStockMovement.groupBy({
      by: ['itemId', 'warehouseId'],
      where: { ...where, fromStockStatus: null },
      _sum: { quantity: true },
    }),
    prisma.inventoryStockReservation.groupBy({
      by: ['itemId', 'warehouseId'],
      where: { ...where, status: 'ACTIVE' },
      _sum: { quantity: true, fulfilledQty: true, releasedQty: true },
    }),
  ])

  const ledgerByPosition = new Map(
    ledgerGroups.map((row) => [
      positionKey(row.itemId, row.warehouseId),
      toDecimal(row._sum.quantity),
    ]),
  )
  const reservedByPosition = new Map(
    reservationGroups.map((row) => [
      positionKey(row.itemId, row.warehouseId),
      toDecimal(row._sum.quantity)
        .minus(toDecimal(row._sum.fulfilledQty))
        .minus(toDecimal(row._sum.releasedQty)),
    ]),
  )

  const rows: ReconciliationRow[] = balances.map((balance) => {
    const key = positionKey(balance.itemId, balance.warehouseId)
    const ledgerOnHand = ledgerByPosition.get(key) ?? toDecimal(0)
    const activeReserved = reservedByPosition.get(key) ?? toDecimal(0)
    const onHandDifference = toDecimal(balance.onHandQty).minus(ledgerOnHand)
    const reservedDifference = toDecimal(balance.reservedQty).minus(activeReserved)
    const matched = onHandDifference.isZero() && reservedDifference.isZero()

    return {
      itemId: balance.itemId,
      warehouseId: balance.warehouseId,
      item: balance.item,
      warehouse: balance.warehouse,
      storedOnHandQty: dec(balance.onHandQty),
      ledgerOnHandQty: dec(ledgerOnHand),
      onHandDifference: dec(onHandDifference),
      storedReservedQty: dec(balance.reservedQty),
      activeReservedQty: dec(activeReserved),
      reservedDifference: dec(reservedDifference),
      status: matched ? 'MATCHED' as const : 'MISMATCHED' as const,
      updatedAt: balance.updatedAt.toISOString(),
    }
  })
  const balanceKeys = new Set(balances.map((balance) => positionKey(balance.itemId, balance.warehouseId)))
  const orphanPositions = new Map<string, { itemId: string; warehouseId: string }>()
  for (const group of [...ledgerGroups, ...reservationGroups]) {
    const key = positionKey(group.itemId, group.warehouseId)
    if (!balanceKeys.has(key)) {
      orphanPositions.set(key, { itemId: group.itemId, warehouseId: group.warehouseId })
    }
  }
  for (const [key, position] of orphanPositions) {
    const ledgerOnHand = ledgerByPosition.get(key) ?? toDecimal(0)
    const activeReserved = reservedByPosition.get(key) ?? toDecimal(0)
    rows.push({
      itemId: position.itemId,
      warehouseId: position.warehouseId,
      item: undefined,
      warehouse: undefined,
      storedOnHandQty: '0',
      ledgerOnHandQty: dec(ledgerOnHand),
      onHandDifference: dec(ledgerOnHand.negated()),
      storedReservedQty: '0',
      activeReservedQty: dec(activeReserved),
      reservedDifference: dec(activeReserved.negated()),
      status: 'MISMATCHED',
      updatedAt: null,
    })
  }

  const filtered = query.mismatchesOnly === false
    ? rows
    : rows.filter((row) => row.status === 'MISMATCHED')

  return {
    asOf: new Date().toISOString(),
    authoritativeSource: 'INVENTORY_STOCK_MOVEMENTS',
    totalPositions: rows.length,
    matchedPositions: rows.filter((row) => row.status === 'MATCHED').length,
    mismatchedPositions: rows.filter((row) => row.status === 'MISMATCHED').length,
    rows: filtered,
  }
}
