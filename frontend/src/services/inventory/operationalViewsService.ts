/**
 * Consolidated operational views — FE aggregation only.
 * Balances = operational SoT; GRN/PO/ledger docs remain unmerged audit trails.
 */
import { isApiMode } from '../../config/apiConfig'
import * as inventoryApi from '../api/inventoryApi'
import {
  getGRNs,
  getPurchaseOrders,
  getPurchaseReturns,
  getVendors,
} from '../purchase'
import type { GoodsReceiptNote, PurchaseOrder, PurchaseReturn } from '../../types/purchaseDomain'
import type {
  BatchStockSlice,
  SerialStockSlice,
  ConsolidatedStockRow,
  GrnReceiptLineSummary,
  ItemPurchaseSummary,
  ItemReceiptSummary,
  ItemSearchSnapshot,
  ItemStock360,
  ItemTimelineEvent,
  OperationalAnalytics,
  StockHealthStatus,
  VendorOpsSummary,
  WarehouseOpsSummary,
  WarehouseStockSlice,
} from '../../types/operationalStockViews'
import { getItemById, getItems, getStockAvailability } from './inventoryService'
import { inventoryApiFacade } from './inventoryApiFacade'
import { getItemBatches, getItemSerials } from './traceabilityService'
import { getIssues, getIssueById } from './movementService'
import type { InventoryStockBalance } from '../api/inventoryApi'

export type ConsolidatedStockFilter = {
  search?: string
  warehouseId?: string
  itemId?: string
  status?: StockHealthStatus | 'all'
  lowStock?: boolean
  outOfStock?: boolean
}

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function periodKey(iso: string | null | undefined): string {
  if (!iso) return 'unknown'
  return iso.slice(0, 7)
}

export function stockHealthStatus(
  onHand: number,
  available: number,
  reorder: number,
  max?: number,
): StockHealthStatus {
  if (onHand < 0 || available < 0) return 'negative'
  if (onHand === 0) return 'out'
  if (reorder > 0 && onHand <= reorder) return 'low'
  if (max != null && max > 0 && onHand > max) return 'overstock'
  return 'healthy'
}

function grnHref(id: string) {
  return `/purchase/grn/${id}`
}

function poHref(id: string) {
  return `/purchase/orders/${id}`
}

function isOpenPoStatus(status: string): boolean {
  const s = status.toLowerCase()
  return !['cancelled', 'closed', 'fully_received', 'fullyreceived', 'rejected', 'draft'].includes(s)
}

/** Extract one summary row per GRN line for an item (never merges qty across GRNs). */
function extractReceiptLines(
  grns: GoodsReceiptNote[],
  itemId?: string,
): GrnReceiptLineSummary[] {
  const out: GrnReceiptLineSummary[] = []
  for (const grn of grns) {
    for (const line of grn.lines ?? []) {
      if (itemId && line.itemId !== itemId) continue
      const qty = num(line.receivedQty ?? line.acceptedQty)
      if (qty === 0 && itemId) {
        /* still include zero-received lines when drilling a specific item if present on GRN */
      }
      out.push({
        grnId: grn.id,
        grnNumber: grn.documentNumber,
        receiptDate: grn.documentDate,
        vendorId: grn.vendor?.id ?? '',
        vendorName: grn.vendor?.name ?? '—',
        warehouseId: line.warehouseId || grn.warehouseId || '',
        warehouseName: line.warehouseName || grn.warehouseName || '—',
        qty,
        rate: num(line.rate),
        amount: num(line.taxableAmount) || qty * num(line.rate),
        status: String(grn.status ?? ''),
        href: grnHref(grn.id),
      })
    }
  }
  return out.sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))
}

function buildReceiptSummary(itemId: string, lines: GrnReceiptLineSummary[]): ItemReceiptSummary {
  const withQty = lines.filter((l) => l.qty > 0)
  const totalQty = withQty.reduce((s, l) => s + l.qty, 0)
  const totalAmt = withQty.reduce((s, l) => s + l.amount, 0)
  const vendorIds = new Set(withQty.map((l) => l.vendorId).filter(Boolean))
  const grnIds = new Set(withQty.map((l) => l.grnId))
  const last = withQty[0]?.receiptDate ?? null
  return {
    itemId,
    totalReceipts: withQty.length,
    totalQtyReceived: totalQty,
    averagePurchaseRate: totalQty > 0 ? totalAmt / totalQty : 0,
    lastPurchaseDate: last,
    vendorCount: vendorIds.size,
    grnCount: grnIds.size,
    grns: lines,
  }
}

function buildPurchaseSummary(
  itemId: string,
  pos: PurchaseOrder[],
  grns: GoodsReceiptNote[],
  returns: PurchaseReturn[],
): ItemPurchaseSummary {
  let totalOrdered = 0
  let pendingQty = 0
  let outstandingPoCount = 0
  let invoicePendingQty = 0

  for (const po of pos) {
    let poPending = 0
    for (const line of po.lines ?? []) {
      if (line.itemId !== itemId) continue
      const qty = num(line.quantity ?? line.uomQuantity)
      totalOrdered += qty
      const pending =
        num(line.pendingQty) > 0
          ? num(line.pendingQty)
          : Math.max(0, qty - num(line.receivedQty))
      pendingQty += pending
      poPending += pending
      invoicePendingQty += Math.max(0, num(line.receivedQty) - num(line.invoicedQty))
    }
    if (poPending > 0 && isOpenPoStatus(String(po.status))) {
      outstandingPoCount += 1
    }
  }

  let totalReceived = 0
  let rejectedQty = 0
  for (const grn of grns) {
    for (const line of grn.lines ?? []) {
      if (line.itemId !== itemId) continue
      totalReceived += num(line.receivedQty ?? line.acceptedQty)
      rejectedQty += num(line.rejectedQty)
    }
  }

  let returnedQty = 0
  for (const ret of returns) {
    for (const line of ret.lines ?? []) {
      if (line.itemId !== itemId) continue
      returnedQty += num(line.returnQty)
    }
  }

  return {
    itemId,
    totalOrdered,
    totalReceived,
    pendingQty,
    rejectedQty,
    returnedQty,
    invoicePendingQty,
    outstandingPoCount,
  }
}

