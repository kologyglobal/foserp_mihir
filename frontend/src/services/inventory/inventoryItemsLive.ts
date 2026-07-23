/**
 * Live Inventory Items — masters/items + inventory balances (API mode).
 * Demo mode continues to use inventoryService seed/store.
 */
import { fetchItems, deactivateItemApi, type ItemDto } from '../api/masterBatchApi'
import { fetchLookup } from '../api/masterApi'
import {
  listInventoryBalances,
  listInventoryLedger,
  listInventoryReservations,
  type InventoryStockBalance,
  type InventoryStockMovement,
  type InventoryStockReservation,
} from '../api/inventoryApi'
import type {
  InventoryFilter,
  InventoryItem,
  InventoryItemStatus,
  InventoryItemType,
  StockDetailsData,
} from '../../types/inventoryDomain'

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Map backend MasterItem.itemType → inventory UI item types. */
export function mapMasterItemType(raw: string | null | undefined): InventoryItemType {
  switch ((raw ?? '').toLowerCase()) {
    case 'raw':
    case 'raw_material':
      return 'raw_material'
    case 'bought_out':
    case 'component':
      return 'component'
    case 'consumable':
      return 'consumable'
    case 'sub_assembly':
    case 'semi_finished':
      return 'semi_finished'
    case 'finished_good':
      return 'finished_good'
    case 'packing_material':
      return 'packing_material'
    case 'spare':
      return 'spare'
    case 'trading_item':
    case 'trading':
      return 'trading_item'
    case 'scrap':
      return 'scrap'
    default:
      return 'raw_material'
  }
}

function mapStatus(dto: ItemDto): InventoryItemStatus {
  if (dto.isBlocked) return 'blocked'
  return dto.status === 'ACTIVE' ? 'active' : 'inactive'
}

