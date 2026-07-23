/**
 * Inventory & Warehouse mock service (Phase 1).
 * Promise-based facade over masterStore + inventoryStore + in-memory extensions.
 */

import { useMasterStore } from '../../store/masterStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { isApiMode } from '../../config/apiConfig'
import type {
  InventoryAuditEntry,
  InventoryDashboardData,
  InventoryFilter,
  InventoryItem,
  InventoryItemInput,
  StockAvailability,
  StockAvailabilityFilter,
  StockDetailsData,
} from '../../types/inventoryDomain'
import { getItemBatches, getItemSerials, getReservations } from './traceabilityService'
import {
  deactivateLiveInventoryItem,
  getLiveInventoryItem,
  getLiveStockDetails,
  listLiveInventoryItems,
} from './inventoryItemsLive'
import {
  defaultExtensionForItem,
  DEMO_BLOCKED,
  DEMO_EXPECTED_RECEIPT,
  DEMO_PLANNED_ISSUE,
  DEMO_QUALITY_HOLD,
  mapInventoryTypeToMaster,
  PENDING_ISSUES_COUNT,
  PENDING_RECEIPTS_COUNT,
  PENDING_TRANSFERS_COUNT,
  STOCK_COUNT_DIFFERENCES,
  type InventoryItemExtension,
} from './inventorySeed'
import { DEMO_BATCH_ITEM_IDS, DEMO_SERIAL_ITEM_IDS } from './traceabilitySeed'
import { formatCurrency } from '../../utils/formatters/currency'

const delay = (ms = 100) => new Promise<void>((r) => setTimeout(r, ms))

export class InventoryServiceError extends Error {
  code: string
  constructor(message: string, code: string = 'INVENTORY_ERROR') {
    super(message)
    this.name = 'InventoryServiceError'
    this.code = code
  }
}

let extensions: Record<string, InventoryItemExtension> = {}
let auditTrail: InventoryAuditEntry[] = []
let initialized = false

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function ensureInitialized() {
  if (initialized) return
  const items = useMasterStore.getState().items
  for (const item of items) {
    extensions[item.id] = defaultExtensionForItem(item)
    if (DEMO_BATCH_ITEM_IDS.has(item.id)) {
      extensions[item.id].batchTracking = true
      if (item.id.includes('primer') || item.id.includes('thinner')) {
        extensions[item.id].expiryTracking = true
      }
    }
    if (DEMO_SERIAL_ITEM_IDS.has(item.id)) {
      extensions[item.id].serialTracking = true
    }
    if (item.id.endsWith('1') || item.id.endsWith('3')) {
      DEMO_QUALITY_HOLD[item.id] = 2
    }
    if (item.id.endsWith('5')) {
      DEMO_BLOCKED[item.id] = 1
    }
    DEMO_EXPECTED_RECEIPT[item.id] = item.qtyOnPurchaseOrder ?? 0
    DEMO_PLANNED_ISSUE[item.id] = (item.qtyOnProductionOrder ?? 0) + (item.qtyOnSalesOrder ?? 0)
  }
  initialized = true
}

function getMaster() {
  return useMasterStore.getState()
}

function getInv() {
  return useInventoryStore.getState()
}

function resolveStatus(item: { isActive: boolean; isBlocked?: boolean }): InventoryItem['status'] {
  if (item.isBlocked) return 'blocked'
  if (!item.isActive) return 'inactive'
  return 'active'
}