function computeIncomingByItem(pos: PurchaseOrder[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const po of pos) {
    if (!isOpenPoStatus(String(po.status))) continue
    for (const line of po.lines ?? []) {
      const pending =
        num(line.pendingQty) > 0
          ? num(line.pendingQty)
          : Math.max(0, num(line.quantity) - num(line.receivedQty))
      if (pending <= 0) continue
      map.set(line.itemId, (map.get(line.itemId) ?? 0) + pending)
    }
  }
  return map
}

function computeIncomingByItemWarehouse(pos: PurchaseOrder[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const po of pos) {
    if (!isOpenPoStatus(String(po.status))) continue
    for (const line of po.lines ?? []) {
      const pending =
        num(line.pendingQty) > 0
          ? num(line.pendingQty)
          : Math.max(0, num(line.quantity) - num(line.receivedQty))
      if (pending <= 0) continue
      const key = `${line.itemId}::${line.warehouseId || ''}`
      map.set(key, (map.get(key) ?? 0) + pending)
    }
  }
  return map
}

async function loadBalancesRaw(filter: ConsolidatedStockFilter = {}): Promise<
  Array<{
    itemId: string
    itemCode: string
    itemName: string
    warehouseId: string
    warehouseCode: string
    warehouseName: string
    onHand: number
    reserved: number
    available: number
    avgCost: number
    stockValue: number
    reorderLevel: number
    maxStock?: number
  }>
> {
  if (isApiMode()) {
    const pages: InventoryStockBalance[] = []
    let page = 1
    let totalPages = 1
    while (page <= totalPages && page <= 20) {
      const res = await inventoryApi.listInventoryBalances({
        page,
        limit: 200,
        warehouseId: filter.warehouseId || undefined,
        itemId: filter.itemId || undefined,
      })
      const chunk = Array.isArray(res) ? res : (res as { data?: InventoryStockBalance[] }).data ?? []
      pages.push(...chunk)
      const meta = (res as { meta?: { totalPages?: number } }).meta
      totalPages = meta?.totalPages ?? 1
      page += 1
      if (chunk.length === 0) break
    }

    // Prefer reorder from item master when available
    const itemCache = new Map<string, { reorder: number; max?: number }>()
    const resolveReorder = async (itemId: string) => {
      if (itemCache.has(itemId)) return itemCache.get(itemId)!
      try {
        const item = await getItemById(itemId)
        const meta = {
          reorder: item?.reorderLevel ?? 0,
          max: item?.maximumStock,
        }
        itemCache.set(itemId, meta)
        return meta
      } catch {
        const meta = { reorder: 0, max: undefined as number | undefined }
        itemCache.set(itemId, meta)
        return meta
      }
    }

    const rows = []
    for (const b of pages) {
      const reorderMeta = await resolveReorder(b.itemId)
      const onHand = num(b.onHandQty)
      const reserved = num(b.reservedQty)
      const available = num(b.freeQty ?? b.unrestrictedQty ?? onHand - reserved)
      const avgCost = num(b.avgRate)
      const stockValue = num(b.stockValue) || onHand * avgCost
      rows.push({
        itemId: b.itemId,
        itemCode: b.item?.code ?? '',
        itemName: b.item?.name ?? '',
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse?.code ?? '',
        warehouseName: b.warehouse?.name ?? '',
        onHand,
        reserved,
        available,
        avgCost,
        stockValue,
        reorderLevel: reorderMeta.reorder,
        maxStock: reorderMeta.max,
      })
    }
    return rows
  }

  const stock = await getStockAvailability({
    search: filter.search,
    warehouseId: filter.warehouseId,
    itemId: filter.itemId,
    lowStock: filter.lowStock,
    outOfStock: filter.outOfStock,
  })
  return stock.map((r) => ({
    itemId: r.itemId,
    itemCode: r.itemCode,
    itemName: r.itemName,
    warehouseId: r.warehouseId,
    warehouseCode: r.warehouseCode,
    warehouseName: r.warehouseName,
    onHand: r.onHand,
    reserved: r.reserved,
    available: r.available,
    avgCost: r.onHand > 0 ? r.stockValue / r.onHand : 0,
    stockValue: r.stockValue,
    reorderLevel: r.reorderLevel,
  }))
}

async function loadDocs() {
  const [grns, pos, returns] = await Promise.all([
    getGRNs().catch(() => [] as GoodsReceiptNote[]),
    getPurchaseOrders().catch(() => [] as PurchaseOrder[]),
    getPurchaseReturns().catch(() => [] as PurchaseReturn[]),
  ])
  return { grns, pos, returns }
}

