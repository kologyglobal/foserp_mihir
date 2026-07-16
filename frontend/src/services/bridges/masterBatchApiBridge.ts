import type { Item, ItemCategory, Vendor } from '../../types/master'
import type { GstGroupCode, GstRate, HsnMaster } from '../../types/taxMaster'
import { useMasterStore } from '../../store/masterStore'
import { bumpMasterLookupCache } from '../api/lookupCache'
import * as api from '../api/masterBatchApi'

const submitLocks = new Set<string>()

function lockKey(scope: string, id?: string): string {
  return id ? `${scope}:${id}` : scope
}

async function withSubmitLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (submitLocks.has(key)) throw new Error('Operation already in progress')
  submitLocks.add(key)
  try {
    return await fn()
  } finally {
    submitLocks.delete(key)
  }
}

function upsertCategory(row: ItemCategory): void {
  useMasterStore.setState((s) => ({
    categories: [row, ...s.categories.filter((c) => c.id !== row.id)],
  }))
  bumpMasterLookupCache()
}

function removeCategory(id: string): void {
  useMasterStore.setState((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
  bumpMasterLookupCache()
}

function upsertHsn(row: HsnMaster): void {
  useMasterStore.setState((s) => ({
    hsnMasters: [row, ...s.hsnMasters.filter((h) => h.id !== row.id)],
  }))
  bumpMasterLookupCache()
}

function removeHsn(id: string): void {
  useMasterStore.setState((s) => ({ hsnMasters: s.hsnMasters.filter((h) => h.id !== id) }))
  bumpMasterLookupCache()
}

function upsertGstGroup(row: GstGroupCode): void {
  useMasterStore.setState((s) => ({
    gstGroups: [row, ...s.gstGroups.filter((g) => g.id !== row.id)],
  }))
  bumpMasterLookupCache()
}

function removeGstGroup(id: string): void {
  useMasterStore.setState((s) => ({ gstGroups: s.gstGroups.filter((g) => g.id !== id) }))
  bumpMasterLookupCache()
}

function upsertGstRate(row: GstRate): void {
  useMasterStore.setState((s) => ({
    gstRates: [row, ...s.gstRates.filter((r) => r.id !== row.id)],
  }))
  bumpMasterLookupCache()
}

function removeGstRate(id: string): void {
  useMasterStore.setState((s) => ({ gstRates: s.gstRates.filter((r) => r.id !== id) }))
  bumpMasterLookupCache()
}

function upsertItem(row: Item): void {
  useMasterStore.setState((s) => ({
    items: [row, ...s.items.filter((i) => i.id !== row.id)],
  }))
  bumpMasterLookupCache()
}

function removeItem(id: string): void {
  useMasterStore.setState((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  bumpMasterLookupCache()
}

function upsertVendor(row: Vendor): void {
  useMasterStore.setState((s) => ({
    vendors: [row, ...s.vendors.filter((v) => v.id !== row.id)],
  }))
  bumpMasterLookupCache()
}

function removeVendor(id: string): void {
  useMasterStore.setState((s) => ({ vendors: s.vendors.filter((v) => v.id !== id) }))
  bumpMasterLookupCache()
}

export async function syncBatchMastersFromApi(): Promise<void> {
  const [categories, hsn, gstGroups, gstRates, items, vendors] = await Promise.all([
    api.fetchItemCategories(),
    api.fetchHsnCodes(),
    api.fetchGstGroups(),
    api.fetchGstRates(),
    api.fetchItems(),
    api.fetchVendors(),
  ])

  useMasterStore.setState({
    categories: categories.map(api.mapCategoryDto),
    hsnMasters: hsn.map(api.mapHsnDto),
    gstGroups: gstGroups.map(api.mapGstGroupDto),
    gstRates: gstRates.map(api.mapGstRateDto),
    items: items.map(api.mapItemDto),
    vendors: vendors.map(api.mapVendorDto),
  })
}

export async function apiCreateCategory(data: Omit<ItemCategory, 'id' | 'createdAt'>): Promise<string> {
  return withSubmitLock(lockKey('master:category:create'), async () => {
    const res = await api.createMasterApi('item-categories', api.categoryToApiPayload(data))
    upsertCategory(api.mapCategoryDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateCategory(id: string, data: Partial<ItemCategory>): Promise<void> {
  return withSubmitLock(lockKey('master:category:update', id), async () => {
    const existing = useMasterStore.getState().getCategory(id)
    if (!existing) throw new Error('Category not found')
    const merged = { ...existing, ...data }
    const res = await api.updateMasterApi('item-categories', id, api.categoryToApiPayload(merged))
    upsertCategory(api.mapCategoryDto(res.data))
  })
}

export async function apiDeleteCategory(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:category:delete', id), async () => {
    await api.deleteMasterApi('item-categories', id)
    removeCategory(id)
  })
}

export async function apiActivateCategory(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:category:activate', id), async () => {
    const res = await api.activateMasterApi('item-categories', id)
    upsertCategory(api.mapCategoryDto(res.data))
  })
}

export async function apiDeactivateCategory(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:category:deactivate', id), async () => {
    const res = await api.deactivateMasterApi('item-categories', id)
    upsertCategory(api.mapCategoryDto(res.data))
  })
}

export async function apiCreateHsn(data: Omit<HsnMaster, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return withSubmitLock(lockKey('master:hsn:create'), async () => {
    const res = await api.createMasterApi('hsn-sac', api.hsnToApiPayload(data))
    upsertHsn(api.mapHsnDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateHsn(id: string, data: Partial<HsnMaster>): Promise<void> {
  return withSubmitLock(lockKey('master:hsn:update', id), async () => {
    const existing = useMasterStore.getState().getHsn(id)
    if (!existing) throw new Error('HSN not found')
    const merged = { ...existing, ...data }
    const res = await api.updateMasterApi('hsn-sac', id, api.hsnToApiPayload(merged))
    upsertHsn(api.mapHsnDto(res.data))
  })
}

export async function apiDeleteHsn(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:hsn:delete', id), async () => {
    await api.deleteMasterApi('hsn-sac', id)
    removeHsn(id)
  })
}

export async function apiActivateHsn(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:hsn:activate', id), async () => {
    const res = await api.activateMasterApi('hsn-sac', id)
    upsertHsn(api.mapHsnDto(res.data))
  })
}

export async function apiDeactivateHsn(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:hsn:deactivate', id), async () => {
    const res = await api.deactivateMasterApi('hsn-sac', id)
    upsertHsn(api.mapHsnDto(res.data))
  })
}

