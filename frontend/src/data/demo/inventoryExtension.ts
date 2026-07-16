import type { StockMovement } from '../../types/inventory'

const ts = new Date().toISOString()

/** Extra inventory movements so ledger pages show 15+ rows in demo mode. */
export function seedDemoInventoryMovements(): StockMovement[] {
  const moves: StockMovement[] = []
  const pairs: Array<[string, string, number, number, string, string, string]> = [
    ['item-rm-sheet', 'wh-rm-main', 2500, 72, 'opening', 'OPN', 'FY26-DEMO-01'],
    ['item-bo-compressor', 'wh-bo-main', 2, 185000, 'inward', 'GRN', 'GRN-DEMO-01'],
    ['item-bo-abs-kit', 'wh-bo-main', 4, 42000, 'inward', 'GRN', 'GRN-DEMO-02'],
    ['item-rm-weld-wire', 'wh-cons', 80, 185, 'inward', 'GRN', 'GRN-DEMO-03'],
    ['item-rm-topcoat', 'wh-cons', 60, 420, 'inward', 'GRN', 'GRN-DEMO-04'],
    ['item-rm-plt', 'wh-wip-cutting', 450, 68.5, 'issue', 'MOVE_TO_WIP', 'WIP-DEMO-01'],
    ['item-rm-plt', 'wh-wip-welding', 320, 68.5, 'issue', 'MOVE_TO_WIP', 'WIP-DEMO-02'],
    ['item-sa-tank-asm', 'wh-wip-assembly', 1, 0, 'inward', 'SA_RECEIPT', 'SA-DEMO-01'],
    ['item-sa-chassis', 'wh-wip-assembly', 1, 0, 'inward', 'SA_RECEIPT', 'SA-DEMO-02'],
    ['item-fg-bulker', 'wh-fg-yard', 1, 2850000, 'inward', 'FG_RECEIPT', 'FG-DEMO-01'],
    ['item-bo-tyre', 'wh-qc-hold', 2, 22500, 'issue', 'ADJ', 'QC-HOLD-DEMO'],
    ['item-rm-plate-12', 'wh-rm-main', 1800, 66, 'opening', 'OPN', 'FY26-DEMO-02'],
    ['item-bo-hub', 'wh-bo-main', 8, 14500, 'inward', 'GRN', 'GRN-DEMO-05'],
    ['item-rm-channel', 'wh-rm-main', 120, 890, 'opening', 'OPN', 'FY26-DEMO-03'],
    ['item-rm-zinc', 'wh-cons', 40, 385, 'inward', 'GRN', 'GRN-DEMO-06'],
  ]

  for (let i = 0; i < pairs.length; i++) {
    const [itemId, warehouseId, qty, rate, movementType, referenceType, referenceNo] = pairs[i]
    moves.push({
      id: `demo-mov-${String(i + 1).padStart(3, '0')}`,
      movementNo: `MOV-DEMO-${String(i + 1).padStart(4, '0')}`,
      movementDate: '2026-06-01',
      movementType: movementType as StockMovement['movementType'],
      itemId,
      warehouseId,
      qty: movementType === 'issue' ? -qty : qty,
      rate,
      value: qty * rate,
      balanceAfter: qty,
      referenceType,
      referenceNo,
      workOrderId: null,
      remarks: `Demo factory movement — ${referenceNo}`,
      createdBy: 'Store Admin',
      createdAt: ts,
    })
  }
  return moves
}