export async function listConsolidatedStock(
  filter: ConsolidatedStockFilter = {},
): Promise<ConsolidatedStockRow[]> {
  const [{ pos }, balances] = await Promise.all([loadDocs(), loadBalancesRaw(filter)])
  const incomingByIw = computeIncomingByItemWarehouse(pos)
  const incomingByItem = computeIncomingByItem(pos)

  let rows: ConsolidatedStockRow[] = balances.map((b) => {
    const incoming =
      incomingByIw.get(`${b.itemId}::${b.warehouseId}`) ??
      (b.warehouseId ? 0 : incomingByItem.get(b.itemId) ?? 0)
    // If line WH empty, fall back to item-level incoming split is not applied — use item-level
    // only when warehouse match is zero: still show 0 for WH-specific unless PO has WH
    const incomingFinal =
      (incomingByIw.get(`${b.itemId}::${b.warehouseId}`) ?? 0) ||
      (!b.warehouseId ? (incomingByItem.get(b.itemId) ?? 0) : 0)
    // Prefer warehouse-matched; if PO lines lack warehouse, allocate item pending onto all WH rows as 0
    // and show total on overview only — WH rows use wh-specific only.
    void incoming
    const status = stockHealthStatus(b.onHand, b.available, b.reorderLevel, b.maxStock)
    return {
      itemId: b.itemId,
      itemCode: b.itemCode,
      itemName: b.itemName,
      warehouseId: b.warehouseId,
      warehouseCode: b.warehouseCode,
      warehouseName: b.warehouseName,
      onHand: b.onHand,
      reserved: b.reserved,
      available: b.available,
      incoming: incomingFinal,
      avgCost: b.avgCost,
      stockValue: b.stockValue,
      reorderLevel: b.reorderLevel,
      status,
    }
  })

  // When PO pending has no warehouse, mirror item-level incoming on first balance row per item
  const itemIncomingShown = new Set<string>()
  rows = rows.map((r) => {
    if (r.incoming > 0) {
      itemIncomingShown.add(r.itemId)
      return r
    }
    const total = incomingByItem.get(r.itemId) ?? 0
    if (total > 0 && !itemIncomingShown.has(r.itemId)) {
      itemIncomingShown.add(r.itemId)
      return { ...r, incoming: total }
    }
    return r
  })

  if (filter.search) {
    const q = filter.search.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.itemCode.toLowerCase().includes(q) ||
        r.itemName.toLowerCase().includes(q) ||
        r.warehouseName.toLowerCase().includes(q) ||
        r.warehouseCode.toLowerCase().includes(q),
    )
  }
  if (filter.warehouseId) rows = rows.filter((r) => r.warehouseId === filter.warehouseId)
  if (filter.itemId) rows = rows.filter((r) => r.itemId === filter.itemId)
  if (filter.status && filter.status !== 'all') rows = rows.filter((r) => r.status === filter.status)
  if (filter.lowStock) rows = rows.filter((r) => r.status === 'low')
  if (filter.outOfStock) rows = rows.filter((r) => r.status === 'out')

  return rows.sort((a, b) => {
    const c = a.itemCode.localeCompare(b.itemCode)
    return c !== 0 ? c : a.warehouseCode.localeCompare(b.warehouseCode)
  })
}

export async function getItemReceiptSummary(itemId: string): Promise<ItemReceiptSummary> {
  const { grns } = await loadDocs()
  const lines = extractReceiptLines(grns, itemId)
  return buildReceiptSummary(itemId, lines)
}

export async function getItemPurchaseSummary(itemId: string): Promise<ItemPurchaseSummary> {
  const { grns, pos, returns } = await loadDocs()
  return buildPurchaseSummary(itemId, pos, grns, returns)
}

export async function listItemPurchaseSummaries(search?: string): Promise<
  Array<ItemPurchaseSummary & { itemCode: string; itemName: string }>
> {
  const { grns, pos, returns } = await loadDocs()
  const itemIds = new Set<string>()
  for (const po of pos) {
    for (const line of po.lines ?? []) itemIds.add(line.itemId)
  }
  for (const grn of grns) {
    for (const line of grn.lines ?? []) itemIds.add(line.itemId)
  }

  const meta = new Map<string, { itemCode: string; itemName: string }>()
  for (const po of pos) {
    for (const line of po.lines ?? []) {
      if (!meta.has(line.itemId)) meta.set(line.itemId, { itemCode: line.itemCode, itemName: line.itemName })
    }
  }
  for (const grn of grns) {
    for (const line of grn.lines ?? []) {
      if (!meta.has(line.itemId)) meta.set(line.itemId, { itemCode: line.itemCode, itemName: line.itemName })
    }
  }

  let rows = [...itemIds].map((id) => {
    const m = meta.get(id) ?? { itemCode: id, itemName: '—' }
    return {
      ...buildPurchaseSummary(id, pos, grns, returns),
      itemCode: m.itemCode,
      itemName: m.itemName,
    }
  })

  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(
      (r) => r.itemCode.toLowerCase().includes(q) || r.itemName.toLowerCase().includes(q),
    )
  }

  return rows.sort((a, b) => b.totalOrdered - a.totalOrdered)
}

export async function listWarehouseOpsSummaries(): Promise<WarehouseOpsSummary[]> {
  const [stock, { pos }, issues] = await Promise.all([
    listConsolidatedStock(),
    loadDocs(),
    isApiMode()
      ? Promise.resolve([] as Array<{ qty?: number }>)
      : getIssues().catch(() => []),
  ])

  const byWh = new Map<string, WarehouseOpsSummary>()
  for (const r of stock) {
    let row = byWh.get(r.warehouseId)
    if (!row) {
      row = {
        warehouseId: r.warehouseId,
        warehouseCode: r.warehouseCode,
        warehouseName: r.warehouseName,
        totalItems: 0,
        totalStockQty: 0,
        totalStockValue: 0,
        incomingQty: 0,
        outgoingQty: 0,
        reservedQty: 0,
        lowStockItems: 0,
        negativeStockItems: 0,
      }
      byWh.set(r.warehouseId, row)
    }
    if (r.onHand !== 0 || r.reserved !== 0 || r.incoming !== 0) row.totalItems += 1
    row.totalStockQty += r.onHand
    row.totalStockValue += r.stockValue
    row.incomingQty += r.incoming
    row.reservedQty += r.reserved
    if (r.status === 'low') row.lowStockItems += 1
    if (r.status === 'negative') row.negativeStockItems += 1
  }

  // Outgoing: list issue rows lack warehouse dims — leave 0 until warehouse-scoped issue API is wired.
  void issues
  void pos

  return [...byWh.values()].sort((a, b) => a.warehouseCode.localeCompare(b.warehouseCode))
}

