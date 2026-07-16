/** Movement types — ledger is the single source of truth for on-hand stock */
export type StockMovementType = 'opening' | 'inward' | 'issue' | 'adjustment'

/** Business reference subtype stored on movement.referenceType */
export type StockReferenceType =
  | 'OPN'
  | 'INW'
  | 'ISS'
  | 'ADJ'
  | 'GRN'
  | 'ISSUE_TO_WO'
  | 'WIP_RECEIVE'
  | 'WIP_TRANSFER'
  | 'MOVE_TO_WIP'
  | 'MOVE_FROM_WIP'
  | 'SA_RECEIPT'
  | 'FG_RECEIPT'
  | 'DISPATCH'
  | 'FG_DISPATCH'
  | 'SUBCON_OUT'
  | 'SUBCON_IN'

export interface StockMovement {
  id: string
  movementNo: string
  movementDate: string
  movementType: StockMovementType
  itemId: string
  warehouseId: string
  qty: number
  rate: number
  value: number
  balanceAfter: number
  referenceType: StockReferenceType | string
  referenceNo: string
  workOrderId: string | null
  /** Source SA work order when movement is SA_RECEIPT */
  sourceWoId?: string | null
  /** Parent FG work order consuming the semi-finished item */
  parentWoId?: string | null
  remarks: string
  createdBy: string
  createdAt: string
}

/** @deprecated Use StockMovement — kept for gradual UI migration */
export type StockLedgerEntry = StockMovement
export type StockTxnType = StockMovementType

export type ReservationDemandType = 'SO' | 'WO'

export interface StockReservation {
  id: string
  itemId: string
  warehouseId: string
  qty: number
  demandType: ReservationDemandType
  demandId: string
  referenceNo: string
  remarks: string
  status: 'active' | 'fulfilled' | 'cancelled'
  createdAt: string
  updatedAt: string
}

/** Derived snapshot — never stored as source of truth */
export interface StockBalanceSnapshot {
  itemId: string
  warehouseId: string
  onHand: number
  reservedQty: number
  freeQty: number
}

export interface StockPositionEnriched {
  itemId: string
  itemCode: string
  itemName: string
  categoryName: string
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  uomCode: string
  onHand: number
  reservedQty: number
  freeQty: number
  /** Display aggregates computed from movement ledger */
  openingQty: number
  inwardQty: number
  issuedQty: number
  adjustmentQty: number
  reorderLevel: number
  standardRate: number
  stockValue: number
  isLowStock: boolean
}
