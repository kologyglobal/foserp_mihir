import type { GeoCity, GeoCountry, GeoState } from '../../types/geography'
import type { Location, Product, Uom, Warehouse } from '../../types/master'
import { formatApiError } from '../api/apiErrors'
import { useMasterStore } from '../../store/masterStore'
import * as api from '../api/masterApi'
import { bumpMasterLookupCache } from '../api/lookupCache'

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

function removeCountry(id: string): void {
  useMasterStore.setState((s) => ({ geoCountries: s.geoCountries.filter((c) => c.id !== id) }))
  bumpMasterLookupCache()
}

function removeState(id: string): void {
  useMasterStore.setState((s) => ({ geoStates: s.geoStates.filter((st) => st.id !== id) }))
  bumpMasterLookupCache()
}

function removeCity(id: string): void {
  useMasterStore.setState((s) => ({ geoCities: s.geoCities.filter((c) => c.id !== id) }))
  bumpMasterLookupCache()
}

function removeUom(id: string): void {
  useMasterStore.setState((s) => ({ uoms: s.uoms.filter((u) => u.id !== id) }))
  bumpMasterLookupCache()
}

function removeWarehouse(id: string): void {
  useMasterStore.setState((s) => ({ warehouses: s.warehouses.filter((w) => w.id !== id) }))
  bumpMasterLookupCache()
}

function removeLocation(id: string): void {
  useMasterStore.setState((s) => ({ locations: s.locations.filter((l) => l.id !== id) }))
  bumpMasterLookupCache()
}

function upsertCountry(row: GeoCountry): void {
  useMasterStore.setState((s) => ({
    geoCountries: [row, ...s.geoCountries.filter((c) => c.id !== row.id)],
  }))
}

function upsertState(row: GeoState): void {
  useMasterStore.setState((s) => ({
    geoStates: [row, ...s.geoStates.filter((st) => st.id !== row.id)],
  }))
}

function upsertCity(row: GeoCity): void {
  useMasterStore.setState((s) => ({
    geoCities: [row, ...s.geoCities.filter((c) => c.id !== row.id)],
  }))
}

function upsertUom(row: Uom): void {
  useMasterStore.setState((s) => ({
    uoms: [row, ...s.uoms.filter((u) => u.id !== row.id)],
  }))
}

function upsertWarehouse(row: Warehouse): void {
  useMasterStore.setState((s) => ({
    warehouses: [row, ...s.warehouses.filter((w) => w.id !== row.id)],
  }))
}

function upsertLocation(row: Location): void {
  useMasterStore.setState((s) => ({
    locations: [row, ...s.locations.filter((l) => l.id !== row.id)],
  }))
}

function upsertProduct(row: Product): void {
  useMasterStore.setState((s) => ({
    products: [row, ...s.products.filter((p) => p.id !== row.id)],
  }))
  bumpMasterLookupCache()
}

export async function syncCoreMastersFromApi(): Promise<void> {
  const [countries, states, cities, uoms, warehouses, locations, products] = await Promise.all([
    api.fetchMasterCountries(),
    api.fetchMasterStates(),
    api.fetchMasterCities(),
    api.fetchMasterUoms(),
    api.fetchMasterWarehouses(),
    api.fetchMasterLocations(),
    api.fetchMasterProducts(),
  ])

  useMasterStore.setState({
    geoCountries: countries.map(api.mapCountryDto),
    geoStates: states.map(api.mapStateDto),
    geoCities: cities.map(api.mapCityDto),
    uoms: uoms.map(api.mapUomDto),
    warehouses: warehouses.map(api.mapWarehouseDto),
    locations: locations.map(api.mapLocationDto),
    products: products.map(api.mapProductDto),
  })
}

