/**
 * Live inventory planning — reorder suggestions from masters + stock balances.
 * No dedicated planning API / MRP engine; projected open PO/production are 0 until those feeds exist.
 */
import { fetchItems, type ItemDto } from '../api/masterBatchApi'
import {
  listInventoryBalances,
  type InventoryStockBalance,
} from '../api/inventoryApi'
import { createPurchaseRequisition } from '../api/purchaseApi'
import type {
  InventoryPlanningFilter,
  InventoryPlanningRow,
  PlanningSuggestedSource,
  PlanningSuggestionStatus,
} from '../../types/inventoryDomain'

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function rowKey(itemId: string, warehouseId: string) {
  return `${itemId}::${warehouseId}`
}

const ignoredIds = new Set<string>()
const qtyOverrides = new Map<string, number>()
const dateOverrides = new Map<string, string>()
const draftCreated = new Set<string>()

function resolveSuggestedSource(dto: ItemDto, suggestedQty: number): PlanningSuggestedSource {
  if (suggestedQty <= 0) return 'no_action'
  if (!dto.isPurchasable) return 'production'
  return 'purchase'
}

async function listAllBalances(warehouseId?: string): Promise<InventoryStockBalance[]> {
  const all: InventoryStockBalance[] = []
  let page = 1
  for (;;) {
    const res = await listInventoryBalances({
      page,
      limit: 200,
      warehouseId: warehouseId || undefined,
    })
    all.push(...(res.data ?? []))
    const meta = res.meta as { totalPages?: number } | undefined
    if (!meta?.totalPages || page >= meta.totalPages) break
    page += 1
    if (page > 50) break
  }
  return all
}

export async function listLiveInventoryPlanning(
  filter: InventoryPlanningFilter = {},
): Promise<InventoryPlanningRow[]> {
  const [items, balances] = await Promise.all([
    fetchItems(),
    listAllBalances(filter.warehouseId).catch(() => [] as InventoryStockBalance[]),
  ])

  const itemById = new Map(items.map((i) => [i.id, i]))
  const rows: InventoryPlanningRow[] = []
  const q = filter.search?.trim().toLowerCase()

  for (const bal of balances) {
    const dto = itemById.get(bal.itemId)
    if (!dto || !dto.isStockable || dto.status !== 'ACTIVE') continue

    const reorderLevel = num(dto.reorderLevel)
    const reorderQty = num(dto.reorderQty)
    // Live proxy for "planning enabled": item has a positive reorder level.
    if (reorderLevel <= 0) continue

    if (q) {
      const hay = `${dto.code} ${dto.name}`.toLowerCase()
      if (!hay.includes(q)) continue
    }

    const key = rowKey(bal.itemId, bal.warehouseId)
    if (ignoredIds.has(key) && !filter.includeIgnored) continue

    const available = num(bal.freeQty)
    const reservedDemand = num(bal.reservedQty)
    // Open PO / production / planned consumption not available from inventory balances alone.
    const openPurchaseOrders = 0
    const openProductionOrders = 0
    const plannedConsumption = 0
    const expectedReceipts = 0
    const projectedStock = available + expectedReceipts - reservedDemand - plannedConsumption
    const maximumStock = reorderLevel + Math.max(reorderQty, 0)
    const rawSuggested =
      projectedStock < reorderLevel
        ? Math.max(reorderQty, reorderLevel - projectedStock)
        : 0
    const suggestedQuantity = qtyOverrides.get(key) ?? rawSuggested
    const suggestedSource = resolveSuggestedSource(dto, suggestedQuantity)

    if (filter.suggestedSource && filter.suggestedSource !== 'all' && suggestedSource !== filter.suggestedSource) {
      continue
    }
    if (suggestedQuantity <= 0 && !filter.includeIgnored) continue

    let status: PlanningSuggestionStatus = 'active'
    if (ignoredIds.has(key)) status = 'ignored'
    else if (draftCreated.has(key)) status = 'draft_created'

    const requiredDate = dateOverrides.get(key) ?? addDays(new Date().toISOString().slice(0, 10), 7)

    rows.push({
      id: key,
      itemId: bal.itemId,
      itemCode: dto.code,
      itemName: dto.name,
      warehouseId: bal.warehouseId,
      warehouseName: bal.warehouse?.name ?? bal.warehouseId.slice(0, 8),
      availableStock: available,
      minimumStock: reorderLevel,
      safetyStock: 0,
      maximumStock,
      reservedDemand,
      openPurchaseOrders,
      openProductionOrders,
      plannedConsumption,
      expectedReceipts,
      projectedStock,
      suggestedQuantity,
      suggestedSource,
      requiredDate,
      status,
    })
  }

  return rows.sort((a, b) => b.suggestedQuantity - a.suggestedQuantity)
}

export async function ignoreLivePlanningSuggestion(id: string): Promise<void> {
  ignoredIds.add(id)
}

export async function updateLivePlanningQuantity(id: string, qty: number): Promise<void> {
  qtyOverrides.set(id, Math.max(0, qty))
}

export async function updateLivePlanningRequiredDate(id: string, date: string): Promise<void> {
  dateOverrides.set(id, date)
}

export async function createLivePurchaseRequisitionFromPlanning(
  row: InventoryPlanningRow,
): Promise<{ id: string; documentNumber: string }> {
  const res = await createPurchaseRequisition({
    source: 'MRP',
    purpose: `Replenishment from inventory planning — ${row.itemCode}`,
    warehouseId: row.warehouseId || undefined,
    requiredByDate: row.requiredDate,
    notes: `Suggested qty ${row.suggestedQuantity} (projected ${row.projectedStock}, reorder ${row.minimumStock})`,
    lines: [
      {
        itemId: row.itemId,
        quantity: row.suggestedQuantity,
        warehouseId: row.warehouseId || undefined,
        requiredDate: row.requiredDate,
        remarks: 'From inventory planning',
      },
    ],
  })
  draftCreated.add(row.id)
  return {
    id: res.data.id,
    documentNumber: res.data.prNumber ?? res.data.id.slice(0, 8),
  }
}

export function resetLiveInventoryPlanningForTests() {
  ignoredIds.clear()
  qtyOverrides.clear()
  dateOverrides.clear()
  draftCreated.clear()
}