function matchesFilter(row: InventoryItem, filter: InventoryFilter): boolean {
  const q = filter.search?.trim().toLowerCase()
  if (q) {
    const hay = `${row.itemCode} ${row.itemName} ${row.categoryName}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filter.itemType && filter.itemType !== 'all' && row.itemType !== filter.itemType) return false
  if (filter.status && filter.status !== 'all' && row.status !== filter.status) return false
  if (filter.categoryId && row.categoryId !== filter.categoryId) return false
  return true
}

function emptyItemDefaults(partial: Partial<InventoryItem> & Pick<InventoryItem, 'id' | 'itemCode' | 'itemName'>): InventoryItem {
  const now = new Date().toISOString()
  return {
    itemType: 'raw_material',
    categoryId: '',
    categoryName: '—',
    baseUomId: '',
    baseUomCode: '—',
    defaultWarehouseId: null,
    defaultWarehouseName: null,
    status: 'active',
    isInventoryItem: true,
    allowNegativeStock: false,
    minimumStock: 0,
    maximumStock: 0,
    safetyStock: 0,
    reorderLevel: 0,
    reorderQuantity: 0,
    hsnCode: '',
    gstRate: 0,
    costingMethod: 'standard',
    standardCost: 0,
    averageCost: 0,
    lastPurchaseCost: 0,
    batchTracking: false,
    serialTracking: false,
    expiryTracking: false,
    shelfLifeDays: null,
    qualityInspectionRequired: false,
    automaticBatchSelection: false,
    reorderPlanningEnabled: false,
    leadTimeDays: 0,
    preferredSource: 'purchase',
    minimumOrderQuantity: 0,
    maximumOrderQuantity: 0,
    availableQuantity: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    modifiedBy: 'system',
    ...partial,
  }
}

async function loadLookups(): Promise<{ categories: Map<string, string>; uoms: Map<string, string> }> {
  const [cats, uoms] = await Promise.all([
    fetchLookup('item-categories').catch(() => ({ data: [] as Array<{ id: string; code?: string; name: string }> })),
    fetchLookup('uom').catch(() => ({ data: [] as Array<{ id: string; code?: string; name: string }> })),
  ])
  return {
    categories: new Map(cats.data.map((r) => [r.id, r.code ? `${r.code} — ${r.name}` : r.name])),
    uoms: new Map(uoms.data.map((r) => [r.id, r.code ?? r.name])),
  }
}

function aggregateBalances(balances: InventoryStockBalance[]): Map<string, { onHand: number; reserved: number; free: number }> {
  const map = new Map<string, { onHand: number; reserved: number; free: number }>()
  for (const b of balances) {
    const cur = map.get(b.itemId) ?? { onHand: 0, reserved: 0, free: 0 }
    cur.onHand += num(b.onHandQty)
    cur.reserved += num(b.reservedQty)
    cur.free += num(b.freeQty)
    map.set(b.itemId, cur)
  }
  return map
}

function dtoToInventoryItem(
  dto: ItemDto,
  stock: { onHand: number; reserved: number; free: number } | undefined,
  lookups: { categories: Map<string, string>; uoms: Map<string, string> },
): InventoryItem {
  const reorderLevel = num(dto.reorderLevel)
  const reorderQty = num(dto.reorderQty)
  const standardCost = num(dto.standardRate)
  return emptyItemDefaults({
    id: dto.id,
    itemCode: dto.code,
    itemName: dto.name,
    itemType: mapMasterItemType(dto.itemType),
    categoryId: dto.categoryId,
    categoryName: lookups.categories.get(dto.categoryId) ?? '—',
    baseUomId: dto.baseUomId,
    baseUomCode: lookups.uoms.get(dto.baseUomId) ?? '—',
    status: mapStatus(dto),
    isInventoryItem: dto.isStockable,
    reorderLevel,
    reorderQuantity: reorderQty,
    hsnCode: dto.hsnCode ?? '',
    standardCost,
    averageCost: standardCost,
    qualityInspectionRequired: dto.qcRequired,
    preferredSource: dto.isPurchasable ? 'purchase' : 'production',
    availableQuantity: stock?.free ?? 0,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  })
}

export async function listLiveInventoryItems(filter: InventoryFilter = {}): Promise<InventoryItem[]> {
  const [items, balancesRes, lookups] = await Promise.all([
    fetchItems(),
    listInventoryBalances({ limit: 500 }).catch(() => ({ data: [] as InventoryStockBalance[] })),
    loadLookups(),
  ])
  const stockByItem = aggregateBalances(balancesRes.data ?? [])
  return items
    .map((dto) => dtoToInventoryItem(dto, stockByItem.get(dto.id), lookups))
    .filter((row) => matchesFilter(row, filter))
    .sort((a, b) => a.itemCode.localeCompare(b.itemCode))
}

export async function getLiveInventoryItem(id: string): Promise<InventoryItem | null> {
  const rows = await listLiveInventoryItems({})
  return rows.find((r) => r.id === id) ?? null
}

export async function getLiveStockDetails(itemId: string): Promise<StockDetailsData | null> {
  const item = await getLiveInventoryItem(itemId)
  if (!item) return null

  const [balancesRes, ledgerRes, reservationsRes] = await Promise.all([
    listInventoryBalances({ itemId, limit: 200 }).catch(() => ({ data: [] as InventoryStockBalance[] })),
    listInventoryLedger({ itemId, limit: 20 }).catch(() => ({ data: [] as InventoryStockMovement[] })),
    listInventoryReservations({ itemId, limit: 50 }).catch(() => ({ data: [] as InventoryStockReservation[] })),
  ])

  type ReservationRow = InventoryStockReservation & {
    item?: { code?: string; name?: string }
    warehouse?: { code?: string; name?: string }
  }

  const balances = balancesRes.data ?? []
  const warehouses = balances.map((b) => ({
    warehouseId: b.warehouseId,
    warehouseCode: b.warehouse?.code ?? b.warehouseId.slice(0, 8),
    warehouseName: b.warehouse?.name ?? '—',
    onHand: num(b.onHandQty),
    qualityHold: 0,
    blocked: 0,
    reserved: num(b.reservedQty),
    available: num(b.freeQty),
    expectedReceipt: 0,
    plannedIssue: 0,
    stockValue: num(b.onHandQty) * (item.averageCost || item.standardCost),
  }))

  const summary = {
    warehouseId: '',
    warehouseCode: 'ALL',
    warehouseName: 'All warehouses',
    onHand: warehouses.reduce((s, w) => s + w.onHand, 0),
    qualityHold: 0,
    blocked: 0,
    reserved: warehouses.reduce((s, w) => s + w.reserved, 0),
    available: item.availableQuantity,
    expectedReceipt: 0,
    plannedIssue: 0,
    stockValue: warehouses.reduce((s, w) => s + w.stockValue, 0),
  }

  return {
    itemId: item.id,
    itemCode: item.itemCode,
    itemName: item.itemName,
    summary,
    warehouses,
    batches: [],
    serials: [],
    reservations: ((reservationsRes.data ?? []) as ReservationRow[]).map((r) => ({
      id: r.id,
      itemId: r.itemId,
      itemCode: r.item?.code ?? item.itemCode,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse?.name ?? warehouses.find((w) => w.warehouseId === r.warehouseId)?.warehouseName ?? '—',
      qty: num(r.remainingQty),
      demandType: (r.demandType === 'WO' ? 'WO' : 'SO') as 'SO' | 'WO',
      referenceNo: r.referenceNo ?? r.demandId,
      status: (r.status === 'ACTIVE' ? 'active' : r.status === 'FULFILLED' ? 'fulfilled' : 'cancelled') as
        | 'active'
        | 'fulfilled'
        | 'cancelled',
      createdAt: r.createdAt,
    })),
    recentMovements: (ledgerRes.data ?? []).map((m) => ({
      movementNo: m.movementNumber,
      type: m.movementType,
      qty: num(m.quantity),
      date: m.movementDate,
      warehouseName: m.warehouse?.name ?? '—',
    })),
    valuation: {
      standardCost: item.standardCost,
      averageCost: item.averageCost,
      stockValue: summary.stockValue,
      lastPurchaseCost: item.lastPurchaseCost,
    },
    planning: {
      reorderLevel: item.reorderLevel,
      reorderQuantity: item.reorderQuantity,
      leadTimeDays: item.leadTimeDays,
      suggestedOrderQty: Math.max(0, item.reorderQuantity),
    },
  }
}

export async function deactivateLiveInventoryItem(id: string): Promise<InventoryItem> {
  await deactivateItemApi(id)
  const item = await getLiveInventoryItem(id)
  if (!item) throw new Error('Item deactivated but could not be reloaded')
  return item
}
