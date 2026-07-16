import type { StockMovement, StockReservation } from '../../types/inventory'

const ts = new Date().toISOString()

/**
 * Real manufacturing stock — Pune plant FY 2026-27
 * Tuned so SO-0001 (2× 45 M3 Bulker) exposes realistic shortages on axles, plate, tyres, rims.
 */
type SeedRow = {
  itemId: string
  warehouseId: string
  opening: number
  inward?: number
  issued?: number
  rate: number
}

const seedRows: SeedRow[] = [
  // Bought Out Store — running gear (short on axles for 2-bulker order)
  { itemId: 'item-bo-axl', warehouseId: 'wh-bo-main', opening: 1, rate: 485000 },
  { itemId: 'item-bo-susp', warehouseId: 'wh-bo-main', opening: 3, issued: 1, rate: 125000 },
  { itemId: 'item-bo-kpin', warehouseId: 'wh-bo-main', opening: 8, rate: 18500 },
  { itemId: 'item-bo-lj', warehouseId: 'wh-bo-main', opening: 12, rate: 12800 },
  { itemId: 'item-bo-tyre', warehouseId: 'wh-bo-main', opening: 18, rate: 22500 },
  { itemId: 'item-bo-rim', warehouseId: 'wh-bo-main', opening: 20, rate: 8200 },
  { itemId: 'item-bo-airtank', warehouseId: 'wh-bo-main', opening: 10, rate: 6500 },
  { itemId: 'item-bo-valve', warehouseId: 'wh-bo-main', opening: 4, rate: 28500 },
  // RM Store — plate short for 2-bulker tank shell (4200 kg × 2 + 5% scrap ≈ 8820 kg)
  { itemId: 'item-rm-plt', warehouseId: 'wh-rm-main', opening: 5500, inward: 2000, issued: 1500, rate: 68.5 },
  { itemId: 'item-rm-pipe', warehouseId: 'wh-rm-main', opening: 120, inward: 80, issued: 48, rate: 1850 },
  { itemId: 'item-rm-angle', warehouseId: 'wh-rm-main', opening: 360, inward: 120, issued: 60, rate: 620 },
  // Paint Store
  { itemId: 'item-rm-primer', warehouseId: 'wh-cons', opening: 435, inward: 100, issued: 80, rate: 285 },
  { itemId: 'item-rm-thinner', warehouseId: 'wh-cons', opening: 80, rate: 145 },
  // FG Yard
  { itemId: 'item-fg-bulker', warehouseId: 'wh-fg-yard', opening: 1, rate: 2850000 },
  { itemId: 'item-fg-iso', warehouseId: 'wh-fg-yard', opening: 0, rate: 4200000 },
  { itemId: 'item-fg-sidewall', warehouseId: 'wh-fg-yard', opening: 1, rate: 1950000 },
]

let movCounter = 0

function mov(
  movementType: StockMovement['movementType'],
  itemId: string,
  warehouseId: string,
  qty: number,
  rate: number,
  balanceAfter: number,
  referenceType: string,
  referenceNo: string,
  remarks: string,
  movementDate: string,
): StockMovement {
  movCounter += 1
  const prefix = movementType === 'opening' ? 'OPN' : movementType === 'inward' ? 'INW' : movementType === 'issue' ? 'ISS' : 'ADJ'
  return {
    id: `sm-${String(movCounter).padStart(4, '0')}`,
    movementNo: `${prefix}-${String(movCounter).padStart(4, '0')}`,
    movementDate,
    movementType,
    itemId,
    warehouseId,
    qty,
    rate,
    value: Math.abs(qty) * rate,
    balanceAfter,
    referenceType,
    referenceNo,
    workOrderId: null,
    remarks,
    createdBy: 'Store Admin',
    createdAt: ts,
  }
}

function buildSeedMovements(): StockMovement[] {
  const movements: StockMovement[] = []
  for (const row of seedRows) {
    let balance = 0
    const baseDate = '2026-04-01'
    if (row.opening > 0) {
      balance += row.opening
      movements.push(mov('opening', row.itemId, row.warehouseId, row.opening, row.rate, balance, 'OPN', 'FY26-OPEN', 'FY 2026-27 opening stock', baseDate))
    }
    if (row.inward && row.inward > 0) {
      balance += row.inward
      movements.push(mov('inward', row.itemId, row.warehouseId, row.inward, row.rate, balance, 'GRN', 'GRN-SEED', 'Seed inward receipt', '2026-05-15'))
    }
    if (row.issued && row.issued > 0) {
      balance -= row.issued
      movements.push(mov('issue', row.itemId, row.warehouseId, -row.issued, row.rate, balance, 'MI', 'MI-SEED', 'Seed material issue to WIP', '2026-05-28'))
    }
  }
  return movements
}

export const seedStockMovements: StockMovement[] = buildSeedMovements()

/** Active reservations — WIP chassis WO only; SO-0001 starts clean for simulation */
export const seedReservations: StockReservation[] = [
  { id: 'res-wo-kpin', itemId: 'item-bo-kpin', warehouseId: 'wh-bo-main', qty: 2, demandType: 'WO', demandId: 'WO-2026-0088', referenceNo: 'WO-2026-0088', remarks: 'Chassis assembly WIP — existing WO', status: 'active', createdAt: ts, updatedAt: ts },
]

export const seedStockLedger = seedStockMovements