export async function apiCreateGstGroup(data: Omit<GstGroupCode, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return withSubmitLock(lockKey('master:gst-group:create'), async () => {
    const res = await api.createMasterApi('gst-groups', api.gstGroupToApiPayload(data))
    upsertGstGroup(api.mapGstGroupDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateGstGroup(id: string, data: Partial<GstGroupCode>): Promise<void> {
  return withSubmitLock(lockKey('master:gst-group:update', id), async () => {
    const existing = useMasterStore.getState().getGstGroup(id)
    if (!existing) throw new Error('GST group not found')
    const merged = { ...existing, ...data }
    const res = await api.updateMasterApi('gst-groups', id, api.gstGroupToApiPayload(merged))
    upsertGstGroup(api.mapGstGroupDto(res.data))
  })
}

export async function apiDeleteGstGroup(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:gst-group:delete', id), async () => {
    await api.deleteMasterApi('gst-groups', id)
    removeGstGroup(id)
  })
}

export async function apiActivateGstGroup(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:gst-group:activate', id), async () => {
    const res = await api.activateMasterApi('gst-groups', id)
    upsertGstGroup(api.mapGstGroupDto(res.data))
  })
}

export async function apiDeactivateGstGroup(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:gst-group:deactivate', id), async () => {
    const res = await api.deactivateMasterApi('gst-groups', id)
    upsertGstGroup(api.mapGstGroupDto(res.data))
  })
}

