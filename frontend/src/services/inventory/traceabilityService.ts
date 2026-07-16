/**
 * Inventory traceability mock service (Phase 4).
 * Batch, serial, reservations, item ledger, and traceability timeline.
 */

import { useInventoryStore } from '../../store/inventoryStore'
import { useMasterStore } from '../../store/masterStore'
import type {
  BatchFilter,
  BatchSelectionMethod,
  BatchSelectionPreviewLine,
  ChangeReservationInput,
  CreateReservationInput,
  InventoryBatchRecord,
  InventoryReservationRecord,
  InventorySerialRecord,
  InventoryTraceabilityResult,
  ItemLedgerEntry,
  ItemLedgerFilter,
  ReservationFilter,
  ReservationStatus,
  SerialFilter,
  TraceabilityEvent,
} from '../../types/inventoryDomain'
import { InventoryServiceError } from './inventoryService'
import {
  buildDemoBatches,
  buildDemoReservations,
  buildDemoSerials,
  buildItemLedgerFromMovements,
  DEMO_BATCH_ITEM_IDS,
  DEMO_SERIAL_ITEM_IDS,
  genId,
} from './traceabilitySeed'

const delay = (ms = 80) => new Promise<void>((r) => setTimeout(r, ms))

let batches: InventoryBatchRecord[] = []
let serials: InventorySerialRecord[] = []
let reservations: InventoryReservationRecord[] = []
let initialized = false

function ensureInitialized() {
  if (initialized) return
  batches = buildDemoBatches()
  serials = buildDemoSerials()
  reservations = buildDemoReservations(batches)
  initialized = true
}

function getMaster() {
  return useMasterStore.getState()
}

function getInv() {
  return useInventoryStore.getState()
}

function sortBatchesFefo(rows: InventoryBatchRecord[]): InventoryBatchRecord[] {
  return [...rows].sort((a, b) => {
    if (a.qualityStatus !== 'available' && b.qualityStatus === 'available') return 1
    if (a.qualityStatus === 'available' && b.qualityStatus !== 'available') return -1
    return (a.expiryDate ?? '9999-12-31').localeCompare(b.expiryDate ?? '9999-12-31')
  })
}

function matchesBatchFilter(row: InventoryBatchRecord, filter: BatchFilter): boolean {
  if (filter.itemId && row.itemId !== filter.itemId) return false
  if (filter.warehouseId && row.warehouseId !== filter.warehouseId) return false
  if (filter.qualityStatus && filter.qualityStatus !== 'all' && row.qualityStatus !== filter.qualityStatus) return false
  if (filter.search) {
    const q = filter.search.toLowerCase()
    if (!row.batchNo.toLowerCase().includes(q) && !row.itemCode.toLowerCase().includes(q)) return false
  }
  if (filter.expiringWithinDays !== undefined) {
    if (!row.expiryDate) return false
    const days = Math.ceil((new Date(row.expiryDate).getTime() - Date.now()) / 86400000)
    if (days > filter.expiringWithinDays || days < 0) return false
  }
  return true
}

function matchesSerialFilter(row: InventorySerialRecord, filter: SerialFilter): boolean {
  if (filter.itemId && row.itemId !== filter.itemId) return false
  if (filter.warehouseId && row.warehouseId !== filter.warehouseId) return false
  if (filter.status && filter.status !== 'all' && row.status !== filter.status) return false
  if (filter.sourceDocumentNo && row.sourceDocumentNo !== filter.sourceDocumentNo) return false
  if (filter.search) {
    const q = filter.search.toLowerCase()
    if (!row.serialNo.toLowerCase().includes(q) && !row.itemCode.toLowerCase().includes(q)) return false
  }
  return true
}

function matchesReservationFilter(row: InventoryReservationRecord, filter: ReservationFilter): boolean {
  if (filter.itemId && row.itemId !== filter.itemId) return false
  if (filter.warehouseId && row.warehouseId !== filter.warehouseId) return false
  if (filter.source && filter.source !== 'all' && row.source !== filter.source) return false
  if (filter.status && filter.status !== 'all' && row.status !== filter.status) return false
  if (filter.referenceNo && !row.referenceNo.toLowerCase().includes(filter.referenceNo.toLowerCase())) return false
  return true
}

/* ── Batches ── */

