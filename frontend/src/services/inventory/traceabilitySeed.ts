import { useInventoryStore } from '../../store/inventoryStore'
import { useMasterStore } from '../../store/masterStore'
import type {
  BatchQualityStatus,
  InventoryBatchRecord,
  InventoryReservationRecord,
  InventorySerialRecord,
  InventorySerialStatus,
  ItemLedgerEntry,
  ItemLedgerTransactionType,
  ReservationSource,
  ReservationStatus,
} from '../../types/inventoryDomain'
import type { StockMovement } from '../../types/inventory'
import { DEMO_QUALITY_HOLD } from './inventorySeed'

/** Items that get batch tracking in demo seed */
export const DEMO_BATCH_ITEM_IDS = new Set([
  'item-rm-plt',
  'item-rm-primer',
  'item-rm-thinner',
  'item-bo-tyre',
  'item-bo-valve',
])

/** Items that get serial tracking in demo seed */
export const DEMO_SERIAL_ITEM_IDS = new Set([
  'item-fg-bulker',
  'item-fg-iso',
  'item-fg-sidewall',
  'item-bo-axl',
])

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function mapRefTypeToLedgerType(refType: string, qty: number): ItemLedgerTransactionType {
  if (refType === 'OPN') return 'opening_balance'
  if (refType === 'GRN' || refType === 'INW' || refType === 'FG_RECEIPT' || refType === 'SUBCON_IN') return 'receipt'
  if (refType === 'ISS' || refType === 'ISSUE_TO_WO' || refType === 'FG_DISPATCH' || refType === 'SUBCON_OUT') return 'issue'
  if (refType === 'ADJ' && qty > 0) return 'adjustment_in'
  if (refType === 'ADJ' && qty < 0) return 'adjustment_out'
  if (refType === 'WIP_TRANSFER' && qty > 0) return 'transfer_in'
  if (refType === 'WIP_TRANSFER' && qty < 0) return 'transfer_out'
  return qty >= 0 ? 'receipt' : 'issue'
}

function documentHref(refType: string, refNo: string): string | null {
  if (refNo.startsWith('IR-')) return `/inventory/movements/receipts/${refNo}`
  if (refNo.startsWith('IS-')) return `/inventory/movements/issues/${refNo}`
  if (refType === 'GRN') return `/purchase/grn`
  if (refType === 'ISSUE_TO_WO' || refType === 'FG_RECEIPT') return `/work-orders`
  return null
}

export function buildDemoBatches(): InventoryBatchRecord[] {
  const master = useMasterStore.getState()
  const inv = useInventoryStore.getState()
  const batches: InventoryBatchRecord[] = []
  const today = new Date().toISOString().slice(0, 10)

  for (const itemId of DEMO_BATCH_ITEM_IDS) {
    const item = master.getItem(itemId)
    if (!item) continue
    for (const wh of master.warehouses.filter((w) => w.isActive)) {
      const onHand = inv.getOnHand(itemId, wh.id)
      if (onHand <= 0) continue
      const qh = DEMO_QUALITY_HOLD[itemId] ?? 0
      const batch1Qty = Math.ceil(onHand * 0.6)
      const batch2Qty = onHand - batch1Qty
      const statuses: BatchQualityStatus[] = qh > 0 ? ['quality_hold', 'available'] : ['available', 'available']

      if (batch1Qty > 0) {
        batches.push({
          id: `batch-${itemId}-${wh.id}-1`,
          batchNo: `B-${item.itemCode}-001`,
          supplierBatchNo: `SB-${item.itemCode}-2026A`,
          itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          manufacturingDate: '2026-01-15',
          expiryDate: item.itemCode.includes('primer') || item.itemCode.includes('thinner')
            ? '2027-03-31'
            : '2028-06-30',
          receiptDate: '2026-03-10',
          warehouseId: wh.id,
          warehouseName: wh.warehouseName,
          availableQty: Math.max(0, batch1Qty - (statuses[0] === 'quality_hold' ? qh : 0)),
          reservedQty: Math.min(2, batch1Qty),
          qualityStatus: statuses[0],
          sourceDocumentType: 'GRN',
          sourceDocumentNo: 'GRN-2026-0042',
        })
      }
      if (batch2Qty > 0) {
        batches.push({
          id: `batch-${itemId}-${wh.id}-2`,
          batchNo: `B-${item.itemCode}-002`,
          supplierBatchNo: `SB-${item.itemCode}-2026B`,
          itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          manufacturingDate: '2026-04-01',
          expiryDate: item.itemCode.includes('primer') || item.itemCode.includes('thinner')
            ? '2027-09-30'
            : '2028-12-31',
          receiptDate: today,
          warehouseId: wh.id,
          warehouseName: wh.warehouseName,
          availableQty: batch2Qty,
          reservedQty: 0,
          qualityStatus: statuses[1],
          sourceDocumentType: 'GRN',
          sourceDocumentNo: 'GRN-2026-0058',
        })
      }
    }
  }
  return batches
}

