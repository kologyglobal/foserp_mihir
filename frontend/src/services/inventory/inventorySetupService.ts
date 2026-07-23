/**
 * Inventory Setup — demo memory store + live API/master dual-mode.
 */

import { isApiMode } from '../../config/apiConfig'
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
import {
  createMasterApi,
  fetchMasterWarehouses,
  mapWarehouseDto,
  updateMasterApi,
  warehouseToApiPayload,
} from '../api/masterApi'
import { getInventorySetupApi, putInventorySetupApi } from '../api/inventorySetupApi'

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
  if (isApiMode()) {
    const res = await getInventorySetupApi()
    return stripMeta(res.data)
  }
  await delay()
  return structuredClone(setupStore)
}

export async function updateInventorySetup(patch: Partial<InventorySetup>): Promise<InventorySetup> {
  if (isApiMode()) {
    const res = await putInventorySetupApi(patch)
    return stripMeta(res.data)
  }
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

/** @deprecated Prefer updateInventorySetup */
export async function updateInventorySetupDemo(patch: Partial<InventorySetup>): Promise<InventorySetup> {
  return updateInventorySetup(patch)
}

export async function getWarehouses(): Promise<InventoryWarehouseRecord[]> {
  if (isApiMode()) {
    const rows = await fetchMasterWarehouses()
    return rows.map((row, idx) => {
      const wh = mapWarehouseDto(row)
      return mapMasterWarehouseToSetup(wh, idx)
    })
  }
  await delay()
  const master = useMasterStore.getState()
  return master.warehouses.map((wh, idx) => {
    const base = mapMasterWarehouseToSetup(wh, idx)
    const ext = warehouseExtensions.get(wh.id)
    return ext ? { ...base, ...ext } : base
  })
}

export async function createWarehouse(input: InventoryWarehouseInput): Promise<InventoryWarehouseRecord> {
  if (isApiMode()) {
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
  await delay()
  const master = useMasterStore.getState()
  if (master.warehouses.some((w) => w.warehouseCode.toLowerCase() === input.warehouseCode.toLowerCase())) {
    throw new Error('Warehouse code already exists')
  }
  const id = await Promise.resolve(
    master.addWarehouse({
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
  const record: InventoryWarehouseRecord = { id, ...input }
  warehouseExtensions.set(id, record)
  return record
}

export async function updateWarehouse(
  id: string,
  input: Partial<InventoryWarehouseInput>,
): Promise<InventoryWarehouseRecord> {
  if (isApiMode()) {
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
  await delay()
  const master = useMasterStore.getState()
  const existing = master.getWarehouse(id)
  if (!existing) throw new Error('Warehouse not found')
  await Promise.resolve(
    master.updateWarehouse(id, {
      warehouseCode: input.warehouseCode,
      warehouseName: input.warehouseName,
      plantCode: input.plantCode,
      isActive: input.isActive,
    }),
  )
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
