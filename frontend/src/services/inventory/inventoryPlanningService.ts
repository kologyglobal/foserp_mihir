/**
 * Inventory Planning mock service (Phase 6).
 * Simple replenishment — no advanced MRP.
 */

import { useMasterStore } from '../../store/masterStore'
import { createPurchaseRequisition } from '../purchase'
import type {
  InventoryPlanningFilter,
  InventoryPlanningRow,
  PlanningSuggestedSource,
  PlanningSuggestionStatus,
} from '../../types/inventoryDomain'
import { getItemById, getStockAvailability } from './inventoryService'

const delay = (ms = 80) => new Promise<void>((r) => setTimeout(r, ms))

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

const ignoredIds = new Set<string>()
const qtyOverrides = new Map<string, number>()
const dateOverrides = new Map<string, string>()
const draftCreated = new Set<string>()

function rowKey(itemId: string, warehouseId: string) {
  return `${itemId}::${warehouseId}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function resolveSuggestedSource(
  preferred: string,
  openPo: number,
  suggestedQty: number,
): PlanningSuggestedSource {
  if (suggestedQty <= 0) return 'no_action'
  if (preferred === 'production') return 'production'
  if (preferred === 'transfer' && openPo === 0) return 'transfer'
  return 'purchase'
}

export async function getInventoryPlanning(
  filter: InventoryPlanningFilter = {},
): Promise<InventoryPlanningRow[]> {
  await delay()
  const stockRows = await getStockAvailability({
    search: filter.search,
    warehouseId: filter.warehouseId,
    categoryId: filter.categoryId,
    itemType: filter.itemType,
  })

  const rows: InventoryPlanningRow[] = []

  for (const s of stockRows) {
    const item = await getItemById(s.itemId)
    if (!item || !item.reorderPlanningEnabled) continue

    const key = rowKey(s.itemId, s.warehouseId)
    if (ignoredIds.has(key) && !filter.includeIgnored) continue

    const reservedDemand = s.reserved
    const openPurchaseOrders = s.expectedReceipt
    const openProductionOrders = Math.max(0, Math.round(s.plannedIssue * 0.4))
    const plannedConsumption = s.plannedIssue
    const expectedReceipts = openPurchaseOrders
    const projectedStock = s.available + expectedReceipts - reservedDemand - plannedConsumption
    const maximumStock = item.maximumStock > 0 ? item.maximumStock : item.reorderLevel + item.reorderQuantity
    const rawSuggested = Math.max(0, maximumStock - projectedStock)
    const suggestedQuantity = qtyOverrides.get(key) ?? rawSuggested

    if (filter.suggestedSource && filter.suggestedSource !== 'all') {
      const src = resolveSuggestedSource(item.preferredSource, openPurchaseOrders, suggestedQuantity)
      if (src !== filter.suggestedSource) continue
    }

    if (suggestedQuantity <= 0 && !filter.includeIgnored) continue

    let status: PlanningSuggestionStatus = 'active'
    if (ignoredIds.has(key)) status = 'ignored'
    else if (draftCreated.has(key)) status = 'draft_created'

    const leadDays = item.leadTimeDays || 7
    const requiredDate = dateOverrides.get(key) ?? addDays(new Date().toISOString().slice(0, 10), leadDays)

    rows.push({
      id: key,
      itemId: s.itemId,
      itemCode: s.itemCode,
      itemName: s.itemName,
      warehouseId: s.warehouseId,
      warehouseName: s.warehouseName,
      availableStock: s.available,
      minimumStock: item.minimumStock,
      safetyStock: item.safetyStock,
      maximumStock,
      reservedDemand,
      openPurchaseOrders,
      openProductionOrders,
      plannedConsumption,
      expectedReceipts,
      projectedStock,
      suggestedQuantity,
      suggestedSource: resolveSuggestedSource(item.preferredSource, openPurchaseOrders, suggestedQuantity),
      requiredDate,
      status,
    })
  }

  return rows.sort((a, b) => b.suggestedQuantity - a.suggestedQuantity)
}

export async function ignorePlanningSuggestion(id: string): Promise<void> {
  await delay(40)
  ignoredIds.add(id)
}

export async function updatePlanningQuantity(id: string, qty: number): Promise<void> {
  await delay(40)
  qtyOverrides.set(id, Math.max(0, qty))
}

export async function updatePlanningRequiredDate(id: string, date: string): Promise<void> {
  await delay(40)
  dateOverrides.set(id, date)
}

export async function createPurchaseRequisitionDraftDemo(
  row: InventoryPlanningRow,
): Promise<{ id: string; documentNumber: string }> {
  await delay()
  const master = useMasterStore.getState()
  const item = master.getItem(row.itemId)
  if (!item) throw new Error('Item not found')

  const pr = await createPurchaseRequisition({
    documentDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: row.requiredDate,
    purpose: `Replenishment from inventory planning — ${row.itemCode}`,
    referenceNumber: `INV-PLAN-${row.itemCode}`,
    lines: [{
      itemId: row.itemId,
      itemCode: row.itemCode,
      itemName: row.itemName,
      quantity: row.suggestedQuantity,
      estimatedRate: item.standardRate ?? 0,
      requiredDate: row.requiredDate,
    }],
  })
  draftCreated.add(row.id)
  return { id: pr.id, documentNumber: pr.documentNumber }
}

export async function createProductionRequestDraftDemo(
  row: InventoryPlanningRow,
): Promise<{ id: string; documentNumber: string }> {
  await delay()
  const docNo = `PRD-REQ-${Date.now().toString(36).toUpperCase()}`
  draftCreated.add(row.id)
  return { id: genId('prd-req'), documentNumber: docNo }
}

export async function createTransferDraftFromPlanningDemo(
  row: InventoryPlanningRow,
): Promise<{ id: string; documentNumber: string }> {
  await delay()
  const docNo = `TRF-PLAN-${Date.now().toString(36).toUpperCase()}`
  draftCreated.add(row.id)
  return { id: genId('trf-draft'), documentNumber: docNo }
}

/** Test helper */
export function resetInventoryPlanningForTests() {
  ignoredIds.clear()
  qtyOverrides.clear()
  dateOverrides.clear()
  draftCreated.clear()
}