export function buildDemoSerials(): InventorySerialRecord[] {
  const master = useMasterStore.getState()
  const inv = useInventoryStore.getState()
  const serials: InventorySerialRecord[] = []
  const today = new Date().toISOString().slice(0, 10)

  for (const itemId of DEMO_SERIAL_ITEM_IDS) {
    const item = master.getItem(itemId)
    if (!item) continue
    for (const wh of master.warehouses.filter((w) => w.isActive)) {
      const onHand = inv.getOnHand(itemId, wh.id)
      if (onHand <= 0) continue
      const count = Math.min(Math.floor(onHand), itemId.startsWith('item-fg') ? 3 : 2)
      const statuses: InventorySerialStatus[] = itemId.startsWith('item-fg')
        ? ['available', 'in_production', 'sold']
        : ['available', 'issued']

      for (let i = 0; i < count; i++) {
        serials.push({
          id: `ser-${itemId}-${wh.id}-${i + 1}`,
          serialNo: `SN-${item.itemCode}-${String(i + 1).padStart(3, '0')}`,
          itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          warehouseId: wh.id,
          warehouseName: wh.warehouseName,
          status: statuses[i] ?? 'available',
          sourceDocumentType: itemId.startsWith('item-fg') ? 'Production Output' : 'GRN',
          sourceDocumentNo: itemId.startsWith('item-fg') ? 'WO-2026-0012' : 'GRN-2026-0042',
          receiptDate: today,
        })
      }
    }
  }
  return serials
}

function mapStoreReservationStatus(status: string, qty: number, reservedQty: number): ReservationStatus {
  if (status === 'cancelled') return 'cancelled'
  if (status === 'fulfilled') return 'consumed'
  if (reservedQty < qty) return 'partially_reserved'
  return 'reserved'
}

function mapDemandToSource(demandType: string): ReservationSource {
  if (demandType === 'SO') return 'SO'
  if (demandType === 'WO') return 'PROJECT'
  return 'SO'
}

export function buildDemoReservations(batches: InventoryBatchRecord[]): InventoryReservationRecord[] {
  const master = useMasterStore.getState()
  const inv = useInventoryStore.getState()
  const records: InventoryReservationRecord[] = []

  for (const r of inv.reservations) {
    const item = master.getItem(r.itemId)
    const wh = master.getWarehouse(r.warehouseId)
    const batch = batches.find((b) => b.itemId === r.itemId && b.warehouseId === r.warehouseId)
    records.push({
      id: r.id,
      itemId: r.itemId,
      itemCode: item?.itemCode ?? '—',
      itemName: item?.itemName ?? '—',
      warehouseId: r.warehouseId,
      warehouseName: wh?.warehouseName ?? '—',
      batchId: batch?.id ?? null,
      batchNo: batch?.batchNo ?? null,
      qty: r.qty,
      reservedQty: r.status === 'active' ? r.qty : 0,
      source: mapDemandToSource(r.demandType),
      referenceNo: r.referenceNo,
      priority: r.demandType === 'SO' ? 1 : 2,
      status: mapStoreReservationStatus(r.status, r.qty, r.status === 'active' ? r.qty : 0),
      reservationMode: 'auto',
      createdAt: r.createdAt,
      createdBy: 'Demo User',
    })
  }

  // Additional contextual demo reservations
  const plateBatch = batches.find((b) => b.itemId === 'item-rm-plt')
  if (plateBatch) {
    records.push({
      id: 'res-demo-po-001',
      itemId: plateBatch.itemId,
      itemCode: plateBatch.itemCode,
      itemName: plateBatch.itemName,
      warehouseId: plateBatch.warehouseId,
      warehouseName: plateBatch.warehouseName,
      batchId: plateBatch.id,
      batchNo: plateBatch.batchNo,
      qty: 500,
      reservedQty: 500,
      source: 'PO',
      referenceNo: 'PO-2026-0088',
      priority: 2,
      status: 'reserved',
      reservationMode: 'manual',
      createdAt: new Date().toISOString(),
      createdBy: 'Planning User',
    })
  }

  records.push({
    id: 'res-demo-transfer-001',
    itemId: 'item-bo-tyre',
    itemCode: 'TYRE-295-80R22',
    itemName: 'Tyre 295/80R22.5',
    warehouseId: 'wh-bo-main',
    warehouseName: 'Bought-Out Store',
    batchId: batches.find((b) => b.itemId === 'item-bo-tyre')?.id ?? null,
    batchNo: batches.find((b) => b.itemId === 'item-bo-tyre')?.batchNo ?? null,
    qty: 4,
    reservedQty: 4,
    source: 'TRANSFER',
    referenceNo: 'TRF-2026-0015',
    priority: 3,
    status: 'reserved',
    reservationMode: 'auto',
    createdAt: new Date().toISOString(),
    createdBy: 'Store User',
  })

  return records
}

export function buildItemLedgerFromMovements(
  itemId: string,
  movements: StockMovement[],
  batches: InventoryBatchRecord[],
): ItemLedgerEntry[] {
  const master = useMasterStore.getState()
  const itemBatches = batches.filter((b) => b.itemId === itemId)
  const sorted = [...movements]
    .filter((m) => m.itemId === itemId)
    .sort((a, b) => new Date(a.movementDate).getTime() - new Date(b.movementDate).getTime())

  return sorted.map((m) => {
    const wh = master.getWarehouse(m.warehouseId)
    const txnType = mapRefTypeToLedgerType(m.referenceType, m.qty)
    const batch = itemBatches.find((b) => b.warehouseId === m.warehouseId)
    return {
      id: m.id,
      itemId: m.itemId,
      transactionDate: m.movementDate,
      transactionType: txnType,
      documentNo: m.referenceNo || m.movementNo,
      documentType: m.referenceType,
      documentHref: documentHref(m.referenceType, m.referenceNo || m.movementNo),
      warehouseId: m.warehouseId,
      warehouseName: wh?.warehouseName ?? '—',
      batchNo: batch?.batchNo ?? null,
      serialNo: null,
      qtyIn: m.qty > 0 ? m.qty : 0,
      qtyOut: m.qty < 0 ? Math.abs(m.qty) : 0,
      balance: m.balanceAfter,
      unitCost: m.rate,
      value: m.value,
      userId: 'user-demo',
      userName: m.createdBy,
      remarks: m.remarks,
    }
  })
}

export { genId }