function buildInventoryItem(itemId: string): InventoryItem | null {
  ensureInitialized()
  const master = getMaster()
  const inv = getInv()
  const item = master.getItem(itemId)
  if (!item) return null
  const ext = extensions[itemId] ?? defaultExtensionForItem(item)
  const category = master.getCategory(item.categoryId)
  const uom = master.getUom(item.baseUomId)
  const wh = ext.defaultWarehouseId
    ? master.getWarehouse(ext.defaultWarehouseId)
    : category?.defaultWarehouseId
      ? master.getWarehouse(category.defaultWarehouseId)
      : undefined
  const defaultWhId = wh?.id ?? master.warehouses.find((w) => w.isActive)?.id ?? null
  const onHand = defaultWhId ? inv.getOnHand(item.id, defaultWhId) : 0
  const reserved = defaultWhId ? inv.getReservedQty(item.id, defaultWhId) : 0
  const qh = DEMO_QUALITY_HOLD[item.id] ?? 0
  const blocked = DEMO_BLOCKED[item.id] ?? 0
  const available = Math.max(0, onHand - reserved - qh - blocked)

  return {
    id: item.id,
    itemCode: item.itemCode,
    itemName: item.itemName,
    itemType: ext.inventoryItemType,
    categoryId: item.categoryId,
    categoryName: category?.categoryName ?? '—',
    baseUomId: item.baseUomId,
    baseUomCode: uom?.uomCode ?? '—',
    defaultWarehouseId: defaultWhId,
    defaultWarehouseName: wh?.warehouseName ?? null,
    status: resolveStatus(item),
    isInventoryItem: ext.isInventoryItem,
    allowNegativeStock: ext.allowNegativeStock,
    minimumStock: ext.minimumStock,
    maximumStock: ext.maximumStock,
    safetyStock: ext.safetyStock,
    reorderLevel: ext.reorderLevel,
    reorderQuantity: ext.reorderQuantity,
    hsnCode: ext.hsnCode || item.hsnCode,
    gstRate: ext.gstRate,
    costingMethod: ext.costingMethod,
    standardCost: ext.standardCost,
    averageCost: ext.averageCost,
    lastPurchaseCost: ext.lastPurchaseCost,
    batchTracking: ext.batchTracking,
    serialTracking: ext.serialTracking,
    expiryTracking: ext.expiryTracking,
    shelfLifeDays: ext.shelfLifeDays,
    qualityInspectionRequired: ext.qualityInspectionRequired,
    automaticBatchSelection: ext.automaticBatchSelection,
    reorderPlanningEnabled: ext.reorderPlanningEnabled,
    leadTimeDays: ext.leadTimeDays,
    preferredSource: ext.preferredSource,
    minimumOrderQuantity: ext.minimumOrderQuantity,
    maximumOrderQuantity: ext.maximumOrderQuantity,
    availableQuantity: available,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdBy: ext.createdBy,
    modifiedBy: ext.modifiedBy,
  }
}

function pushAudit(itemId: string, action: string, field: string | null, oldValue: string | null, newValue: string | null) {
  auditTrail.unshift({
    id: genId('aud'),
    itemId,
    action,
    field,
    oldValue,
    newValue,
    userId: 'user-demo',
    userName: 'Demo User',
    timestamp: new Date().toISOString(),
  })
  if (auditTrail.length > 500) auditTrail = auditTrail.slice(0, 500)
}

function matchesItemFilter(row: InventoryItem, filter: InventoryFilter): boolean {
  if (filter.tab === 'inactive') {
    if (row.status !== 'inactive') return false
  } else if (filter.tab && filter.tab !== 'all') {
    if (row.itemType !== filter.tab) return false
  }
  if (filter.search) {
    const q = filter.search.toLowerCase()
    if (!row.itemCode.toLowerCase().includes(q) && !row.itemName.toLowerCase().includes(q)) return false
  }
  if (filter.itemType && filter.itemType !== 'all' && row.itemType !== filter.itemType) return false
  if (filter.categoryId && row.categoryId !== filter.categoryId) return false
  if (filter.baseUomId && row.baseUomId !== filter.baseUomId) return false
  if (filter.defaultWarehouseId && row.defaultWarehouseId !== filter.defaultWarehouseId) return false
  if (filter.batchTracking !== undefined && row.batchTracking !== filter.batchTracking) return false
  if (filter.serialTracking !== undefined && row.serialTracking !== filter.serialTracking) return false
  if (filter.inspectionRequired !== undefined && row.qualityInspectionRequired !== filter.inspectionRequired) return false
  if (filter.reorderEnabled !== undefined && row.reorderPlanningEnabled !== filter.reorderEnabled) return false
  if (filter.status && filter.status !== 'all' && row.status !== filter.status) return false
  return true
}