export async function apiCreateProduct(
  data: Partial<Product> & Pick<Product, 'productCode' | 'productName' | 'fgItemId'>,
): Promise<string> {
  return withSubmitLock(lockKey('master:product:create'), async () => {
    const { defaultProductMasterFields } = await import('../../utils/productMaster')
    const ts = new Date().toISOString()
    const product = {
      ...defaultProductMasterFields(),
      ...data,
      id: 'temp',
      createdAt: ts,
      updatedAt: ts,
    } as Product
    const res = await api.createMasterApi('products', api.productToApiPayload(product))
    upsertProduct(api.mapProductDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateProduct(id: string, data: Partial<Product>): Promise<void> {
  return withSubmitLock(lockKey('master:product:update', id), async () => {
    const existing = useMasterStore.getState().getProduct(id)
    if (!existing) throw new Error('Product not found')
    const merged = { ...existing, ...data, updatedAt: new Date().toISOString() }
    const res = await api.updateMasterApi('products', id, api.productToApiPayload(merged))
    upsertProduct(api.mapProductDto(res.data))
  })
}

export async function apiCreateCountry(data: Omit<GeoCountry, 'id'>): Promise<string> {
  return withSubmitLock(lockKey('master:country:create'), async () => {
    const res = await api.createMasterApi('countries', api.countryToApiPayload(data))
    upsertCountry(api.mapCountryDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateCountry(id: string, data: Partial<GeoCountry>): Promise<void> {
  return withSubmitLock(lockKey('master:country:update', id), async () => {
    const existing = useMasterStore.getState().getGeoCountry(id)
    if (!existing) throw new Error('Country not found')
    const merged = { ...existing, ...data }
    const res = await api.updateMasterApi('countries', id, api.countryToApiPayload(merged))
    upsertCountry(api.mapCountryDto(res.data))
  })
}

export async function apiCreateState(data: Omit<GeoState, 'id'>): Promise<string> {
  return withSubmitLock(lockKey('master:state:create'), async () => {
    const res = await api.createMasterApi('states', api.stateToApiPayload(data))
    upsertState(api.mapStateDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateState(id: string, data: Partial<GeoState>): Promise<void> {
  return withSubmitLock(lockKey('master:state:update', id), async () => {
    const existing = useMasterStore.getState().getGeoState(id)
    if (!existing) throw new Error('State not found')
    const merged = { ...existing, ...data }
    const res = await api.updateMasterApi('states', id, api.stateToApiPayload(merged))
    upsertState(api.mapStateDto(res.data))
  })
}

export async function apiCreateCity(data: Omit<GeoCity, 'id'>): Promise<string> {
  return withSubmitLock(lockKey('master:city:create'), async () => {
    const res = await api.createMasterApi('cities', api.cityToApiPayload(data))
    upsertCity(api.mapCityDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateCity(id: string, data: Partial<GeoCity>): Promise<void> {
  return withSubmitLock(lockKey('master:city:update', id), async () => {
    const existing = useMasterStore.getState().getGeoCity(id)
    if (!existing) throw new Error('City not found')
    const merged = { ...existing, ...data }
    const res = await api.updateMasterApi('cities', id, api.cityToApiPayload(merged))
    upsertCity(api.mapCityDto(res.data))
  })
}

export async function apiCreateUom(data: Omit<Uom, 'id' | 'createdAt' | 'updatedAt' | 'createdById' | 'createdByName' | 'modifiedById' | 'modifiedByName' | 'modifiedAt'>): Promise<string> {
  return withSubmitLock(lockKey('master:uom:create'), async () => {
    const res = await api.createMasterApi('uom', api.uomToApiPayload(data))
    upsertUom(api.mapUomDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateUom(id: string, data: Partial<Uom>): Promise<void> {
  return withSubmitLock(lockKey('master:uom:update', id), async () => {
    const existing = useMasterStore.getState().getUom(id)
    if (!existing) throw new Error('UOM not found')
    const merged = { ...existing, ...data }
    const res = await api.updateMasterApi('uom', id, api.uomToApiPayload(merged))
    upsertUom(api.mapUomDto(res.data))
  })
}

export async function apiCreateWarehouse(data: Omit<Warehouse, 'id' | 'createdAt' | 'createdById' | 'createdByName' | 'modifiedById' | 'modifiedByName' | 'modifiedAt'>): Promise<string> {
  return withSubmitLock(lockKey('master:warehouse:create'), async () => {
    const res = await api.createMasterApi('warehouses', api.warehouseToApiPayload(data))
    upsertWarehouse(api.mapWarehouseDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateWarehouse(id: string, data: Partial<Warehouse>): Promise<void> {
  return withSubmitLock(lockKey('master:warehouse:update', id), async () => {
    const existing = useMasterStore.getState().getWarehouse(id)
    if (!existing) throw new Error('Warehouse not found')
    const merged = { ...existing, ...data }
    const res = await api.updateMasterApi('warehouses', id, api.warehouseToApiPayload(merged))
    upsertWarehouse(api.mapWarehouseDto(res.data))
  })
}

export async function apiCreateLocation(data: Omit<Location, 'id' | 'createdAt' | 'createdById' | 'createdByName' | 'modifiedById' | 'modifiedByName' | 'modifiedAt'>): Promise<string> {
  return withSubmitLock(lockKey('master:location:create'), async () => {
    if (!data.warehouseId) throw new Error('Warehouse is required')
    const res = await api.createMasterApi('locations', api.locationToApiPayload(data))
    upsertLocation(api.mapLocationDto(res.data))
    return res.data.id
  })
}

export async function apiUpdateLocation(id: string, data: Partial<Location>): Promise<void> {
  return withSubmitLock(lockKey('master:location:update', id), async () => {
    const existing = useMasterStore.getState().getLocation(id)
    if (!existing) throw new Error('Location not found')
    const merged = { ...existing, ...data }
    const res = await api.updateMasterApi('locations', id, api.locationToApiPayload(merged))
    upsertLocation(api.mapLocationDto(res.data))
  })
}

export async function apiDeleteCountry(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:country:delete', id), async () => {
    await api.deleteMasterApi('countries', id)
    removeCountry(id)
  })
}

export async function apiActivateCountry(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:country:activate', id), async () => {
    const res = await api.activateMasterApi('countries', id)
    upsertCountry(api.mapCountryDto(res.data))
  })
}

export async function apiDeactivateCountry(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:country:deactivate', id), async () => {
    const res = await api.deactivateMasterApi('countries', id)
    upsertCountry(api.mapCountryDto(res.data))
  })
}

export async function apiDeleteState(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:state:delete', id), async () => {
    await api.deleteMasterApi('states', id)
    removeState(id)
  })
}

export async function apiActivateState(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:state:activate', id), async () => {
    const res = await api.activateMasterApi('states', id)
    upsertState(api.mapStateDto(res.data))
  })
}

export async function apiDeactivateState(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:state:deactivate', id), async () => {
    const res = await api.deactivateMasterApi('states', id)
    upsertState(api.mapStateDto(res.data))
  })
}

export async function apiDeleteCity(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:city:delete', id), async () => {
    await api.deleteMasterApi('cities', id)
    removeCity(id)
  })
}

export async function apiActivateCity(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:city:activate', id), async () => {
    const res = await api.activateMasterApi('cities', id)
    upsertCity(api.mapCityDto(res.data))
  })
}

export async function apiDeactivateCity(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:city:deactivate', id), async () => {
    const res = await api.deactivateMasterApi('cities', id)
    upsertCity(api.mapCityDto(res.data))
  })
}

export async function apiDeleteUom(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:uom:delete', id), async () => {
    await api.deleteMasterApi('uom', id)
    removeUom(id)
  })
}

export async function apiActivateUom(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:uom:activate', id), async () => {
    const res = await api.activateMasterApi('uom', id)
    upsertUom(api.mapUomDto(res.data))
  })
}

export async function apiDeactivateUom(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:uom:deactivate', id), async () => {
    const res = await api.deactivateMasterApi('uom', id)
    upsertUom(api.mapUomDto(res.data))
  })
}

export async function apiDeleteWarehouse(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:warehouse:delete', id), async () => {
    await api.deleteMasterApi('warehouses', id)
    removeWarehouse(id)
  })
}

export async function apiActivateWarehouse(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:warehouse:activate', id), async () => {
    const res = await api.activateMasterApi('warehouses', id)
    upsertWarehouse(api.mapWarehouseDto(res.data))
  })
}

export async function apiDeactivateWarehouse(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:warehouse:deactivate', id), async () => {
    const res = await api.deactivateMasterApi('warehouses', id)
    upsertWarehouse(api.mapWarehouseDto(res.data))
  })
}

export async function apiDeleteLocation(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:location:delete', id), async () => {
    await api.deleteMasterApi('locations', id)
    removeLocation(id)
  })
}

export async function apiActivateLocation(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:location:activate', id), async () => {
    const res = await api.activateMasterApi('locations', id)
    upsertLocation(api.mapLocationDto(res.data))
  })
}

export async function apiDeactivateLocation(id: string): Promise<void> {
  return withSubmitLock(lockKey('master:location:deactivate', id), async () => {
    const res = await api.deactivateMasterApi('locations', id)
    upsertLocation(api.mapLocationDto(res.data))
  })
}

export { formatApiError }