export async function getItemBatches(itemId: string, filter: BatchFilter = {}): Promise<InventoryBatchRecord[]> {
  await delay()
  ensureInitialized()
  return batches
    .filter((b) => b.itemId === itemId)
    .filter((b) => matchesBatchFilter(b, filter))
    .sort((a, b) => a.batchNo.localeCompare(b.batchNo))
}

export async function getBatchById(batchId: string): Promise<InventoryBatchRecord | null> {
  await delay()
  ensureInitialized()
  return batches.find((b) => b.id === batchId) ?? null
}

export async function getAvailableBatches(
  itemId: string,
  warehouseId: string,
  qty?: number,
  method: BatchSelectionMethod = 'fefo',
): Promise<BatchSelectionPreviewLine[]> {
  await delay()
  ensureInitialized()
  const available = batches.filter(
    (b) =>
      b.itemId === itemId &&
      b.warehouseId === warehouseId &&
      b.qualityStatus === 'available' &&
      b.availableQty > 0,
  )
  const sorted = method === 'fefo' || method === 'fifo' ? sortBatchesFefo(available) : available
  const targetQty = qty ?? sorted.reduce((s, b) => s + b.availableQty, 0)
  let remaining = targetQty
  return sorted
    .map((b) => {
      const selected = Math.min(remaining, b.availableQty)
      remaining -= selected
      return {
        itemId,
        itemCode: b.itemCode,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        availableQty: b.availableQty,
        selectedQty: selected,
      }
    })
    .filter((b) => b.selectedQty > 0)
}

/* ── Serials ── */

export async function getItemSerials(itemId: string, filter: SerialFilter = {}): Promise<InventorySerialRecord[]> {
  await delay()
  ensureInitialized()
  return serials
    .filter((s) => s.itemId === itemId)
    .filter((s) => matchesSerialFilter(s, filter))
    .sort((a, b) => a.serialNo.localeCompare(b.serialNo))
}

export async function getSerialById(serialId: string): Promise<InventorySerialRecord | null> {
  await delay()
  ensureInitialized()
  return serials.find((s) => s.id === serialId) ?? null
}

export async function getAvailableSerials(
  itemId: string,
  warehouseId: string,
  filter: SerialFilter = {},
): Promise<InventorySerialRecord[]> {
  await delay()
  ensureInitialized()
  return serials
    .filter(
      (s) =>
        s.itemId === itemId &&
        s.warehouseId === warehouseId &&
        s.status === 'available',
    )
    .filter((s) => matchesSerialFilter(s, filter))
}

/* ── Reservations ── */

export async function getReservations(filter: ReservationFilter = {}): Promise<InventoryReservationRecord[]> {
  await delay()
  ensureInitialized()
  return reservations
    .filter((r) => matchesReservationFilter(r, filter))
    .sort((a, b) => a.priority - b.priority || b.createdAt.localeCompare(a.createdAt))
}

export async function createReservationDemo(input: CreateReservationInput): Promise<InventoryReservationRecord> {
  await delay()
  ensureInitialized()
  if (input.qty <= 0) throw new InventoryServiceError('Reservation qty must be positive', 'VALIDATION')

  const master = getMaster()
  const item = master.getItem(input.itemId)
  const wh = master.getWarehouse(input.warehouseId)
  if (!item || !wh) throw new InventoryServiceError('Item or warehouse not found', 'NOT_FOUND')

  const batch = input.batchId ? batches.find((b) => b.id === input.batchId) : null
  const free = getInv().getFreeQty(input.itemId, input.warehouseId)
  const reservedQty = Math.min(input.qty, free)
  const status: ReservationStatus = reservedQty >= input.qty
    ? 'reserved'
    : reservedQty > 0
      ? 'partially_reserved'
      : 'reserved'

  const record: InventoryReservationRecord = {
    id: genId('res'),
    itemId: input.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    warehouseId: input.warehouseId,
    warehouseName: wh.warehouseName,
    batchId: batch?.id ?? null,
    batchNo: batch?.batchNo ?? null,
    qty: input.qty,
    reservedQty,
    source: input.source,
    referenceNo: input.referenceNo,
    priority: input.priority ?? 5,
    status,
    reservationMode: input.reservationMode ?? 'manual',
    createdAt: new Date().toISOString(),
    createdBy: 'Demo User',
  }
  reservations = [record, ...reservations]

  if (batch && reservedQty > 0) {
    batches = batches.map((b) =>
      b.id === batch.id
        ? { ...b, reservedQty: b.reservedQty + reservedQty, availableQty: Math.max(0, b.availableQty - reservedQty) }
        : b,
    )
  }

  return record
}