export async function getInventoryDashboard(): Promise<InventoryDashboardData> {
  if (isApiMode()) {
    const { getLiveInventoryDashboard } = await import('./inventoryDashboardLive')
    return getLiveInventoryDashboard()
  }
  await delay()
  ensureInitialized()
  const master = getMaster()
  const inv = getInv()
  const positions = inv.getStockPositions()
  let totalValue = 0
  let availableQty = 0
  let lowStock = 0
  let outOfStock = 0
  let qualityHoldQty = 0

  for (const p of positions) {
    const ext = extensions[p.itemId]
    const rate = ext?.standardCost ?? master.getItem(p.itemId)?.standardRate ?? 0
    totalValue += p.onHand * rate
    availableQty += p.freeQty
    const reorder = ext?.reorderLevel ?? master.getItem(p.itemId)?.reorderLevel ?? 0
    if (p.onHand <= 0) outOfStock++
    else if (p.onHand <= reorder) lowStock++
    qualityHoldQty += DEMO_QUALITY_HOLD[p.itemId] ?? 0
  }

  const lowStockItems = positions
    .filter((p) => {
      const reorder = extensions[p.itemId]?.reorderLevel ?? 0
      return p.onHand > 0 && p.onHand <= reorder
    })
    .slice(0, 8)
    .map((p) => ({
      itemId: p.itemId,
      itemCode: p.itemCode,
      itemName: p.itemName,
      onHand: p.onHand,
      reorderLevel: extensions[p.itemId]?.reorderLevel ?? 0,
      href: `/inventory/stock/${p.itemId}`,
    }))

  const outOfStockItems = positions
    .filter((p) => p.onHand <= 0)
    .slice(0, 8)
    .map((p) => ({
      itemId: p.itemId,
      itemCode: p.itemCode,
      itemName: p.itemName,
      href: `/inventory/stock/${p.itemId}`,
    }))

  const qualityHoldItems = Object.entries(DEMO_QUALITY_HOLD)
    .filter(([, qty]) => qty > 0)
    .slice(0, 8)
    .map(([itemId, qty]) => {
      const item = master.getItem(itemId)
      return {
        itemId,
        itemCode: item?.itemCode ?? itemId,
        itemName: item?.itemName ?? '—',
        qty,
        href: `/inventory/stock/${itemId}`,
      }
    })

  const movements = inv.getMovements().slice(0, 10).map((m) => ({
    id: m.id,
    movementNo: m.movementNo,
    itemCode: master.getItem(m.itemId)?.itemCode ?? '—',
    type: m.referenceType,
    qty: m.qty,
    date: m.movementDate,
    href: `/inventory/items/${m.itemId}/ledger`,
  }))

  const warehouseMap = new Map<string, { skuCount: number; value: number; name: string }>()
  for (const p of positions) {
    const rate = extensions[p.itemId]?.standardCost ?? 0
    const cur = warehouseMap.get(p.warehouseId) ?? { skuCount: 0, value: 0, name: p.warehouseName }
    cur.skuCount++
    cur.value += p.onHand * rate
    warehouseMap.set(p.warehouseId, cur)
  }

  const warehouseStock = [...warehouseMap.entries()].map(([warehouseId, data]) => ({
    warehouseId,
    warehouseName: data.name,
    skuCount: data.skuCount,
    value: data.value,
    href: `/inventory/stock?warehouseId=${warehouseId}`,
  }))

  const categoryMap = new Map<string, number>()
  for (const p of positions) {
    const cat = p.categoryName
    const rate = extensions[p.itemId]?.standardCost ?? 0
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + p.onHand * rate)
  }
  const categoryValue = [...categoryMap.entries()]
    .map(([categoryName, value]) => ({
      categoryName,
      value,
      href: `/inventory/stock?search=${encodeURIComponent(categoryName)}`,
    }))
    .sort((a, b) => b.value - a.value)

  return {
    kpis: [
      { id: 'total-value', label: 'Total Stock Value', value: formatCurrency(totalValue), tone: 'primary', href: '/inventory/stock' },
      { id: 'available', label: 'Available Stock', value: availableQty, tone: 'success', href: '/inventory/stock' },
      { id: 'low-stock', label: 'Low-Stock Items', value: lowStock, tone: lowStock > 0 ? 'warning' : 'success', href: '/inventory/stock?lowStock=1' },
      { id: 'out-of-stock', label: 'Out-of-Stock Items', value: outOfStock, tone: outOfStock > 0 ? 'danger' : 'success', href: '/inventory/stock?outOfStock=1' },
      { id: 'quality-hold', label: 'Quality-Hold Stock', value: qualityHoldQty, tone: qualityHoldQty > 0 ? 'warning' : 'neutral', href: '/inventory/stock' },
      { id: 'pending-receipts', label: 'Pending Receipts', value: PENDING_RECEIPTS_COUNT, tone: 'primary', href: '/inventory/movements/receipts' },
      { id: 'pending-issues', label: 'Pending Issues', value: PENDING_ISSUES_COUNT, tone: 'primary', href: '/inventory/movements/issues' },
      { id: 'pending-transfers', label: 'Pending Transfers', value: PENDING_TRANSFERS_COUNT, tone: 'primary', href: '/inventory/movements/transfers' },
      { id: 'count-diff', label: 'Stock Count Differences', value: STOCK_COUNT_DIFFERENCES, tone: 'warning', href: '/inventory/stock-count' },
    ],
    pendingActions: [
      { id: 'receipts', label: 'Pending GRN receipts', count: PENDING_RECEIPTS_COUNT, href: '/inventory/movements/receipts' },
      { id: 'issues', label: 'Pending material issues', count: PENDING_ISSUES_COUNT, href: '/inventory/movements/issues' },
      { id: 'transfers', label: 'Pending transfers', count: PENDING_TRANSFERS_COUNT, href: '/inventory/movements/transfers' },
      { id: 'count', label: 'Stock count variances', count: STOCK_COUNT_DIFFERENCES, href: '/inventory/stock-count' },
    ],
    lowStockItems,
    outOfStockItems,
    qualityHoldItems,
    recentMovements: movements,
    warehouseStock,
    categoryValue,
  }
}