export async function listVendorOpsSummaries(): Promise<VendorOpsSummary[]> {
  const [{ grns, pos }, vendors] = await Promise.all([
    loadDocs(),
    getVendors().catch(() => [] as Array<{ id: string; vendorCode: string; vendorName: string }>),
  ])

  type Acc = VendorOpsSummary & { rateSum: number; rateQty: number }
  const map = new Map<string, Acc>()

  const ensure = (id: string, code: string, name: string): Acc => {
    let row = map.get(id)
    if (!row) {
      row = {
        vendorId: id,
        vendorCode: code,
        vendorName: name,
        totalOrders: 0,
        totalGrns: 0,
        totalQtySupplied: 0,
        averageRate: 0,
        lastSupplyDate: null,
        delayedDeliveries: 0,
        rejectedQty: 0,
        rateSum: 0,
        rateQty: 0,
      }
      map.set(id, row)
    }
    return row
  }

  for (const v of vendors) {
    ensure(v.id, v.vendorCode ?? '', v.vendorName ?? '—')
  }

  for (const po of pos) {
    const vid = po.vendor?.id
    if (!vid) continue
    const row = ensure(vid, po.vendor.code ?? '', po.vendor.name ?? '—')
    row.totalOrders += 1
    // Delayed if expected delivery date passed and still open
    for (const line of po.lines ?? []) {
      const ed = line.expectedDeliveryDate || po.expectedDeliveryDate
      if (ed && isOpenPoStatus(String(po.status)) && ed < new Date().toISOString().slice(0, 10) && num(line.pendingQty) > 0) {
        row.delayedDeliveries += 1
      }
    }
  }

  const grnIdsByVendor = new Map<string, Set<string>>()
  for (const grn of grns) {
    const vid = grn.vendor?.id ?? ''
    if (!vid) continue
    const row = ensure(vid, grn.vendor?.code ?? '', grn.vendor?.name ?? '—')
    if (!grnIdsByVendor.has(vid)) grnIdsByVendor.set(vid, new Set())
    grnIdsByVendor.get(vid)!.add(grn.id)
    for (const line of grn.lines ?? []) {
      const qty = num(line.receivedQty ?? line.acceptedQty)
      row.totalQtySupplied += qty
      row.rejectedQty += num(line.rejectedQty)
      if (qty > 0) {
        row.rateSum += num(line.rate) * qty
        row.rateQty += qty
      }
    }
    if (!row.lastSupplyDate || grn.documentDate > row.lastSupplyDate) {
      row.lastSupplyDate = grn.documentDate
    }
  }
  for (const [vid, ids] of grnIdsByVendor) {
    const row = map.get(vid)
    if (row) row.totalGrns = ids.size
  }

  return [...map.values()]
    .map(({ rateSum, rateQty, ...rest }) => ({
      ...rest,
      averageRate: rateQty > 0 ? rateSum / rateQty : 0,
    }))
    .filter((v) => v.totalOrders > 0 || v.totalGrns > 0)
    .sort((a, b) => b.totalQtySupplied - a.totalQtySupplied)
}

