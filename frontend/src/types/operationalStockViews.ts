/**
 * Consolidated operational views — summary truth over immutable documents.
 * Balances = operational SoT; GRN/PO/ledger rows remain unmerged audit trails.
 */

export type StockHealthStatus = 'healthy' | 'low' | 'out' | 'negative' | 'overstock'

export interface ConsolidatedStockRow {
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  onHand: number
  reserved: number
  available: number
  incoming: number
  avgCost: number
  stockValue: number
  reorderLevel: number
  status: StockHealthStatus
}

export interface GrnReceiptLineSummary {
  grnId: string
  grnNumber: string
  receiptDate: string
  vendorId: string
  vendorName: string
  warehouseId: string
  warehouseName: string
  qty: number
  rate: number
  amount: number
  status: string
  href: string
}

export interface ItemReceiptSummary {
  itemId: string
  totalReceipts: number
  totalQtyReceived: number
  averagePurchaseRate: number
  lastPurchaseDate: string | null
  vendorCount: number
  grnCount: number
  grns: GrnReceiptLineSummary[]
}

export interface ItemPurchaseSummary {
  itemId: string
  totalOrdered: number
  totalReceived: number
  pendingQty: number
  rejectedQty: number
  returnedQty: number
  invoicePendingQty: number
  outstandingPoCount: number
}

export interface WarehouseOpsSummary {
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  totalItems: number
  totalStockQty: number
  totalStockValue: number
  incomingQty: number
  outgoingQty: number
  reservedQty: number
  lowStockItems: number
  negativeStockItems: number
}

export interface VendorOpsSummary {
  vendorId: string
  vendorCode: string
  vendorName: string
  totalOrders: number
  totalGrns: number
  totalQtySupplied: number
  averageRate: number
  lastSupplyDate: string | null
  delayedDeliveries: number
  rejectedQty: number
}

export type ItemTimelineKind =
  | 'po'
  | 'grn'
  | 'qc'
  | 'issue'
  | 'transfer'
  | 'return'
  | 'receipt'
  | 'count'
  | 'reservation'
  | 'other'

export interface ItemTimelineEvent {
  id: string
  at: string
  kind: ItemTimelineKind
  title: string
  subtitle?: string
  href?: string
  qty?: number
  meta?: string
}

export interface WarehouseStockSlice {
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  onHand: number
  reserved: number
  available: number
  incoming: number
  avgCost: number
  stockValue: number
}

export interface BatchStockSlice {
  batchNo: string
  warehouseName: string
  qty: number
  status: string
  expiryDate?: string | null
}

/** Document/tracking master serial — not a second stock balance table. */
export interface SerialStockSlice {
  serialNo: string
  warehouseName: string
  status: string
  /** Source: tracking master vs receipt document line */
  source: 'master' | 'document'
  sourceDocumentNo?: string | null
  href?: string
}

export interface BinStockSlice {
  binCode: string
  warehouseName: string
  qty: number
  note?: string
  /** From GRN/doc lines only */
  sourceDocumentNo?: string
  href?: string
}

export interface ItemStock360 {
  itemId: string
  itemCode: string
  itemName: string
  uom: string
  overview: {
    onHand: number
    reserved: number
    available: number
    incoming: number
    avgCost: number
    stockValue: number
    reorderLevel: number
    status: StockHealthStatus
  }
  warehouses: WarehouseStockSlice[]
  batches: BatchStockSlice[]
  serials: SerialStockSlice[]
  bins: BinStockSlice[]
  receiptSummary: ItemReceiptSummary
  purchaseSummary: ItemPurchaseSummary
  receipts: GrnReceiptLineSummary[]
  issues: Array<{
    id: string
    date: string
    number: string
    qty: number
    reference: string
    href?: string
  }>
  transfers: Array<{
    id: string
    date: string
    number: string
    fromWh: string
    toWh: string
    qty: number
    href?: string
  }>
  reservations: Array<{
    id: string
    qty: number
    demandType: string
    referenceNo: string
    warehouseName: string
    status: string
  }>
  timeline: ItemTimelineEvent[]
}

export interface OperationalAnalytics {
  topPurchasedItems: Array<{ itemId: string; itemCode: string; itemName: string; qty: number; amount: number }>
  mostReceivedItems: Array<{ itemId: string; itemCode: string; itemName: string; qty: number; grnCount: number }>
  vendorWiseReceipts: Array<{ vendorId: string; vendorName: string; qty: number; grnCount: number; amount: number }>
  warehouseStock: Array<{ warehouseId: string; warehouseName: string; onHand: number; value: number }>
  purchaseTrend: Array<{ period: string; poCount: number; orderedQty: number }>
  grnTrend: Array<{ period: string; grnCount: number; receivedQty: number }>
  receiptFrequency: Array<{ itemId: string; itemCode: string; receiptsPerMonth: number }>
}

export interface ItemSearchSnapshot {
  itemId: string
  itemCode: string
  itemName: string
  currentStock: number
  available: number
  avgCost: number
  warehouses: WarehouseStockSlice[]
  recentReceipts: GrnReceiptLineSummary[]
  recentIssues: ItemStock360['issues']
  pendingPurchaseOrders: Array<{
    poId: string
    poNumber: string
    pendingQty: number
    href: string
  }>
}

/** One unmerged GRN line contribution toward a PO line receipt rollup. */
export interface PoLineReceiptGrnContribution {
  grnId: string
  grnLineId: string
  grnNumber: string
  receiptDate: string
  vendorId: string
  vendorName: string
  qty: number
  acceptedQty: number
  rejectedQty: number
  rate: number
  amount: number
  status: string
  href: string
}

/** Per PO line operational receipt summary + drill-down GRNs (never merged docs). */
export interface PoLineReceiptRollup {
  poLineId: string
  lineNo: number
  itemId: string
  itemCode: string
  itemName: string
  uom: string
  orderedQty: number
  receivedQty: number
  pendingQty: number
  rejectedQty: number
  rate: number
  amount: number
  grnCount: number
  grns: PoLineReceiptGrnContribution[]
}

export interface PurchaseOrderReceiptRollup {
  purchaseOrderId: string
  purchaseOrderNumber: string
  grnDocumentCount: number
  lines: PoLineReceiptRollup[]
}