export async function getItems(filter: InventoryFilter = {}): Promise<InventoryItem[]> {
  if (isApiMode()) return listLiveInventoryItems(filter)
  await delay()
  ensureInitialized()
  const master = getMaster()
  return master.items
    .map((i) => buildInventoryItem(i.id))
    .filter((row): row is InventoryItem => row !== null)
    .filter((row) => matchesItemFilter(row, filter))
    .sort((a, b) => a.itemCode.localeCompare(b.itemCode))
}

export async function getItemById(id: string): Promise<InventoryItem | null> {
  if (isApiMode()) return getLiveInventoryItem(id)
  await delay()
  return buildInventoryItem(id)
}

export async function createItem(input: InventoryItemInput): Promise<InventoryItem> {
  if (isApiMode()) {
    throw new InventoryServiceError('Create items under Masters → Items in live mode', 'API_REDIRECT')
  }
  await delay()
  ensureInitialized()
  const master = getMaster()
  if (master.items.some((i) => i.itemCode.toLowerCase() === input.itemCode.toLowerCase())) {
    throw new InventoryServiceError('Item code already exists', 'DUPLICATE_CODE')
  }
  const category = master.getCategory(input.categoryId)
  if (!category) throw new InventoryServiceError('Category not found', 'INVALID_CATEGORY')

  const id = await Promise.resolve(master.addItem({
    itemCode: input.itemCode,
    itemName: input.itemName,
    itemDescription: '',
    categoryId: input.categoryId,
    baseUomId: input.baseUomId,
    itemType: mapInventoryTypeToMaster(input.itemType),
    materialGrade: '',
    hsnCode: input.hsnCode,
    reorderLevel: input.reorderLevel,
    reorderQty: input.reorderQuantity,
    standardRate: input.standardCost,
    isPurchasable: input.preferredSource === 'purchase',
    isStockable: input.isInventoryItem,
    isActive: input.status === 'active',
    isBlocked: input.status === 'blocked',
    qcRequired: input.qualityInspectionRequired,
    subAssemblyRule: input.itemType === 'semi_finished' ? 'manufactured' : null,
  }))

  extensions[id] = {
    masterItemId: id,
    inventoryItemType: input.itemType,
    itemType: input.itemType,
    defaultWarehouseId: input.defaultWarehouseId,
    isInventoryItem: input.isInventoryItem,
    allowNegativeStock: input.allowNegativeStock,
    minimumStock: input.minimumStock,
    maximumStock: input.maximumStock,
    safetyStock: input.safetyStock,
    reorderLevel: input.reorderLevel,
    reorderQuantity: input.reorderQuantity,
    hsnCode: input.hsnCode,
    gstRate: input.gstRate,
    costingMethod: input.costingMethod,
    standardCost: input.standardCost,
    averageCost: input.averageCost,
    lastPurchaseCost: input.lastPurchaseCost,
    batchTracking: input.batchTracking,
    serialTracking: input.serialTracking,
    expiryTracking: input.expiryTracking,
    shelfLifeDays: input.shelfLifeDays,
    qualityInspectionRequired: input.qualityInspectionRequired,
    automaticBatchSelection: input.automaticBatchSelection,
    reorderPlanningEnabled: input.reorderPlanningEnabled,
    leadTimeDays: input.leadTimeDays,
    preferredSource: input.preferredSource,
    minimumOrderQuantity: input.minimumOrderQuantity,
    maximumOrderQuantity: input.maximumOrderQuantity,
    createdBy: 'Demo User',
    modifiedBy: 'Demo User',
  }
  pushAudit(id, 'Created', null, null, input.itemCode)
  const row = buildInventoryItem(id)
  if (!row) throw new InventoryServiceError('Failed to create item', 'CREATE_FAILED')
  return row
}