export async function releaseReservationDemo(id: string): Promise<InventoryReservationRecord> {
  await delay()
  ensureInitialized()
  const idx = reservations.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Reservation not found', 'NOT_FOUND')
  const existing = reservations[idx]
  if (existing.status === 'released' || existing.status === 'cancelled') {
    throw new InventoryServiceError('Reservation already released or cancelled', 'INVALID_STATUS')
  }

  if (existing.batchId) {
    batches = batches.map((b) =>
      b.id === existing.batchId
        ? {
            ...b,
            reservedQty: Math.max(0, b.reservedQty - existing.reservedQty),
            availableQty: b.availableQty + existing.reservedQty,
          }
        : b,
    )
  }

  const updated: InventoryReservationRecord = {
    ...existing,
    status: 'released',
    reservedQty: 0,
  }
  reservations[idx] = updated
  return updated
}

export async function changeReservationDemo(
  id: string,
  patch: ChangeReservationInput,
): Promise<InventoryReservationRecord> {
  await delay()
  ensureInitialized()
  const idx = reservations.findIndex((r) => r.id === id)
  if (idx < 0) throw new InventoryServiceError('Reservation not found', 'NOT_FOUND')
  const existing = reservations[idx]
  if (!['reserved', 'partially_reserved'].includes(existing.status)) {
    throw new InventoryServiceError('Only active reservations can be changed', 'INVALID_STATUS')
  }

  const master = getMaster()
  const whId = patch.warehouseId ?? existing.warehouseId
  const wh = master.getWarehouse(whId)
  const batch = patch.batchId !== undefined
    ? (patch.batchId ? batches.find((b) => b.id === patch.batchId) : null)
    : (existing.batchId ? batches.find((b) => b.id === existing.batchId) : null)

  const qty = patch.qty ?? existing.qty
  const updated: InventoryReservationRecord = {
    ...existing,
    warehouseId: whId,
    warehouseName: wh?.warehouseName ?? existing.warehouseName,
    batchId: batch?.id ?? null,
    batchNo: batch?.batchNo ?? null,
    qty,
    reservedQty: Math.min(qty, getInv().getFreeQty(existing.itemId, whId)),
    priority: patch.priority ?? existing.priority,
    status: qty > existing.reservedQty ? 'partially_reserved' : 'reserved',
  }
  reservations[idx] = updated
  return updated
}

/* ── Item ledger ── */

export async function getItemLedger(itemId: string, filter: ItemLedgerFilter = {}): Promise<ItemLedgerEntry[]> {
  await delay()
  ensureInitialized()
  const movements = getInv().getItemMovements(itemId, filter.warehouseId)
  let rows = buildItemLedgerFromMovements(itemId, movements, batches)

  if (filter.transactionType && filter.transactionType !== 'all') {
    rows = rows.filter((r) => r.transactionType === filter.transactionType)
  }
  if (filter.batchNo) rows = rows.filter((r) => r.batchNo === filter.batchNo)
  if (filter.serialNo) rows = rows.filter((r) => r.serialNo === filter.serialNo)
  if (filter.dateFrom) rows = rows.filter((r) => r.transactionDate >= filter.dateFrom!)
  if (filter.dateTo) rows = rows.filter((r) => r.transactionDate <= filter.dateTo!)
  if (filter.search) {
    const q = filter.search.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.documentNo.toLowerCase().includes(q) ||
        r.remarks.toLowerCase().includes(q) ||
        r.warehouseName.toLowerCase().includes(q),
    )
  }

  return rows.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
}

/* ── Traceability ── */

