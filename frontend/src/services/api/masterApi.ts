import type { GeoCity, GeoCountry, GeoState } from '../../types/geography'
import type { Location, Product, Uom, Warehouse } from '../../types/master'
import { apiRequest, tenantPath } from './client'
import { defaultProductMasterFields } from '../../utils/productMaster'

export interface MasterRecordDto {
  id: string
  code?: string
  name: string
  status: 'ACTIVE' | 'INACTIVE'
  stateId?: string
  warehouseId?: string
  plantId?: string | null
  storageLocationId?: string
  binType?: string | null
  parentId?: string | null
  level?: number
  defaultWarehouseId?: string | null
  stockPolicy?: string
  defaultIsStockable?: boolean
  defaultInventoryType?: string
  gstGroupId?: string
  goodsType?: string
  fromState?: string
  locationStateCode?: string
  dateFrom?: string
  dateTo?: string | null
  sgst?: number | string
  cgst?: number | string
  igst?: number | string
  applicableFor?: 'SALES' | 'PURCHASE' | 'BOTH'
  description?: string | null
  uomType?: string
  decimalPlaces?: number
  isBaseUnit?: boolean
  warehouseType?: string
  plantCode?: string
  address?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  country?: string | null
  gstin?: string | null
  registeredType?: string | null
  allowSales?: boolean
  allowPurchase?: boolean
  allowProduction?: boolean
  allowInventory?: boolean
  productFamily?: string
  productType?: string
  fgItemId?: string | null
  capacity?: string
  axleConfig?: string
  tareWeightKg?: number | string
  gvwKg?: number | string
  standardPrice?: number | string
  standardLeadDays?: number
  baseUomId?: string | null
  hsnCode?: string
  specifications?: string
  productStatus?: string
  details?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface PaginatedMasterResponse {
  data: MasterRecordDto[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

async function fetchAllPages(resource: string, params?: Record<string, string | number | undefined>): Promise<MasterRecordDto[]> {
  const limit = 100
  let page = 1
  const all: MasterRecordDto[] = []
  for (;;) {
    const res = await apiRequest<MasterRecordDto[]>(
      `${tenantPath(`/masters/${resource}`)}${buildQuery({ ...params, page, limit })}`,
    )
    all.push(...res.data)
    const meta = res.meta
    if (!meta || page >= meta.totalPages) break
    page += 1
  }
  return all
}

export async function fetchMasterCountries() {
  return fetchAllPages('countries')
}

export async function fetchMasterStates() {
  return fetchAllPages('states')
}

export async function fetchMasterCities() {
  return fetchAllPages('cities')
}

export async function fetchMasterUoms() {
  return fetchAllPages('uom')
}

export async function fetchMasterWarehouses() {
  return fetchAllPages('warehouses')
}

export async function fetchMasterLocations() {
  return fetchAllPages('locations')
}

export async function fetchMasterPlants() {
  return fetchAllPages('plants')
}

export async function fetchMasterBins(params?: { warehouseId?: string; storageLocationId?: string }) {
  return fetchAllPages('bins', params)
}

export interface MasterLookupRow {
  id: string
  code?: string
  name: string
  stateId?: string
  warehouseId?: string
  plantId?: string | null
  storageLocationId?: string
  warehouseType?: string
}

export async function fetchLookup(resource: string, params?: Record<string, string | undefined>) {
  return apiRequest<MasterLookupRow[]>(
    `${tenantPath(`/lookups/${resource}`)}${buildQuery(params)}`,
  )
}

export async function createMasterApi(resource: string, body: Record<string, unknown>) {
  return apiRequest<MasterRecordDto>(tenantPath(`/masters/${resource}`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateMasterApi(resource: string, id: string, body: Record<string, unknown>) {
  return apiRequest<MasterRecordDto>(tenantPath(`/masters/${resource}/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteMasterApi(resource: string, id: string) {
  return apiRequest<null>(tenantPath(`/masters/${resource}/${id}`), { method: 'DELETE' })
}

export async function activateMasterApi(resource: string, id: string) {
  return apiRequest<MasterRecordDto>(tenantPath(`/masters/${resource}/${id}/activate`), { method: 'POST' })
}

export async function deactivateMasterApi(resource: string, id: string) {
  return apiRequest<MasterRecordDto>(tenantPath(`/masters/${resource}/${id}/deactivate`), { method: 'POST' })
}

function toStatus(isActive: boolean | undefined): 'ACTIVE' | 'INACTIVE' {
  return isActive === false ? 'INACTIVE' : 'ACTIVE'
}

export function countryToApiPayload(data: Pick<GeoCountry, 'countryCode' | 'countryName' | 'isActive'>) {
  return { code: data.countryCode.trim(), name: data.countryName.trim(), status: toStatus(data.isActive) }
}

export function stateToApiPayload(data: Pick<GeoState, 'stateCode' | 'stateName' | 'isActive'>) {
  return { code: data.stateCode.trim(), name: data.stateName.trim(), status: toStatus(data.isActive) }
}

export function cityToApiPayload(data: Pick<GeoCity, 'stateId' | 'cityName' | 'isActive'>) {
  return { stateId: data.stateId, name: data.cityName.trim(), status: toStatus(data.isActive) }
}

export function uomToApiPayload(data: Pick<Uom, 'uomCode' | 'uomName' | 'description' | 'uomType' | 'decimalPlaces' | 'isBaseUnit' | 'isActive'>) {
  return {
    code: data.uomCode.trim(),
    name: data.uomName.trim(),
    description: data.description?.trim() || data.uomName.trim(),
    uomType: data.uomType,
    decimalPlaces: data.decimalPlaces,
    isBaseUnit: data.isBaseUnit ?? false,
    status: toStatus(data.isActive),
  }
}

export function warehouseToApiPayload(data: Pick<Warehouse, 'warehouseCode' | 'warehouseName' | 'warehouseType' | 'plantCode' | 'address' | 'isActive'>) {
  return {
    code: data.warehouseCode.trim(),
    name: data.warehouseName.trim(),
    warehouseType: data.warehouseType,
    plantCode: data.plantCode?.trim() || 'PUNE',
    address: data.address?.trim() || undefined,
    status: toStatus(data.isActive),
  }
}

export function locationToApiPayload(data: Pick<Location, 'warehouseId' | 'locationCode' | 'locationName' | 'address' | 'address2' | 'city' | 'state' | 'postCode' | 'country' | 'gstin' | 'registeredType' | 'allowSales' | 'allowPurchase' | 'allowProduction' | 'isActive'>) {
  return {
    warehouseId: data.warehouseId ?? undefined,
    code: data.locationCode.trim(),
    name: data.locationName.trim(),
    addressLine1: data.address?.trim() || undefined,
    addressLine2: data.address2?.trim() || undefined,
    city: data.city?.trim() || undefined,
    state: data.state?.trim() || undefined,
    pincode: data.postCode?.trim() || undefined,
    country: data.country?.trim() || undefined,
    gstin: data.gstin?.trim() || undefined,
    registeredType: data.registeredType || undefined,
    allowSales: data.allowSales,
    allowPurchase: data.allowPurchase,
    allowProduction: data.allowProduction,
    status: toStatus(data.isActive),
  }
}

export function mapCountryDto(row: MasterRecordDto): GeoCountry {
  return {
    id: row.id,
    countryCode: row.code ?? '',
    countryName: row.name,
    isActive: row.status === 'ACTIVE',
  }
}

export function mapStateDto(row: MasterRecordDto): GeoState {
  return {
    id: row.id,
    stateCode: row.code ?? '',
    stateName: row.name,
    isActive: row.status === 'ACTIVE',
  }
}

export function mapCityDto(row: MasterRecordDto): GeoCity {
  return {
    id: row.id,
    stateId: row.stateId ?? '',
    cityName: row.name,
    isActive: row.status === 'ACTIVE',
  }
}

export function mapUomDto(row: MasterRecordDto): Uom {
  return {
    id: row.id,
    uomCode: row.code ?? '',
    uomName: row.name,
    description: row.description ?? row.name,
    uomType: (row.uomType ?? 'integer') as Uom['uomType'],
    decimalPlaces: row.decimalPlaces ?? 0,
    isBaseUnit: row.isBaseUnit ?? false,
    isActive: row.status === 'ACTIVE',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapWarehouseDto(row: MasterRecordDto): Warehouse {
  return {
    id: row.id,
    warehouseCode: row.code ?? '',
    warehouseName: row.name,
    warehouseType: (row.warehouseType ?? 'main') as Warehouse['warehouseType'],
    plantId: row.plantId ?? null,
    plantCode: row.plantCode ?? 'PUNE',
    address: row.address ?? '',
    isActive: row.status === 'ACTIVE',
    createdAt: row.createdAt,
  }
}

export function mapLocationDto(row: MasterRecordDto): Location {
  const line1 = row.addressLine1 ?? row.address ?? ''
  return {
    id: row.id,
    locationCode: row.code ?? '',
    locationName: row.name,
    warehouseId: row.warehouseId ?? null,
    address: line1,
    address2: row.addressLine2 ?? undefined,
    city: row.city ?? '',
    state: row.state ?? '',
    postCode: row.pincode ?? '',
    country: row.country ?? 'India',
    contactName: '',
    phone: '',
    email: '',
    registeredType: (row.registeredType ?? 'regular_taxpayer') as Location['registeredType'],
    gstin: row.gstin ?? undefined,
    useAsInTransit: false,
    requireShipment: false,
    requireReceive: false,
    allowSales: row.allowSales ?? true,
    allowPurchase: row.allowPurchase ?? true,
    allowProduction: row.allowProduction ?? true,
    isDefault: false,
    isActive: row.status === 'ACTIVE',
    createdAt: row.createdAt,
  }
}

function num(value: number | string | null | undefined, fallback = 0): number {
  if (value == null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

export async function fetchMasterProducts() {
  return fetchAllPages('products')
}

export function productToApiPayload(data: Product) {
  return {
    code: data.productCode.trim(),
    name: data.productName.trim(),
    productFamily: data.productFamily,
    productType: data.productType,
    fgItemId: data.fgItemId || null,
    capacity: data.capacity ?? '',
    axleConfig: data.axleConfig ?? '',
    tareWeightKg: data.tareWeightKg,
    gvwKg: data.gvwKg,
    standardPrice: data.standardPrice,
    standardLeadDays: data.standardLeadDays,
    baseUomId: data.baseUomId || null,
    hsnCode: data.hsnCode ?? '',
    specifications: data.specifications ?? '',
    productStatus: data.status,
    details: {
      productRevision: data.productRevision,
      drawingRevision: data.drawingRevision,
      bomRevision: data.bomRevision,
      routingRevision: data.routingRevision,
      engineeringOwner: data.engineeringOwner,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo,
      revisionReason: data.revisionReason,
      revisions: data.revisions,
      manufacturing: data.manufacturing,
      standardCost: data.standardCost,
      quality: data.quality,
      sales: data.sales,
      attachments: data.attachments,
      changeLog: data.changeLog,
      productCategory: data.productCategory ?? null,
      material: data.material ?? '',
      application: data.application ?? '',
      parentProductCode: data.parentProductCode ?? null,
      isVariant: Boolean(data.isVariant),
      isConfigurableParent: Boolean(data.isConfigurableParent),
      vehicleGvwLabel: data.vehicleGvwLabel ?? '',
    },
    status: toStatus(data.isActive),
  }
}

export function mapProductDto(row: MasterRecordDto): Product {
  const details = (row.details && typeof row.details === 'object' ? row.details : {}) as Record<string, unknown>
  const defaults = defaultProductMasterFields({
    productFamily: (row.productFamily as Product['productFamily']) ?? 'bulker_trailer',
    status: (row.productStatus as Product['status']) ?? 'draft',
    productRevision: String(details.productRevision ?? 'Rev-0'),
    drawingRevision: String(details.drawingRevision ?? 'DWG-TBD'),
    bomRevision: String(details.bomRevision ?? '—'),
    routingRevision: String(details.routingRevision ?? '—'),
    engineeringOwner: String(details.engineeringOwner ?? 'Unassigned'),
    effectiveFrom: String(details.effectiveFrom ?? row.createdAt.slice(0, 10)),
    effectiveTo: (details.effectiveTo as string | null | undefined) ?? null,
    revisionReason: String(details.revisionReason ?? ''),
    revisions: (details.revisions as Product['revisions']) ?? [],
    manufacturing: details.manufacturing as Product['manufacturing'] | undefined,
    standardCost: details.standardCost as Product['standardCost'] | undefined,
    quality: details.quality as Product['quality'] | undefined,
    sales: details.sales as Product['sales'] | undefined,
    attachments: (details.attachments as Product['attachments']) ?? [],
    changeLog: (details.changeLog as Product['changeLog']) ?? [],
  })

  return {
    id: row.id,
    productCode: row.code ?? '',
    productName: row.name,
    productType: (row.productType as Product['productType']) ?? 'bulker',
    fgItemId: row.fgItemId ?? '',
    capacity: row.capacity ?? '',
    axleConfig: row.axleConfig ?? '',
    tareWeightKg: num(row.tareWeightKg),
    gvwKg: num(row.gvwKg),
    standardPrice: num(row.standardPrice),
    standardLeadDays: row.standardLeadDays ?? 0,
    baseUomId: row.baseUomId ?? '',
    hsnCode: row.hsnCode ?? '',
    specifications: row.specifications ?? '',
    isActive: row.status === 'ACTIVE',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    productCategory: (details.productCategory as Product['productCategory']) ?? undefined,
    material: String(details.material ?? ''),
    application: String(details.application ?? ''),
    parentProductCode: (details.parentProductCode as string | null | undefined) ?? null,
    isVariant: Boolean(details.isVariant),
    isConfigurableParent: Boolean(details.isConfigurableParent),
    vehicleGvwLabel: String(details.vehicleGvwLabel ?? ''),
    ...defaults,
  }
}