export async function updateItem(id: string, input: Partial<InventoryItemInput>): Promise<InventoryItem> {
  if (isApiMode()) {
    throw new InventoryServiceError('Edit items under Masters → Items in live mode', 'API_REDIRECT')
  }
  await delay()
  ensureInitialized()
  const master = getMaster()
  const existing = master.getItem(id)
  if (!existing) throw new InventoryServiceError('Item not found', 'NOT_FOUND')
  const ext = extensions[id] ?? defaultExtensionForItem(existing)

  await Promise.resolve(master.updateItem(id, {
    itemCode: input.itemCode,
    itemName: input.itemName,
    categoryId: input.categoryId,
    baseUomId: input.baseUomId,
    itemType: input.itemType ? mapInventoryTypeToMaster(input.itemType) : undefined,
    hsnCode: input.hsnCode,
    reorderLevel: input.reorderLevel,
    reorderQty: input.reorderQuantity,
    standardRate: input.standardCost,
    isStockable: input.isInventoryItem,
    isActive: input.status === 'inactive' ? false : input.status === 'active' ? true : existing.isActive,
    isBlocked: input.status === 'blocked' ? true : input.status === 'active' ? false : existing.isBlocked,
    qcRequired: input.qualityInspectionRequired,
  }))

  extensions[id] = {
    ...ext,
    inventoryItemType: input.itemType ?? ext.inventoryItemType,
    itemType: input.itemType ?? ext.itemType,
    defaultWarehouseId: input.defaultWarehouseId !== undefined ? input.defaultWarehouseId : ext.defaultWarehouseId,
    isInventoryItem: input.isInventoryItem ?? ext.isInventoryItem,
    allowNegativeStock: input.allowNegativeStock ?? ext.allowNegativeStock,
    minimumStock: input.minimumStock ?? ext.minimumStock,
    maximumStock: input.maximumStock ?? ext.maximumStock,
    safetyStock: input.safetyStock ?? ext.safetyStock,
    reorderLevel: input.reorderLevel ?? ext.reorderLevel,
    reorderQuantity: input.reorderQuantity ?? ext.reorderQuantity,
    hsnCode: input.hsnCode ?? ext.hsnCode,
    gstRate: input.gstRate ?? ext.gstRate,
    costingMethod: input.costingMethod ?? ext.costingMethod,
    standardCost: input.standardCost ?? ext.standardCost,
    averageCost: input.averageCost ?? ext.averageCost,
    lastPurchaseCost: input.lastPurchaseCost ?? ext.lastPurchaseCost,
    batchTracking: input.batchTracking ?? ext.batchTracking,
    serialTracking: input.serialTracking ?? ext.serialTracking,
    expiryTracking: input.expiryTracking ?? ext.expiryTracking,
    shelfLifeDays: input.shelfLifeDays !== undefined ? input.shelfLifeDays : ext.shelfLifeDays,
    qualityInspectionRequired: input.qualityInspectionRequired ?? ext.qualityInspectionRequired,
    automaticBatchSelection: input.automaticBatchSelection ?? ext.automaticBatchSelection,
    reorderPlanningEnabled: input.reorderPlanningEnabled ?? ext.reorderPlanningEnabled,
    leadTimeDays: input.leadTimeDays ?? ext.leadTimeDays,
    preferredSource: input.preferredSource ?? ext.preferredSource,
    minimumOrderQuantity: input.minimumOrderQuantity ?? ext.minimumOrderQuantity,
    maximumOrderQuantity: input.maximumOrderQuantity ?? ext.maximumOrderQuantity,
    modifiedBy: 'Demo User',
  }
  pushAudit(id, 'Updated', null, null, existing.itemCode)
  const row = buildInventoryItem(id)
  if (!row) throw new InventoryServiceError('Failed to update item', 'UPDATE_FAILED')
  return row
}

