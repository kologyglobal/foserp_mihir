/**
 * Inventory Setup — live API/master data. Saved views are in-memory only (no persistence API yet).
 */

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
import {
  createMasterApi,
  fetchMasterWarehouses,
  mapWarehouseDto,
  updateMasterApi,
  warehouseToApiPayload,
} from '../api/masterApi'
import { getInventorySetupApi, putInventorySetupApi } from '../api/inventorySetupApi'

const delay = (ms = 30) => new Promise<void>((r) => setTimeout(r, ms))

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

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

function stripMeta(setup: InventorySetup & { version?: number; updatedAt?: string | null }): InventorySetup {
  const { version: _v, updatedAt: _u, ...rest } = setup as InventorySetup & {
    version?: number
    updatedAt?: string | null
  }
  return {
    general: { ...DEFAULT_INVENTORY_SETUP.general, ...rest.general },
    tracking: { ...DEFAULT_INVENTORY_SETUP.tracking, ...rest.tracking },
    quality: { ...DEFAULT_INVENTORY_SETUP.quality, ...rest.quality },
    planning: { ...DEFAULT_INVENTORY_SETUP.planning, ...rest.planning },
    approvals: { ...DEFAULT_INVENTORY_SETUP.approvals, ...rest.approvals },
    advancedWarehouse: { ...DEFAULT_INVENTORY_SETUP.advancedWarehouse, ...rest.advancedWarehouse },
    numberSeries: { ...DEFAULT_INVENTORY_SETUP.numberSeries, ...rest.numberSeries },
  }
}

export async function getInventorySetup(): Promise<InventorySetup> {
  const res = await getInventorySetupApi()
  return stripMeta(res.data)
}

export async function updateInventorySetup(patch: Partial<InventorySetup>): Promise<InventorySetup> {
  const res = await putInventorySetupApi(patch)
  return stripMeta(res.data)
}

/** @deprecated Prefer updateInventorySetup */
export async function updateInventorySetupDemo(patch: Partial<InventorySetup>): Promise<InventorySetup> {
  return updateInventorySetup(patch)
}

export async function getWarehouses(): Promise<InventoryWarehouseRecord[]> {
  const rows = await fetchMasterWarehouses()
  return rows.map((row, idx) => {
    const wh = mapWarehouseDto(row)
    return mapMasterWarehouseToSetup(wh, idx)
  })
}

export async function createWarehouse(input: InventoryWarehouseInput): Promise<InventoryWarehouseRecord> {
  const created = await createMasterApi(
    'warehouses',
    warehouseToApiPayload({
      warehouseCode: input.warehouseCode,
      warehouseName: input.warehouseName,
      warehouseType:
        input.warehouseType === 'wip'
          ? 'wip'
          : input.warehouseType === 'finished'
            ? 'fg'
            : input.warehouseType === 'transit'
              ? 'sub'
              : 'main',
      plantCode: input.plantCode,
      address: input.location || '',
      isActive: input.isActive,
    }),
  )
  const wh = mapWarehouseDto(created.data)
  return { ...mapMasterWarehouseToSetup(wh, 0), ...input, id: wh.id }
}

export async function updateWarehouse(
  id: string,
  input: Partial<InventoryWarehouseInput>,
): Promise<InventoryWarehouseRecord> {
  const current = (await getWarehouses()).find((w) => w.id === id)
  if (!current) throw new Error('Warehouse not found')
  const merged = { ...current, ...input }
  await updateMasterApi(
    'warehouses',
    id,
    warehouseToApiPayload({
      warehouseCode: merged.warehouseCode,
      warehouseName: merged.warehouseName,
      warehouseType:
        merged.warehouseType === 'wip'
          ? 'wip'
          : merged.warehouseType === 'finished'
            ? 'fg'
            : merged.warehouseType === 'transit'
              ? 'sub'
              : 'main',
      plantCode: merged.plantCode,
      address: merged.location || '',
      isActive: merged.isActive,
    }),
  )
  return merged
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