export async function getItemStock360(itemId: string, warehouseId?: string): Promise<ItemStock360 | null> {
  const item = await getItemById(itemId)
  if (!item && !isApiMode()) return null

  const { grns, pos, returns } = await loadDocs()
  const balances = await loadBalancesRaw({ itemId })
  const filtered = warehouseId
    ? balances.filter((b) => b.warehouseId === warehouseId)
    : balances

  const warehouses: WarehouseStockSlice[] = (warehouseId ? filtered : balances).map((b) => ({
    warehouseId: b.warehouseId,
    warehouseCode: b.warehouseCode,
    warehouseName: b.warehouseName,
    onHand: b.onHand,
    reserved: b.reserved,
    available: b.available,
    incoming: 0,
    avgCost: b.avgCost,
    stockValue: b.stockValue,
  }))

  const incomingMap = computeIncomingByItem(pos)
  const incomingTotal = incomingMap.get(itemId) ?? 0
  if (warehouses.length === 1) warehouses[0].incoming = incomingTotal
  else if (warehouses.length > 0) {
    // Distribute display: put full pending on overview; WH rows keep 0 unless PO WH matches
    const byIw = computeIncomingByItemWarehouse(pos)
    for (const w of warehouses) {
      w.incoming = byIw.get(`${itemId}::${w.warehouseId}`) ?? 0
    }
  }

  const overviewOnHand = filtered.reduce((s, b) => s + b.onHand, 0)
  const overviewReserved = filtered.reduce((s, b) => s + b.reserved, 0)
  const overviewAvailable = filtered.reduce((s, b) => s + b.available, 0)
  const overviewValue = filtered.reduce((s, b) => s + b.stockValue, 0)
  const overviewAvg =
    overviewOnHand > 0
      ? overviewValue / overviewOnHand
      : filtered.find((b) => b.avgCost > 0)?.avgCost ?? item?.averageCost ?? 0
  const reorder = item?.reorderLevel ?? filtered[0]?.reorderLevel ?? 0
  const maxStock = item?.maximumStock

  const receipts = extractReceiptLines(grns, itemId)
  const receiptSummary = buildReceiptSummary(itemId, receipts)
  const purchaseSummary = buildPurchaseSummary(itemId, pos, grns, returns)

  // Batches
  let batches: BatchStockSlice[] = []
  if (isApiMode()) {
    try {
      const lineageRes = await inventoryApi.getInventoryItemLineage(itemId)
      const lineage = lineageRes.data
      for (const batch of lineage.batches ?? []) {
        for (const bal of batch.balances ?? []) {
          if (warehouseId && bal.warehouseId !== warehouseId) continue
          batches.push({
            batchNo: batch.batchNumber,
            warehouseName: warehouses.find((w) => w.warehouseId === bal.warehouseId)?.warehouseName ?? bal.warehouseId,
            qty: num(bal.quantity),
            status: bal.stockStatus,
            expiryDate: batch.expiryDate,
          })
        }
      }
    } catch {
      try {
        const lotsRes = await inventoryApi.listInventoryLots({ itemId, limit: 200 })
        const list = lotsRes.data ?? []
        batches = list
          .filter((l) => !warehouseId || l.warehouseId === warehouseId)
          .map((l) => ({
            batchNo: l.lotNumber,
            warehouseName: warehouses.find((w) => w.warehouseId === l.warehouseId)?.warehouseName ?? '—',
            qty: num(l.quantityOnHand),
            status: l.status,
            expiryDate: l.expiryDate,
          }))
      } catch {
        batches = []
      }
    }
  } else {
    try {
      const demoBatches = await getItemBatches(itemId, warehouseId ? { warehouseId } : {})
      batches = demoBatches.map((b) => ({
        batchNo: b.batchNo,
        warehouseName: b.warehouseName || warehouses.find((w) => w.warehouseId === b.warehouseId)?.warehouseName || '—',
        qty: b.availableQty + b.reservedQty,
        status: b.qualityStatus ?? 'available',
        expiryDate: b.expiryDate,
      }))
    } catch {
      batches = []
    }
    // If still empty, surface batch numbers from GRN lines without merging qty across GRNs
    if (batches.length === 0) {
      for (const grn of grns) {
        for (const line of grn.lines ?? []) {
          if (line.itemId !== itemId) continue
          if (!line.batchNumber && !line.lotNumber) continue
          if (warehouseId && line.warehouseId && line.warehouseId !== warehouseId) continue
          batches.push({
            batchNo: line.batchNumber || line.lotNumber,
            warehouseName: line.warehouseName || grn.warehouseName || '—',
            qty: num(line.receivedQty ?? line.acceptedQty),
            status: String(grn.status),
            expiryDate: line.expiryDate,
          })
        }
      }
    }
  }

  // Bins — document destinations only (no bin balance SoT)
  const bins: ItemStock360['bins'] = []
  const binKey = new Set<string>()
  for (const grn of grns) {
    for (const line of grn.lines ?? []) {
      if (line.itemId !== itemId) continue
      const binCode = (line.bin || line.binId || '').trim()
      if (!binCode) continue
      if (warehouseId && line.warehouseId && line.warehouseId !== warehouseId) continue
      const key = `${binCode}::${line.warehouseId || grn.warehouseId}::${grn.id}`
      if (binKey.has(key)) continue
      binKey.add(key)
      bins.push({
        binCode,
        warehouseName: line.warehouseName || grn.warehouseName || '—',
        qty: num(line.receivedQty ?? line.acceptedQty),
        note: 'From GRN line (document), not a bin balance table',
        sourceDocumentNo: grn.documentNumber,
        href: `/purchase/grn/${grn.id}`,
      })
    }
  }

  // Serials — tracking masters + document references (never a fake consolidated balance)
  let serials: SerialStockSlice[] = []
  if (isApiMode()) {
    try {
      const lineageRes = await inventoryApi.getInventoryItemLineage(itemId)
      const linSerials = lineageRes.data?.serials ?? []
      serials = linSerials
        .filter((s) => !warehouseId || !s.warehouseId || s.warehouseId === warehouseId)
        .map((s) => ({
          serialNo: s.serialNumber,
          warehouseName: warehouses.find((w) => w.warehouseId === s.warehouseId)?.warehouseName ?? (s.warehouseId ? '—' : '—'),
          status: s.status,
          source: 'master' as const,
          sourceDocumentNo: null,
        }))
    } catch {
      try {
        const listRes = await inventoryApi.listInventorySerials({ itemId, limit: 200, warehouseId })
        serials = (listRes.data ?? []).map((s) => ({
          serialNo: s.serialNumber,
          warehouseName: warehouses.find((w) => w.warehouseId === s.warehouseId)?.warehouseName ?? '—',
          status: s.status,
          source: 'master' as const,
          sourceDocumentNo: s.sourceReferenceNo ?? null,
        }))
      } catch {
        serials = []
      }
    }
  } else {
    try {
      const demo = await getItemSerials(itemId, warehouseId ? { warehouseId } : {})
      serials = demo.map((s) => ({
        serialNo: s.serialNo,
        warehouseName: s.warehouseName || warehouses.find((w) => w.warehouseId === s.warehouseId)?.warehouseName || '—',
        status: s.status,
        source: 'master' as const,
        sourceDocumentNo: s.sourceDocumentNo ?? null,
      }))
    } catch {
      serials = []
    }
  }
  // Document serial snapshots from GRNs (unmerged, audit only)
  const serialSeen = new Set(serials.map((s) => s.serialNo.toLowerCase()))
  for (const grn of grns) {
    for (const line of grn.lines ?? []) {
      if (line.itemId !== itemId) continue
      const sn = (line.serialNumber || '').trim()
      if (!sn) continue
      if (warehouseId && line.warehouseId && line.warehouseId !== warehouseId) continue
      const k = sn.toLowerCase()
      if (serialSeen.has(k)) continue
      serialSeen.add(k)
      serials.push({
        serialNo: sn,
        warehouseName: line.warehouseName || grn.warehouseName || '—',
        status: String(grn.status),
        source: 'document',
        sourceDocumentNo: grn.documentNumber,
        href: `/purchase/grn/${grn.id}`,
      })
    }
  }

  // Issues
  let issues: ItemStock360['issues'] = []
  if (isApiMode()) {
    try {
      const ledgerRes = await inventoryApi.listInventoryLedger({
        itemId,
        limit: 100,
        warehouseId: warehouseId || undefined,
      })
      const movements = Array.isArray(ledgerRes)
        ? ledgerRes
        : (ledgerRes as { data?: inventoryApi.InventoryStockMovement[] }).data ?? []
      issues = movements
        .filter((m) => m.movementType === 'ISSUE' || String(m.referenceType).includes('ISSUE'))
        .map((m) => ({
          id: m.id,
          date: m.movementDate?.slice(0, 10) ?? m.createdAt?.slice(0, 10) ?? '',
          number: m.movementNumber,
          qty: num(m.quantity),
          reference: m.referenceNo ?? m.referenceType,
          href: `/inventory/ledger?itemId=${itemId}`,
        }))
    } catch {
      issues = []
    }
  } else {
    try {
      const list = await getIssues()
      const detailed: ItemStock360['issues'] = []
      for (const row of list) {
        try {
          const full = await getIssueById(row.id)
          if (!full) continue
          for (const line of full.lines ?? []) {
            if (line.itemId !== itemId) continue
            detailed.push({
              id: `${full.id}-${line.id}`,
              date: full.documentDate,
              number: full.documentNumber,
              qty: num(line.issuedQty),
              reference: full.sourceDocumentNo ?? full.sourceType ?? '',
              href: `/inventory/movements/issues/${full.id}`,
            })
          }
        } catch {
          /* skip */
        }
      }
      issues = detailed
    } catch {
      issues = []
    }
  }

  // Transfers
  let transfers: ItemStock360['transfers'] = []
  try {
    const tRes = await inventoryApiFacade.listTransfers({ itemId, limit: 100 } as never)
    const tList = Array.isArray(tRes) ? tRes : (tRes as { data?: unknown[] }).data ?? []
    transfers = (tList as Array<Record<string, unknown>>).flatMap((t) => {
      const lines = (t.lines as Array<Record<string, unknown>> | undefined) ?? []
      const matchLines = lines.filter((l) => l.itemId === itemId)
      if (matchLines.length === 0 && t.itemId !== itemId) return []
      const qtyLines = matchLines.length > 0 ? matchLines : [{ qty: t.qty, quantity: t.quantity }]
      return qtyLines.map((line, idx) => ({
        id: `${String(t.id)}-${idx}`,
        date: String(t.documentDate ?? t.transferDate ?? t.createdAt ?? '').slice(0, 10),
        number: String(t.documentNumber ?? t.transferNumber ?? t.id),
        fromWh: String(t.fromWarehouseName ?? t.sourceWarehouseName ?? t.fromWarehouseId ?? '—'),
        toWh: String(t.toWarehouseName ?? t.destinationWarehouseName ?? t.toWarehouseId ?? '—'),
        qty: num((line as { qty?: number; quantity?: number; transferQty?: number }).transferQty
          ?? (line as { qty?: number }).qty
          ?? (line as { quantity?: number }).quantity),
        href: `/inventory/movements/transfers/${String(t.id)}`,
      }))
    })
  } catch {
    transfers = []
  }

  // Reservations
  let reservations: ItemStock360['reservations'] = []
  try {
    const rRes = await inventoryApiFacade.listReservations({ itemId, limit: 100 })
    const rList = Array.isArray(rRes) ? rRes : (rRes as { data?: unknown[] }).data ?? []
    reservations = (rList as Array<Record<string, unknown>>)
      .filter((r) => !warehouseId || r.warehouseId === warehouseId)
      .map((r) => {
        const qtyRaw = r.remainingQty ?? r.qty ?? r.quantity
        return {
          id: String(r.id),
          qty: num(typeof qtyRaw === 'number' || typeof qtyRaw === 'string' ? qtyRaw : null),
          demandType: String(r.demandType ?? r.source ?? '—'),
          referenceNo: String(r.referenceNo ?? r.demandId ?? '—'),
          warehouseName:
            warehouses.find((w) => w.warehouseId === r.warehouseId)?.warehouseName ??
            String(r.warehouseName ?? r.warehouseId ?? '—'),
          status: String(r.status ?? '—'),
        }
      })
  } catch {
    reservations = []
  }

  // Timeline
  const timeline: ItemTimelineEvent[] = []
  for (const po of pos) {
    for (const line of po.lines ?? []) {
      if (line.itemId !== itemId) continue
      timeline.push({
        id: `po-${po.id}-${line.id}`,
        at: po.documentDate,
        kind: 'po',
        title: `PO ${po.documentNumber}`,
        subtitle: po.vendor?.name,
        href: poHref(po.id),
        qty: num(line.quantity),
        meta: String(po.status),
      })
      break
    }
  }
  for (const r of receipts) {
    timeline.push({
      id: `grn-${r.grnId}-${r.receiptDate}-${r.qty}`,
      at: r.receiptDate,
      kind: 'grn',
      title: `GRN ${r.grnNumber}`,
      subtitle: r.vendorName,
      href: r.href,
      qty: r.qty,
      meta: r.status,
    })
  }
  for (const iss of issues) {
    timeline.push({
      id: `iss-${iss.id}`,
      at: iss.date,
      kind: 'issue',
      title: `Issue ${iss.number}`,
      subtitle: iss.reference,
      href: iss.href,
      qty: iss.qty,
    })
  }
  for (const t of transfers) {
    timeline.push({
      id: `tr-${t.id}`,
      at: t.date,
      kind: 'transfer',
      title: `Transfer ${t.number}`,
      subtitle: `${t.fromWh} → ${t.toWh}`,
      href: t.href,
      qty: t.qty,
    })
  }
  for (const r of reservations) {
    timeline.push({
      id: `rsv-${r.id}`,
      at: new Date().toISOString().slice(0, 10),
      kind: 'reservation',
      title: `Reservation ${r.referenceNo}`,
      subtitle: r.demandType,
      qty: r.qty,
      meta: r.status,
    })
  }
  timeline.sort((a, b) => b.at.localeCompare(a.at))

  const itemCode = item?.itemCode ?? filtered[0]?.itemCode ?? receipts[0]?.grnNumber ?? itemId
  const itemName = item?.itemName ?? filtered[0]?.itemName ?? '—'
  const uom = item?.baseUomCode ?? '—'

  return {
    itemId,
    itemCode,
    itemName,
    uom,
    overview: {
      onHand: overviewOnHand,
      reserved: overviewReserved,
      available: overviewAvailable,
      incoming: incomingTotal,
      avgCost: overviewAvg,
      stockValue: overviewValue,
      reorderLevel: reorder,
      status: stockHealthStatus(overviewOnHand, overviewAvailable, reorder, maxStock),
    },
    warehouses: warehouseId ? warehouses.filter((w) => w.warehouseId === warehouseId) : warehouses,
    batches,
    serials,
    bins,
    receiptSummary,
    purchaseSummary,
    receipts,
    issues,
    transfers,
    reservations,
    timeline,
  }
}