export async function deactivateItem(id: string): Promise<InventoryItem> {
  if (isApiMode()) return deactivateLiveInventoryItem(id)
  return updateItem(id, { status: 'inactive' } as Partial<InventoryItemInput>)
}

export async function duplicateItem(id: string): Promise<InventoryItem> {
  if (isApiMode()) {
    throw new InventoryServiceError('Duplicate items under Masters → Items in live mode', 'API_REDIRECT')
  }
  await delay()
  const source = await getItemById(id)
  if (!source) throw new InventoryServiceError('Item not found', 'NOT_FOUND')
  const suffix = '-COPY'
  let code = `${source.itemCode}${suffix}`
  let n = 1
  const master = getMaster()
  while (master.items.some((i) => i.itemCode === code)) {
    n++
    code = `${source.itemCode}${suffix}${n}`
  }
  return createItem({
    itemCode: code,
    itemName: `${source.itemName} (Copy)`,
    itemType: source.itemType,
    categoryId: source.categoryId,
    baseUomId: source.baseUomId,
    defaultWarehouseId: source.defaultWarehouseId,
    status: 'active',
    isInventoryItem: source.isInventoryItem,
    allowNegativeStock: source.allowNegativeStock,
    minimumStock: source.minimumStock,
    maximumStock: source.maximumStock,
    safetyStock: source.safetyStock,
    reorderLevel: source.reorderLevel,
    reorderQuantity: source.reorderQuantity,
    hsnCode: source.hsnCode,
    gstRate: source.gstRate,
    costingMethod: source.costingMethod,
    standardCost: source.standardCost,
    averageCost: source.averageCost,
    lastPurchaseCost: source.lastPurchaseCost,
    batchTracking: source.batchTracking,
    serialTracking: source.serialTracking,
    expiryTracking: source.expiryTracking,
    shelfLifeDays: source.shelfLifeDays,
    qualityInspectionRequired: source.qualityInspectionRequired,
    automaticBatchSelection: source.automaticBatchSelection,
    reorderPlanningEnabled: source.reorderPlanningEnabled,
    leadTimeDays: source.leadTimeDays,
    preferredSource: source.preferredSource,
    minimumOrderQuantity: source.minimumOrderQuantity,
    maximumOrderQuantity: source.maximumOrderQuantity,
  })
}

function buildStockRow(itemId: string, warehouseId: string): StockAvailability | null {
  ensureInitialized()
  const master = getMaster()
  const inv = getInv()
  const item = buildInventoryItem(itemId)
  if (!item) return null
  const wh = master.getWarehouse(warehouseId)
  if (!wh) return null
  const onHand = inv.getOnHand(itemId, warehouseId)
  const reserved = inv.getReservedQty(itemId, warehouseId)
  const qualityHold = DEMO_QUALITY_HOLD[itemId] ?? 0
  const blocked = DEMO_BLOCKED[itemId] ?? 0
  const available = onHand - reserved - qualityHold - blocked
  const expectedReceipt = DEMO_EXPECTED_RECEIPT[itemId] ?? 0
  const plannedIssue = DEMO_PLANNED_ISSUE[itemId] ?? 0
  const rate = extensions[itemId]?.standardCost ?? item.standardCost

  let status: StockAvailability['status'] = 'available'
  if (qualityHold > 0) status = 'quality_hold'
  else if (blocked > 0) status = 'blocked'
  else if (reserved > 0 && available <= 0) status = 'reserved'

  return {
    itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    itemType: item.itemType,
    categoryName: item.categoryName,
    warehouseId,
    warehouseCode: wh.warehouseCode,
    warehouseName: wh.warehouseName,
    plantCode: wh.plantCode,
    batchNo: extensions[itemId]?.batchTracking ? `B-${item.itemCode}-001` : null,
    serialNo: null,
    onHand,
    qualityHold,
    blocked,
    reserved,
    available,
    expectedReceipt,
    plannedIssue,
    stockValue: onHand * rate,
    reorderLevel: item.reorderLevel,
    status,
  }
}