export async function getInventoryTraceability(
  entityType: 'item' | 'batch' | 'serial',
  entityId: string,
): Promise<InventoryTraceabilityResult | null> {
  await delay()
  ensureInitialized()
  const inv = getInv()
  const events: TraceabilityEvent[] = []

  if (entityType === 'batch') {
    const batch = batches.find((b) => b.id === entityId)
    if (!batch) return null

    events.push({
      id: genId('tev'),
      eventDate: batch.receiptDate,
      eventType: 'receipt',
      eventLabel: 'Batch received',
      documentNo: batch.sourceDocumentNo,
      documentHref: `/purchase/grn`,
      warehouseName: batch.warehouseName,
      qty: batch.availableQty + batch.reservedQty,
      userName: 'Store Admin',
      status: batch.qualityStatus,
    })

    for (const m of inv.getItemMovements(batch.itemId, batch.warehouseId).slice(0, 8)) {
      events.push({
        id: m.id,
        eventDate: m.movementDate,
        eventType: m.qty > 0 ? 'receipt' : 'issue',
        eventLabel: m.qty > 0 ? 'Stock receipt' : 'Stock issue',
        documentNo: m.referenceNo || m.movementNo,
        documentHref: m.referenceNo.startsWith('IR-')
          ? `/inventory/movements/receipts`
          : m.referenceNo.startsWith('IS-')
            ? `/inventory/movements/issues`
            : null,
        warehouseName: batch.warehouseName,
        qty: Math.abs(m.qty),
        userName: m.createdBy,
        status: null,
      })
    }

    return {
      entityType: 'batch',
      entityId,
      entityLabel: `${batch.batchNo} — ${batch.itemCode}`,
      events: events.sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    }
  }

  if (entityType === 'serial') {
    const serial = serials.find((s) => s.id === entityId)
    if (!serial) return null

    events.push({
      id: genId('tev'),
      eventDate: serial.receiptDate ?? new Date().toISOString().slice(0, 10),
      eventType: 'receipt',
      eventLabel: 'Serial registered',
      documentNo: serial.sourceDocumentNo ?? '—',
      documentHref: serial.sourceDocumentType === 'GRN' ? '/purchase/grn' : '/work-orders',
      warehouseName: serial.warehouseName,
      qty: 1,
      userName: 'Store Admin',
      status: serial.status,
    })

    if (serial.status === 'issued' || serial.status === 'in_production') {
      events.push({
        id: genId('tev'),
        eventDate: new Date().toISOString().slice(0, 10),
        eventType: 'issue',
        eventLabel: 'Issued to production',
        documentNo: 'WO-2026-0012',
        documentHref: '/work-orders',
        warehouseName: serial.warehouseName,
        qty: 1,
        userName: 'Production Supervisor',
        status: serial.status,
      })
    }

    return {
      entityType: 'serial',
      entityId,
      entityLabel: serial.serialNo,
      events,
    }
  }

  // item traceability
  const master = getMaster()
  const item = master.getItem(entityId)
  if (!item) return null

  for (const m of inv.getItemMovements(entityId).slice(0, 15)) {
    const wh = master.getWarehouse(m.warehouseId)
    events.push({
      id: m.id,
      eventDate: m.movementDate,
      eventType: m.qty > 0 ? 'receipt' : 'issue',
      eventLabel: m.referenceType,
      documentNo: m.referenceNo || m.movementNo,
      documentHref: m.referenceNo.startsWith('IR-')
        ? `/inventory/movements/receipts`
        : m.referenceNo.startsWith('IS-')
          ? `/inventory/movements/issues`
          : m.referenceType === 'GRN'
            ? '/purchase/grn'
            : null,
      warehouseName: wh?.warehouseName ?? null,
      qty: Math.abs(m.qty),
      userName: m.createdBy,
      status: null,
    })
  }

  for (const r of reservations.filter((res) => res.itemId === entityId).slice(0, 5)) {
    events.push({
      id: r.id,
      eventDate: r.createdAt.slice(0, 10),
      eventType: 'reservation',
      eventLabel: `Reservation — ${r.source}`,
      documentNo: r.referenceNo,
      documentHref: r.source === 'SO' ? '/sales/sales-orders' : r.source === 'PO' ? '/purchase/orders' : null,
      warehouseName: r.warehouseName,
      qty: r.reservedQty,
      userName: r.createdBy,
      status: r.status,
    })
  }

  return {
    entityType: 'item',
    entityId,
    entityLabel: `${item.itemCode} — ${item.itemName}`,
    events: events.sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
  }
}

/** Apply demo batch/serial flags to inventory extensions */
export function applyDemoTrackingFlags(
  setExtension: (itemId: string, flags: { batchTracking?: boolean; serialTracking?: boolean; expiryTracking?: boolean }) => void,
) {
  for (const id of DEMO_BATCH_ITEM_IDS) {
    setExtension(id, { batchTracking: true, expiryTracking: id.includes('primer') || id.includes('thinner') })
  }
  for (const id of DEMO_SERIAL_ITEM_IDS) {
    setExtension(id, { serialTracking: true })
  }
}

export function resetTraceabilityServiceForTests() {
  batches = []
  serials = []
  reservations = []
  initialized = false
}

export { DEMO_BATCH_ITEM_IDS, DEMO_SERIAL_ITEM_IDS }