export async function apiCreateGstRate(data: Omit<GstRate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return withSubmitLock(lockKey('master:gst-rate:create'), async () => {
    const res = await api.createMasterApi('gst-rates', api.gstRateToApiPayload(data))
    upsertGstRate(api.mapGstRateDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateGstRate(id: string, data: Partial<GstRate>): Promise<void> {
  return withSubmitLock(lockKey('master:gst-rate:update', id), async () => {
    const existing = useMasterStore.getState().getGstRate(id)
    if (!existing) throw new Error('GST rate not found')
    const merged = { ...existing, ...data }
    const res = await api.updateMasterApi('gst-rates', id, api.gstRateToApiPayload(merged))
    upsertGstRate(api.mapGstRateDto(res.data))
  })
}

export async function apiDeleteGstRate(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:gst-rate:delete', id), async () => {
    await api.deleteMasterApi('gst-rates', id)
    removeGstRate(id)
  })
}

export async function apiActivateGstRate(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:gst-rate:activate', id), async () => {
    const res = await api.activateMasterApi('gst-rates', id)
    upsertGstRate(api.mapGstRateDto(res.data))
  })
}

export async function apiDeactivateGstRate(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:gst-rate:deactivate', id), async () => {
    const res = await api.deactivateMasterApi('gst-rates', id)
    upsertGstRate(api.mapGstRateDto(res.data))
  })
}

export async function apiCreateItem(data: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  return withSubmitLock(lockKey('master:item:create'), async () => {
    const res = await api.createItemApi(api.itemToApiPayload(data as Item))
    upsertItem(api.mapItemDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateItem(id: string, data: Partial<Item>): Promise<void> {
  return withSubmitLock(lockKey('master:item:update', id), async () => {
    const existing = useMasterStore.getState().getItem(id)
    if (!existing) throw new Error('Item not found')
    const merged = { ...existing, ...data }
    const res = await api.updateItemApi(id, api.itemToApiPayload(merged))
    upsertItem(api.mapItemDto(res.data))
  })
}

export async function apiDeleteItem(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:item:delete', id), async () => {
    await api.deleteItemApi(id)
    removeItem(id)
  })
}

export async function apiActivateItem(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:item:activate', id), async () => {
    const res = await api.activateItemApi(id)
    upsertItem(api.mapItemDto(res.data))
  })
}

export async function apiDeactivateItem(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:item:deactivate', id), async () => {
    const res = await api.deactivateItemApi(id)
    upsertItem(api.mapItemDto(res.data))
  })
}

export async function apiCreateVendor(data: Omit<Vendor, 'id' | 'createdAt'>): Promise<string> {
  return withSubmitLock(lockKey('master:vendor:create'), async () => {
    const res = await api.createVendorApi(api.vendorToApiPayload(data as Vendor))
    upsertVendor(api.mapVendorDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateVendor(id: string, data: Partial<Vendor>): Promise<void> {
  return withSubmitLock(lockKey('master:vendor:update', id), async () => {
    const existing = useMasterStore.getState().getVendor(id)
    if (!existing) throw new Error('Vendor not found')
    const merged = { ...existing, ...data }
    const res = await api.updateVendorApi(id, api.vendorToApiPayload(merged))
    upsertVendor(api.mapVendorDto(res.data))
  })
}

export async function apiDeleteVendor(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:vendor:delete', id), async () => {
    await api.deleteVendorApi(id)
    removeVendor(id)
  })
}

export async function apiActivateVendor(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:vendor:activate', id), async () => {
    const res = await api.activateVendorApi(id)
    upsertVendor(api.mapVendorDto(res.data))
  })
}

export async function apiDeactivateVendor(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:vendor:deactivate', id), async () => {
    const res = await api.deactivateVendorApi(id)
    upsertVendor(api.mapVendorDto(res.data))
  })
}