function matchesStockFilter(row: StockAvailability, filter: StockAvailabilityFilter): boolean {
  if (filter.search) {
    const q = filter.search.toLowerCase()
    if (
      !row.itemCode.toLowerCase().includes(q) &&
      !row.itemName.toLowerCase().includes(q) &&
      !row.categoryName.toLowerCase().includes(q)
    ) return false
  }
  if (filter.itemId && row.itemId !== filter.itemId) return false
  if (filter.categoryId && row.categoryName !== filter.categoryId) return false
  if (filter.itemType && filter.itemType !== 'all' && row.itemType !== filter.itemType) return false
  if (filter.warehouseId && row.warehouseId !== filter.warehouseId) return false
  if (filter.plantCode && row.plantCode !== filter.plantCode) return false
  if (filter.lowStock && !(row.onHand > 0 && row.onHand <= row.reorderLevel)) return false
  if (filter.outOfStock && row.onHand > 0) return false
  if (filter.negativeStock && row.available >= 0) return false
  if (filter.reorderRequired && row.onHand > row.reorderLevel) return false
  return true
}

export async function getStockAvailability(filter: StockAvailabilityFilter = {}): Promise<StockAvailability[]> {
  await delay()
  ensureInitialized()
  const master = getMaster()
  const inv = getInv()
  const positions = inv.getStockPositions(filter.warehouseId, filter.search)
  const rows: StockAvailability[] = []

  for (const p of positions) {
    const row = buildStockRow(p.itemId, p.warehouseId)
    if (row && matchesStockFilter(row, filter)) rows.push(row)
  }

  if (rows.length === 0 && !filter.warehouseId) {
    for (const item of master.items.filter((i) => i.isStockable)) {
      for (const wh of master.warehouses.filter((w) => w.isActive)) {
        const row = buildStockRow(item.id, wh.id)
        if (row && matchesStockFilter(row, filter)) rows.push(row)
      }
    }
  }

  return rows.sort((a, b) => a.itemCode.localeCompare(b.itemCode))
}

