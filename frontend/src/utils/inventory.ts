import type { Item, Warehouse } from '../types/master'
import type { StockMovement, StockMovementType, StockPositionEnriched, StockReservation } from '../types/inventory'

export function balanceKey(itemId: string, warehouseId: string) {
  return `${itemId}:${warehouseId}`
}

/** On-hand = sum of all movement quantities (signed ledger) */
export function computeOnHand(movements: StockMovement[], itemId: string, warehouseId: string): number {
  return movements
    .filter((m) => m.itemId === itemId && m.warehouseId === warehouseId)
    .reduce((sum, m) => sum + m.qty, 0)
}

export function computeReservedQty(reservations: StockReservation[], itemId: string, warehouseId: string): number {
  return reservations
    .filter((r) => r.itemId === itemId && r.warehouseId === warehouseId && r.status === 'active')
    .reduce((sum, r) => sum + r.qty, 0)
}

export function computeFreeQty(onHand: number, reservedQty: number): number {
  return onHand - reservedQty
}

export function aggregateMovements(movements: StockMovement[], itemId: string, warehouseId: string) {
  const rows = movements.filter((m) => m.itemId === itemId && m.warehouseId === warehouseId)
  return {
    openingQty: rows.filter((m) => m.movementType === 'opening').reduce((s, m) => s + m.qty, 0),
    inwardQty: rows.filter((m) => m.movementType === 'inward').reduce((s, m) => s + m.qty, 0),
    issuedQty: Math.abs(rows.filter((m) => m.movementType === 'issue').reduce((s, m) => s + m.qty, 0)),
    adjustmentQty: rows.filter((m) => m.movementType === 'adjustment').reduce((s, m) => s + m.qty, 0),
  }
}

export function hasOpeningMovement(movements: StockMovement[], itemId: string, warehouseId: string): boolean {
  return movements.some(
    (m) => m.itemId === itemId && m.warehouseId === warehouseId && m.movementType === 'opening',
  )
}

export function computeBalanceAfter(
  movements: StockMovement[],
  itemId: string,
  warehouseId: string,
  newQty: number,
): number {
  return computeOnHand(movements, itemId, warehouseId) + newQty
}

export function enrichStockPosition(
  item: Item,
  warehouse: Warehouse,
  categoryName: string,
  uomCode: string,
  movements: StockMovement[],
  reservations: StockReservation[],
): StockPositionEnriched {
  const onHand = computeOnHand(movements, item.id, warehouse.id)
  const reservedQty = computeReservedQty(reservations, item.id, warehouse.id)
  const freeQty = computeFreeQty(onHand, reservedQty)
  const agg = aggregateMovements(movements, item.id, warehouse.id)

  return {
    itemId: item.id,
    itemCode: item.itemCode,
    itemName: item.itemName,
    categoryName,
    warehouseId: warehouse.id,
    warehouseCode: warehouse.warehouseCode,
    warehouseName: warehouse.warehouseName,
    uomCode,
    onHand,
    reservedQty,
    freeQty,
    ...agg,
    reorderLevel: item.reorderLevel,
    standardRate: item.standardRate,
    stockValue: onHand * item.standardRate,
    isLowStock: item.reorderLevel > 0 && onHand <= item.reorderLevel,
  }
}

export function exportStockCsv(rows: StockPositionEnriched[]): string {
  const header = [
    'Item Code', 'Item Name', 'Category', 'Warehouse', 'UOM',
    'On Hand', 'Reserved', 'Free Stock',
    'Opening', 'Inward', 'Issued', 'Adjustment',
    'Reorder Level', 'Stock Value',
  ].join(',')
  const lines = rows.map((r) =>
    [
      r.itemCode,
      `"${r.itemName}"`,
      r.categoryName,
      r.warehouseCode,
      r.uomCode,
      r.onHand,
      r.reservedQty,
      r.freeQty,
      r.openingQty,
      r.inwardQty,
      r.issuedQty,
      r.adjustmentQty,
      r.reorderLevel,
      r.stockValue.toFixed(2),
    ].join(','),
  )
  return [header, ...lines].join('\n')
}

export function exportLedgerCsv(
  entries: StockMovement[],
  itemCode: (id: string) => string,
  whCode: (id: string) => string,
): string {
  const header = ['Movement No', 'Date', 'Type', 'Item', 'Warehouse', 'Qty', 'Rate', 'Value', 'Balance After', 'Reference', 'Remarks'].join(',')
  const lines = entries.map((e) =>
    [
      e.movementNo,
      e.movementDate,
      e.movementType,
      itemCode(e.itemId),
      whCode(e.warehouseId),
      e.qty,
      e.rate,
      e.value.toFixed(2),
      e.balanceAfter,
      e.referenceNo,
      `"${e.remarks}"`,
    ].join(','),
  )
  return [header, ...lines].join('\n')
}

import { getNextCode, entityTypeFromLegacyPrefix } from '../services/codeSeriesService'

export function nextMovementNo(prefix: string, existing: string[]): string {
  const entityType = entityTypeFromLegacyPrefix(prefix)
  if (entityType) return getNextCode(entityType, { existingNumbers: existing })
  const nums = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.replace(prefix, ''), 10))
    .filter((n) => !Number.isNaN(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

/** @deprecated use movementType field name */
export function movementTypeLabel(type: StockMovementType): string {
  return type
}
