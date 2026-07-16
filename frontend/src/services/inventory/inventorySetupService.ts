/**
 * Inventory Setup & Saved Views mock service (Phase 6).
 */

import { useMasterStore } from '../../store/masterStore'
import type {
  InventorySavedView,
  InventorySetup,
  InventoryWarehouseInput,
  InventoryWarehouseRecord,
} from '../../types/inventoryDomain'
import {
  DEFAULT_INVENTORY_SETUP,
  INVENTORY_SAVED_VIEW_PRESETS,
  mapMasterWarehouseToSetup,
} from './inventorySetupSeed'

const delay = (ms = 60) => new Promise<void>((r) => setTimeout(r, ms))

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

let setupStore: InventorySetup = structuredClone(DEFAULT_INVENTORY_SETUP)
const warehouseExtensions = new Map<string, Partial<InventoryWarehouseRecord>>()
let savedViewsStore: InventorySavedView[] = INVENTORY_SAVED_VIEW_PRESETS.map((p, idx) => ({
  id: `sys-view-${idx}`,
  name: p.name,
  workspace: p.workspace,
  filters: p.filters,
  columns: [],
  sortOrder: '',
  isSystem: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}))

export async function getInventorySetup(): Promise<InventorySetup> {
  await delay()
  return structuredClone(setupStore)
}

export async function updateInventorySetupDemo(patch: Partial<InventorySetup>): Promise<InventorySetup> {
  await delay()
  setupStore = {
    ...setupStore,
    ...patch,
    general: { ...setupStore.general, ...patch.general },
    tracking: { ...setupStore.tracking, ...patch.tracking },
    quality: { ...setupStore.quality, ...patch.quality },
    planning: { ...setupStore.planning, ...patch.planning },
    approvals: { ...setupStore.approvals, ...patch.approvals },
    advancedWarehouse: { ...setupStore.advancedWarehouse, ...patch.advancedWarehouse },
    numberSeries: { ...setupStore.numberSeries, ...patch.numberSeries },
  }
  return structuredClone(setupStore)
}

export async function getWarehouses(): Promise<InventoryWarehouseRecord[]> {
  await delay()
  const master = useMasterStore.getState()
  return master.warehouses.map((wh, idx) => {
    const base = mapMasterWarehouseToSetup(wh, idx)
    const ext = warehouseExtensions.get(wh.id)
    return ext ? { ...base, ...ext } : base
  })
}

export async function createWarehouse(input: InventoryWarehouseInput): Promise<InventoryWarehouseRecord> {
  await delay()
  const master = useMasterStore.getState()
  if (master.warehouses.some((w) => w.warehouseCode.toLowerCase() === input.warehouseCode.toLowerCase())) {
    throw new Error('Warehouse code already exists')
  }
  const id = await Promise.resolve(master.addWarehouse({
    warehouseCode: input.warehouseCode,
    warehouseName: input.warehouseName,
    warehouseType: input.warehouseType === 'wip' ? 'wip' : input.warehouseType === 'finished' ? 'fg' : input.warehouseType === 'transit' ? 'sub' : 'main',
    plantCode: input.plantCode,
    address: input.location || '',
    isActive: input.isActive,
  }))
  const record: InventoryWarehouseRecord = { id, ...input }
  warehouseExtensions.set(id, record)
  return record
}

export async function updateWarehouse(id: string, input: Partial<InventoryWarehouseInput>): Promise<InventoryWarehouseRecord> {
  await delay()
  const master = useMasterStore.getState()
  const existing = master.getWarehouse(id)
  if (!existing) throw new Error('Warehouse not found')
  await Promise.resolve(master.updateWarehouse(id, {
    warehouseCode: input.warehouseCode,
    warehouseName: input.warehouseName,
    plantCode: input.plantCode,
    isActive: input.isActive,
  }))
  const current = (await getWarehouses()).find((w) => w.id === id)!
  const updated = { ...current, ...input }
  warehouseExtensions.set(id, updated)
  return updated
}

export async function getSavedInventoryViews(workspace?: string): Promise<InventorySavedView[]> {
  await delay(30)
  const views = [...savedViewsStore]
  if (workspace) return views.filter((v) => v.workspace === workspace)
  return views
}

export async function saveInventoryView(
  view: Omit<InventorySavedView, 'id' | 'createdAt' | 'isSystem'> & { id?: string },
): Promise<InventorySavedView> {
  await delay(30)
  if (view.id) {
    const idx = savedViewsStore.findIndex((v) => v.id === view.id)
    if (idx >= 0) {
      savedViewsStore[idx] = { ...savedViewsStore[idx], ...view, isSystem: false }
      return savedViewsStore[idx]
    }
  }
  const existing = savedViewsStore.find((v) => v.name === view.name && v.workspace === view.workspace)
  if (existing && !existing.isSystem) {
    const updated = { ...existing, ...view, isSystem: false }
    savedViewsStore = savedViewsStore.map((v) => (v.id === existing.id ? updated : v))
    return updated
  }
  const saved: InventorySavedView = {
    id: genId('inv-view'),
    name: view.name,
    workspace: view.workspace,
    filters: view.filters,
    columns: view.columns,
    sortOrder: view.sortOrder,
    isSystem: false,
    createdAt: new Date().toISOString(),
  }
  savedViewsStore = [saved, ...savedViewsStore]
  return saved
}

export async function deleteInventoryView(id: string): Promise<void> {
  await delay(30)
  const target = savedViewsStore.find((v) => v.id === id)
  if (target?.isSystem) throw new Error('System views cannot be deleted')
  savedViewsStore = savedViewsStore.filter((v) => v.id !== id)
}

/** Test helper */
export function resetInventorySetupForTests() {
  setupStore = structuredClone(DEFAULT_INVENTORY_SETUP)
  warehouseExtensions.clear()
  savedViewsStore = INVENTORY_SAVED_VIEW_PRESETS.map((p, idx) => ({
    id: `sys-view-${idx}`,
    name: p.name,
    workspace: p.workspace,
    filters: p.filters,
    columns: [],
    sortOrder: '',
    isSystem: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  }))
}