export async function getOperationalAnalytics(): Promise<OperationalAnalytics> {
  const [{ grns, pos }, stock] = await Promise.all([loadDocs(), listConsolidatedStock()])

  type ItemAgg = { itemId: string; itemCode: string; itemName: string; qty: number; amount: number; grnCount: Set<string> }
  const purchased = new Map<string, ItemAgg>()
  const received = new Map<string, ItemAgg>()
  const vendorMap = new Map<string, { vendorId: string; vendorName: string; qty: number; grnCount: Set<string>; amount: number }>()
  const purchaseTrend = new Map<string, { period: string; poCount: number; orderedQty: number; poIds: Set<string> }>()
  const grnTrend = new Map<string, { period: string; grnCount: number; receivedQty: number; grnIds: Set<string> }>()
  const receiptFreq = new Map<string, { itemId: string; itemCode: string; dates: string[] }>()

  for (const po of pos) {
    const p = periodKey(po.documentDate)
    let pt = purchaseTrend.get(p)
    if (!pt) {
      pt = { period: p, poCount: 0, orderedQty: 0, poIds: new Set() }
      purchaseTrend.set(p, pt)
    }
    if (!pt.poIds.has(po.id)) {
      pt.poIds.add(po.id)
      pt.poCount += 1
    }
    for (const line of po.lines ?? []) {
      const qty = num(line.quantity)
      const amt = num(line.lineTotal) || qty * num(line.rate)
      pt.orderedQty += qty
      let agg = purchased.get(line.itemId)
      if (!agg) {
        agg = { itemId: line.itemId, itemCode: line.itemCode, itemName: line.itemName, qty: 0, amount: 0, grnCount: new Set() }
        purchased.set(line.itemId, agg)
      }
      agg.qty += qty
      agg.amount += amt
    }
  }

  for (const grn of grns) {
    const p = periodKey(grn.documentDate)
    let gt = grnTrend.get(p)
    if (!gt) {
      gt = { period: p, grnCount: 0, receivedQty: 0, grnIds: new Set() }
      grnTrend.set(p, gt)
    }
    if (!gt.grnIds.has(grn.id)) {
      gt.grnIds.add(grn.id)
      gt.grnCount += 1
    }
    const vid = grn.vendor?.id ?? ''
    let vend = vendorMap.get(vid)
    if (!vend && vid) {
      vend = { vendorId: vid, vendorName: grn.vendor?.name ?? '—', qty: 0, grnCount: new Set(), amount: 0 }
      vendorMap.set(vid, vend)
    }
    if (vend) vend.grnCount.add(grn.id)

    for (const line of grn.lines ?? []) {
      const qty = num(line.receivedQty ?? line.acceptedQty)
      const amt = num(line.taxableAmount) || qty * num(line.rate)
      gt.receivedQty += qty
      if (vend) {
        vend.qty += qty
        vend.amount += amt
      }
      let agg = received.get(line.itemId)
      if (!agg) {
        agg = {
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          qty: 0,
          amount: 0,
          grnCount: new Set(),
        }
        received.set(line.itemId, agg)
      }
      agg.qty += qty
      agg.amount += amt
      agg.grnCount.add(grn.id)

      let rf = receiptFreq.get(line.itemId)
      if (!rf) {
        rf = { itemId: line.itemId, itemCode: line.itemCode, dates: [] }
        receiptFreq.set(line.itemId, rf)
      }
      rf.dates.push(grn.documentDate)
    }
  }

  const topPurchasedItems = [...purchased.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)
    .map(({ itemId, itemCode, itemName, qty, amount }) => ({ itemId, itemCode, itemName, qty, amount }))

  const mostReceivedItems = [...received.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)
    .map(({ itemId, itemCode, itemName, qty, grnCount }) => ({
      itemId,
      itemCode,
      itemName,
      qty,
      grnCount: grnCount.size,
    }))

  const vendorWiseReceipts = [...vendorMap.values()]
    .map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      qty: v.qty,
      grnCount: v.grnCount.size,
      amount: v.amount,
    }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)

  const warehouseStock = (() => {
    const map = new Map<string, { warehouseId: string; warehouseName: string; onHand: number; value: number }>()
    for (const r of stock) {
      let w = map.get(r.warehouseId)
      if (!w) {
        w = { warehouseId: r.warehouseId, warehouseName: r.warehouseName, onHand: 0, value: 0 }
        map.set(r.warehouseId, w)
      }
      w.onHand += r.onHand
      w.value += r.stockValue
    }
    return [...map.values()].sort((a, b) => b.value - a.value)
  })()

  const monthsSpan = (dates: string[]) => {
    if (dates.length === 0) return 1
    const sorted = [...dates].sort()
    const a = new Date(sorted[0]).getTime()
    const b = new Date(sorted[sorted.length - 1]).getTime()
    const months = Math.max(1, (b - a) / (30.44 * 86400000))
    return months
  }

  const receiptFrequency = [...receiptFreq.values()]
    .map((r) => ({
      itemId: r.itemId,
      itemCode: r.itemCode,
      receiptsPerMonth: r.dates.length / monthsSpan(r.dates),
    }))
    .sort((a, b) => b.receiptsPerMonth - a.receiptsPerMonth)
    .slice(0, 10)

  return {
    topPurchasedItems,
    mostReceivedItems,
    vendorWiseReceipts,
    warehouseStock,
    purchaseTrend: [...purchaseTrend.values()]
      .map(({ period, poCount, orderedQty }) => ({ period, poCount, orderedQty }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    grnTrend: [...grnTrend.values()]
      .map(({ period, grnCount, receivedQty }) => ({ period, grnCount, receivedQty }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    receiptFrequency,
  }
}

export async function searchItemOpsSnapshot(query: string): Promise<ItemSearchSnapshot[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const [stock, items, { grns, pos }] = await Promise.all([
    listConsolidatedStock({ search: q }),
    getItems().catch(() => []),
    loadDocs(),
  ])

  const itemIds = new Set<string>()
  for (const r of stock) {
    if (
      r.itemCode.toLowerCase().includes(q) ||
      r.itemName.toLowerCase().includes(q)
    ) {
      itemIds.add(r.itemId)
    }
  }
  for (const item of items) {
    if (
      item.itemCode.toLowerCase().includes(q) ||
      item.itemName.toLowerCase().includes(q)
    ) {
      itemIds.add(item.id)
    }
  }
  for (const grn of grns) {
    for (const line of grn.lines ?? []) {
      if (
        line.itemCode?.toLowerCase().includes(q) ||
        line.itemName?.toLowerCase().includes(q)
      ) {
        itemIds.add(line.itemId)
      }
    }
  }

  const snaps: ItemSearchSnapshot[] = []
  for (const itemId of [...itemIds].slice(0, 25)) {
    const itemRows = stock.filter((r) => r.itemId === itemId)
    const itemMeta = items.find((i) => i.id === itemId)
    const code = itemRows[0]?.itemCode ?? itemMeta?.itemCode ?? itemId
    const name = itemRows[0]?.itemName ?? itemMeta?.itemName ?? '—'
    const currentStock = itemRows.reduce((s, r) => s + r.onHand, 0)
    const available = itemRows.reduce((s, r) => s + r.available, 0)
    const value = itemRows.reduce((s, r) => s + r.stockValue, 0)
    const avgCost = currentStock > 0 ? value / currentStock : itemRows[0]?.avgCost ?? 0

    const warehouses: WarehouseStockSlice[] = itemRows.map((r) => ({
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouseCode,
      warehouseName: r.warehouseName,
      onHand: r.onHand,
      reserved: r.reserved,
      available: r.available,
      incoming: r.incoming,
      avgCost: r.avgCost,
      stockValue: r.stockValue,
    }))

    const recentReceipts = extractReceiptLines(grns, itemId).slice(0, 5)
    const pendingPurchaseOrders: ItemSearchSnapshot['pendingPurchaseOrders'] = []
    for (const po of pos) {
      if (!isOpenPoStatus(String(po.status))) continue
      let pending = 0
      for (const line of po.lines ?? []) {
        if (line.itemId !== itemId) continue
        pending +=
          num(line.pendingQty) > 0
            ? num(line.pendingQty)
            : Math.max(0, num(line.quantity) - num(line.receivedQty))
      }
      if (pending > 0) {
        pendingPurchaseOrders.push({
          poId: po.id,
          poNumber: po.documentNumber,
          pendingQty: pending,
          href: poHref(po.id),
        })
      }
    }

    snaps.push({
      itemId,
      itemCode: code,
      itemName: name,
      currentStock,
      available,
      avgCost,
      warehouses,
      recentReceipts,
      recentIssues: [],
      pendingPurchaseOrders,
    })
  }

  return snaps.sort((a, b) => a.itemCode.localeCompare(b.itemCode))
}

/** List item-level receipt summaries (one card per item; GRNs expand unmerged). */
export async function listItemReceiptSummaries(search?: string): Promise<
  Array<ItemReceiptSummary & { itemCode: string; itemName: string }>
> {
  const { grns } = await loadDocs()
  const byItem = new Map<string, { itemCode: string; itemName: string; lines: GrnReceiptLineSummary[] }>()

  for (const grn of grns) {
    for (const line of grn.lines ?? []) {
      let bucket = byItem.get(line.itemId)
      if (!bucket) {
        bucket = { itemCode: line.itemCode, itemName: line.itemName, lines: [] }
        byItem.set(line.itemId, bucket)
      }
      bucket.lines.push({
        grnId: grn.id,
        grnNumber: grn.documentNumber,
        receiptDate: grn.documentDate,
        vendorId: grn.vendor?.id ?? '',
        vendorName: grn.vendor?.name ?? '—',
        warehouseId: line.warehouseId || grn.warehouseId || '',
        warehouseName: line.warehouseName || grn.warehouseName || '—',
        qty: num(line.receivedQty ?? line.acceptedQty),
        rate: num(line.rate),
        amount: num(line.taxableAmount) || num(line.receivedQty) * num(line.rate),
        status: String(grn.status ?? ''),
        href: grnHref(grn.id),
      })
    }
  }

  let rows = [...byItem.entries()].map(([itemId, bucket]) => ({
    ...buildReceiptSummary(itemId, bucket.lines.sort((a, b) => b.receiptDate.localeCompare(a.receiptDate))),
    itemCode: bucket.itemCode,
    itemName: bucket.itemName,
  }))

  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(
      (r) => r.itemCode.toLowerCase().includes(q) || r.itemName.toLowerCase().includes(q),
    )
  }

  return rows.sort((a, b) => b.totalQtyReceived - a.totalQtyReceived)
}