export async function getStockDetails(itemId: string, warehouseId?: string): Promise<StockDetailsData | null> {
  if (isApiMode()) return getLiveStockDetails(itemId)
  await delay()
  ensureInitialized()
  const item = await getItemById(itemId)
  if (!item) return null
  const master = getMaster()
  const inv = getInv()
  const whIds = warehouseId
    ? [warehouseId]
    : master.warehouses.filter((w) => w.isActive).map((w) => w.id)

  const warehouses: StockDetailsData['warehouses'] = []
  let summaryOnHand = 0
  let summaryQh = 0
  let summaryBlocked = 0
  let summaryReserved = 0
  let summaryAvailable = 0
  let summaryExpected = 0
  let summaryPlanned = 0
  let summaryValue = 0

  for (const whId of whIds) {
    const row = buildStockRow(itemId, whId)
    if (!row) continue
    warehouses.push({
      warehouseId: row.warehouseId,
      warehouseCode: row.warehouseCode,
      warehouseName: row.warehouseName,
      onHand: row.onHand,
      qualityHold: row.qualityHold,
      blocked: row.blocked,
      reserved: row.reserved,
      available: row.available,
      expectedReceipt: row.expectedReceipt,
      plannedIssue: row.plannedIssue,
      stockValue: row.stockValue,
    })
    summaryOnHand += row.onHand
    summaryQh += row.qualityHold
    summaryBlocked += row.blocked
    summaryReserved += row.reserved
    summaryAvailable += row.available
    summaryExpected += row.expectedReceipt
    summaryPlanned += row.plannedIssue
    summaryValue += row.stockValue
  }

  const reservations = inv.getReservations({ itemId }).map((r) => {
    const wh = master.getWarehouse(r.warehouseId)
    const masterItem = master.getItem(r.itemId)
    return {
      id: r.id,
      itemId: r.itemId,
      itemCode: masterItem?.itemCode ?? '—',
      warehouseId: r.warehouseId,
      warehouseName: wh?.warehouseName ?? '—',
      qty: r.qty,
      demandType: r.demandType,
      referenceNo: r.referenceNo,
      status: r.status,
      createdAt: r.createdAt,
    }
  })

  const recentMovements = inv.getItemMovements(itemId).slice(0, 10).map((m) => ({
    movementNo: m.movementNo,
    type: m.referenceType,
    qty: m.qty,
    date: m.movementDate,
    warehouseName: master.getWarehouse(m.warehouseId)?.warehouseName ?? '—',
  }))

  const ext = extensions[itemId]
  const batchRecords = ext?.batchTracking ? await getItemBatches(itemId, warehouseId ? { warehouseId } : {}) : []
  const batches = batchRecords.map((b) => ({
    id: b.id,
    itemId: b.itemId,
    batchNo: b.batchNo,
    warehouseId: b.warehouseId,
    qty: b.availableQty + b.reservedQty,
    expiryDate: b.expiryDate,
    status: b.qualityStatus === 'quality_hold' ? 'quality_hold' as const : b.qualityStatus === 'blocked' ? 'blocked' as const : 'available' as const,
  }))

  const serialRecords = ext?.serialTracking ? await getItemSerials(itemId, warehouseId ? { warehouseId } : {}) : []
  const serials = serialRecords.map((s) => ({
    id: s.id,
    itemId: s.itemId,
    serialNo: s.serialNo,
    warehouseId: s.warehouseId,
    status: s.status === 'available' ? 'available' as const : s.status === 'reserved' ? 'reserved' as const : 'blocked' as const,
  }))

  const traceReservations = await getReservations({ itemId, warehouseId })
  const reservationsMerged = [
    ...reservations,
    ...traceReservations
      .filter((tr) => !reservations.some((r) => r.id === tr.id))
      .map((tr) => ({
        id: tr.id,
        itemId: tr.itemId,
        itemCode: tr.itemCode,
        warehouseId: tr.warehouseId,
        warehouseName: tr.warehouseName,
        qty: tr.qty,
        demandType: tr.source === 'SO' ? 'SO' as const : 'WO' as const,
        referenceNo: tr.referenceNo,
        status: tr.status === 'consumed' ? 'fulfilled' as const : tr.status === 'cancelled' ? 'cancelled' as const : 'active' as const,
        createdAt: tr.createdAt,
      })),
  ]

  return {
    itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    summary: {
      warehouseId: warehouseId ?? 'all',
      warehouseCode: warehouseId ? master.getWarehouse(warehouseId)?.warehouseCode ?? 'ALL' : 'ALL',
      warehouseName: warehouseId ? master.getWarehouse(warehouseId)?.warehouseName ?? 'All Warehouses' : 'All Warehouses',
      onHand: summaryOnHand,
      qualityHold: summaryQh,
      blocked: summaryBlocked,
      reserved: summaryReserved,
      available: summaryAvailable,
      expectedReceipt: summaryExpected,
      plannedIssue: summaryPlanned,
      stockValue: summaryValue,
    },
    warehouses,
    batches,
    serials,
    reservations: reservationsMerged,
    recentMovements,
    valuation: {
      standardCost: item.standardCost,
      averageCost: item.averageCost,
      stockValue: summaryValue,
      lastPurchaseCost: item.lastPurchaseCost,
    },
    planning: {
      reorderLevel: item.reorderLevel,
      reorderQuantity: item.reorderQuantity,
      leadTimeDays: item.leadTimeDays,
      suggestedOrderQty: Math.max(0, item.reorderQuantity - summaryAvailable),
    },
  }
}

export async function getInventoryAuditTrail(itemId: string): Promise<InventoryAuditEntry[]> {
  if (isApiMode()) return []
  await delay()
  return auditTrail.filter((a) => a.itemId === itemId)
}

/** Test helper — reset service state */
export function resetInventoryServiceForTests() {
  extensions = {}
  auditTrail = []
  initialized = false
}
