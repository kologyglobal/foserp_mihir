import type { Item, ItemCategory, Vendor } from '../../types/master'
import type { GstGroupCode, GstRate, HsnMaster } from '../../types/taxMaster'
import { API_CONFIG } from '../../config/apiConfig'
import { apiRequest, getStoredSession, tenantPath } from './client'
import {
  activateMasterApi,
  createMasterApi,
  deactivateMasterApi,
  deleteMasterApi,
  type MasterRecordDto,
  updateMasterApi,
} from './masterApi'

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

async function fetchAllMasterPages(resource: string): Promise<MasterRecordDto[]> {
  const limit = 100
  let page = 1
  const all: MasterRecordDto[] = []
  for (;;) {
    const res = await apiRequest<MasterRecordDto[]>(
      `${tenantPath(`/masters/${resource}`)}${buildQuery({ page, limit })}`,
    )
    all.push(...res.data)
    const meta = res.meta
    if (!meta || page >= meta.totalPages) break
    page += 1
  }
  return all
}

async function fetchAllDedicatedPages<T>(path: string): Promise<T[]> {
  const limit = 100
  let page = 1
  const all: T[] = []
  for (;;) {
    const res = await apiRequest<T[]>(`${tenantPath(path)}${buildQuery({ page, limit })}`)
    all.push(...res.data)
    const meta = res.meta
    if (!meta || page >= meta.totalPages) break
    page += 1
  }
  return all
}

export interface ItemDto {
  id: string
  code: string
  name: string
  itemName2?: string | null
  itemDescription: string
  categoryId: string
  baseUomId: string
  itemType: string
  productType?: string | null
  inventoryType?: string | null
  codeSeriesMode?: string | null
  materialGrade: string
  hsnCode: string
  hsnId?: string | null
  gstGroupId?: string | null
  reorderLevel: number | string
  reorderQty: number | string
  standardRate: number | string
  defaultSalesRate?: number | string
  salesDescription?: string | null
  salesUomId?: string | null
  salesLeadDays?: number
  salesAllowed?: boolean
  defaultFulfilmentMethod?: string
  productionAllowed?: boolean
  isPurchasable: boolean
  isStockable: boolean
  isBlocked: boolean
  quantityPerUom: number | string
  purchaseUomId?: string | null
  purchaseQtyPerUom: number | string
  qcRequired: boolean
  qualityTestGroupCode?: string | null
  productionBomId?: string | null
  routingNo?: string | null
  drawingNo?: string | null
  subAssemblyRule?: string | null
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export interface VendorDto {
  id: string
  code: string
  name: string
  searchName?: string | null
  isBlocked: boolean
  address?: string | null
  address2?: string | null
  city: string
  state: string
  pincode?: string | null
  country?: string | null
  countryId?: string | null
  stateId?: string | null
  cityId?: string | null
  email?: string | null
  gstin: string
  gstVendorType?: string | null
  pan?: string | null
  panStatus?: string | null
  paymentMethod?: string | null
  bankDetails?: string | null
  vendorType: string
  contactPerson: string
  contactPhone: string
  paymentTermsDays: number
  defaultLeadTimeDays: number
  suppliedCategories: string[] | unknown
  rating: number | string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
}

export interface ItemLookupRow {
  id: string
  code: string
  name: string
  itemType: string
  productType?: string | null
  baseUomId: string
  categoryId: string
  hsnCode: string
  hsnId?: string | null
  gstGroupId?: string | null
  standardRate?: number | string
  defaultSalesRate?: number | string
  salesAllowed?: boolean
  defaultFulfilmentMethod?: string
  salesUomId?: string | null
  salesLeadDays?: number
  status: 'ACTIVE' | 'INACTIVE'
}

export interface VendorLookupRow {
  id: string
  code: string
  name: string
  searchName?: string | null
  vendorType: string
  gstin: string
  city: string
  state: string
  country?: string | null
  countryId?: string | null
  stateId?: string | null
  cityId?: string | null
  status: 'ACTIVE' | 'INACTIVE'
}

function toStatus(isActive: boolean | undefined): 'ACTIVE' | 'INACTIVE' {
  return isActive === false ? 'INACTIVE' : 'ACTIVE'
}

function num(v: number | string | undefined | null): number {
  if (v === undefined || v === null) return 0
  return typeof v === 'number' ? v : Number(v)
}

function dateOnly(v: string | Date | null | undefined): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

export function mapCategoryDto(row: MasterRecordDto): ItemCategory {
  return {
    id: row.id,
    categoryCode: row.code ?? '',
    categoryName: row.name,
    parentId: row.parentId ?? null,
    level: row.level ?? 1,
    defaultWarehouseId: row.defaultWarehouseId ?? null,
    stockPolicy: (row.stockPolicy as ItemCategory['stockPolicy']) ?? 'REQUIRED',
    defaultIsStockable: row.defaultIsStockable ?? true,
    defaultInventoryType: (row.defaultInventoryType as ItemCategory['defaultInventoryType']) ?? 'inventory',
    isActive: row.status === 'ACTIVE',
    createdAt: row.createdAt,
  }
}

export function mapHsnDto(row: MasterRecordDto): HsnMaster {
  return {
    id: row.id,
    code: row.code ?? '',
    gstGroupId: row.gstGroupId ?? '',
    description: row.description ?? row.name,
    isActive: row.status === 'ACTIVE',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapGstGroupDto(row: MasterRecordDto): GstGroupCode {
  return {
    id: row.id,
    code: row.code ?? '',
    goodsType: (row.goodsType ?? 'goods') as GstGroupCode['goodsType'],
    description: row.description ?? row.name,
    isActive: row.status === 'ACTIVE',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapGstRateDto(row: MasterRecordDto): GstRate {
  return {
    id: row.id,
    code: row.code ?? '',
    gstGroupId: row.gstGroupId ?? '',
    fromState: row.fromState ?? '',
    locationStateCode: row.locationStateCode ?? '',
    dateFrom: dateOnly(row.dateFrom) ?? '',
    dateTo: dateOnly(row.dateTo),
    sgst: num(row.sgst),
    cgst: num(row.cgst),
    igst: num(row.igst),
    applicableFor: (row.applicableFor as GstRate['applicableFor']) || 'BOTH',
    isActive: row.status === 'ACTIVE',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapItemDto(row: ItemDto): Item {
  return {
    id: row.id,
    itemCode: row.code,
    itemName: row.name,
    itemName2: row.itemName2 ?? undefined,
    itemDescription: row.itemDescription,
    categoryId: row.categoryId,
    baseUomId: row.baseUomId,
    itemType: row.itemType as Item['itemType'],
    productType: (row.productType ?? undefined) as Item['productType'],
    inventoryType: (row.inventoryType ?? undefined) as Item['inventoryType'],
    codeSeriesMode: (row.codeSeriesMode ?? undefined) as Item['codeSeriesMode'],
    materialGrade: row.materialGrade,
    hsnCode: row.hsnCode,
    hsnId: row.hsnId ?? null,
    gstGroupId: row.gstGroupId ?? null,
    reorderLevel: num(row.reorderLevel),
    reorderQty: num(row.reorderQty),
    standardRate: num(row.standardRate),
    defaultSalesRate: num(row.defaultSalesRate ?? 0),
    salesDescription: row.salesDescription ?? null,
    salesUomId: row.salesUomId ?? null,
    salesLeadDays: row.salesLeadDays ?? 0,
    salesAllowed: row.salesAllowed ?? false,
    defaultFulfilmentMethod: (row.defaultFulfilmentMethod ?? 'MANUAL') as Item['defaultFulfilmentMethod'],
    productionAllowed: row.productionAllowed ?? false,
    isPurchasable: row.isPurchasable,
    isStockable: row.isStockable,
    isBlocked: row.isBlocked,
    isActive: row.status === 'ACTIVE',
    quantityPerUom: num(row.quantityPerUom),
    purchaseUomId: row.purchaseUomId ?? null,
    purchaseQtyPerUom: num(row.purchaseQtyPerUom),
    qcRequired: row.qcRequired,
    qualityTestGroupCode: row.qualityTestGroupCode ?? null,
    productionBomId: row.productionBomId ?? null,
    routingNo: row.routingNo ?? null,
    drawingNo: row.drawingNo ?? null,
    subAssemblyRule: (row.subAssemblyRule ?? null) as Item['subAssemblyRule'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapVendorDto(row: VendorDto): Vendor {
  const supplied = Array.isArray(row.suppliedCategories) ? row.suppliedCategories as string[] : []
  return {
    id: row.id,
    vendorCode: row.code,
    vendorName: row.name,
    searchName: row.searchName ?? undefined,
    isBlocked: row.isBlocked,
    address: row.address ?? undefined,
    address2: row.address2 ?? undefined,
    city: row.city,
    state: row.state,
    pincode: row.pincode ?? undefined,
    country: row.country ?? undefined,
    countryId: row.countryId ?? undefined,
    stateId: row.stateId ?? undefined,
    cityId: row.cityId ?? undefined,
    email: row.email ?? undefined,
    gstin: row.gstin,
    gstVendorType: (row.gstVendorType ?? undefined) as Vendor['gstVendorType'],
    pan: row.pan ?? undefined,
    panStatus: (row.panStatus ?? undefined) as Vendor['panStatus'],
    paymentMethod: row.paymentMethod ?? undefined,
    bankDetails: row.bankDetails ?? undefined,
    vendorType: row.vendorType as Vendor['vendorType'],
    contactPerson: row.contactPerson,
    contactPhone: row.contactPhone,
    paymentTermsDays: row.paymentTermsDays,
    defaultLeadTimeDays: row.defaultLeadTimeDays,
    suppliedCategories: supplied,
    rating: num(row.rating),
    isActive: row.status === 'ACTIVE',
    createdAt: row.createdAt,
  }
}

export function categoryToApiPayload(
  data: Pick<
    ItemCategory,
    | 'categoryCode'
    | 'categoryName'
    | 'parentId'
    | 'level'
    | 'defaultWarehouseId'
    | 'stockPolicy'
    | 'defaultIsStockable'
    | 'defaultInventoryType'
    | 'isActive'
  >,
) {
  return {
    code: data.categoryCode.trim(),
    name: data.categoryName.trim(),
    parentId: data.parentId || null,
    level: data.level,
    defaultWarehouseId: data.defaultWarehouseId || null,
    stockPolicy: data.stockPolicy ?? 'REQUIRED',
    defaultIsStockable: data.defaultIsStockable ?? true,
    defaultInventoryType: data.defaultInventoryType ?? 'inventory',
    status: toStatus(data.isActive),
  }
}

export function hsnToApiPayload(data: Pick<HsnMaster, 'code' | 'gstGroupId' | 'description' | 'isActive'>) {
  return {
    code: data.code.trim(),
    gstGroupId: data.gstGroupId,
    description: data.description.trim(),
    status: toStatus(data.isActive),
  }
}

export function gstGroupToApiPayload(data: Pick<GstGroupCode, 'code' | 'goodsType' | 'description' | 'isActive'>) {
  return {
    code: data.code.trim(),
    goodsType: data.goodsType,
    description: data.description.trim(),
    status: toStatus(data.isActive),
  }
}

export function gstRateToApiPayload(
  data: Pick<
    GstRate,
    | 'code'
    | 'gstGroupId'
    | 'fromState'
    | 'locationStateCode'
    | 'dateFrom'
    | 'dateTo'
    | 'sgst'
    | 'cgst'
    | 'igst'
    | 'applicableFor'
    | 'isActive'
  >,
) {
  return {
    code: data.code.trim(),
    gstGroupId: data.gstGroupId,
    fromState: data.fromState.trim(),
    locationStateCode: data.locationStateCode.trim(),
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    sgst: data.sgst,
    cgst: data.cgst,
    igst: data.igst,
    applicableFor: data.applicableFor ?? 'BOTH',
    status: toStatus(data.isActive),
  }
}

export function itemToApiPayload(data: Item): Record<string, unknown> {
  return {
    code: data.itemCode.trim(),
    name: data.itemName.trim(),
    itemName2: data.itemName2?.trim() || undefined,
    itemDescription: data.itemDescription?.trim() ?? '',
    categoryId: data.categoryId,
    baseUomId: data.baseUomId,
    itemType: data.itemType,
    productType: data.productType,
    inventoryType: data.inventoryType,
    codeSeriesMode: data.codeSeriesMode,
    materialGrade: data.materialGrade?.trim() ?? '',
    hsnCode: data.hsnCode?.trim() ?? '',
    hsnId: data.hsnId || null,
    gstGroupId: data.gstGroupId || null,
    reorderLevel: data.reorderLevel,
    reorderQty: data.reorderQty,
    standardRate: data.standardRate,
    defaultSalesRate: data.defaultSalesRate ?? 0,
    salesDescription: data.salesDescription?.trim() || null,
    salesUomId: data.salesUomId || null,
    salesLeadDays: data.salesLeadDays ?? 0,
    salesAllowed: data.salesAllowed ?? false,
    defaultFulfilmentMethod: data.defaultFulfilmentMethod ?? 'MANUAL',
    productionAllowed: data.productionAllowed ?? false,
    isPurchasable: data.isPurchasable,
    isStockable: data.isStockable,
    isBlocked: data.isBlocked ?? false,
    quantityPerUom: data.quantityPerUom ?? 1,
    purchaseUomId: data.purchaseUomId || null,
    purchaseQtyPerUom: data.purchaseQtyPerUom ?? 1,
    qcRequired: data.qcRequired ?? false,
    qualityTestGroupCode: data.qualityTestGroupCode || null,
    productionBomId: data.productionBomId || null,
    routingNo: data.routingNo || null,
    drawingNo: data.drawingNo || null,
    subAssemblyRule: data.subAssemblyRule,
    status: toStatus(data.isActive),
  }
}

export function vendorToApiPayload(data: Vendor): Record<string, unknown> {
  return {
    code: data.vendorCode.trim(),
    name: data.vendorName.trim(),
    searchName: data.searchName?.trim() || undefined,
    isBlocked: data.isBlocked ?? false,
    address: data.address?.trim() || undefined,
    address2: data.address2?.trim() || undefined,
    city: data.city?.trim() ?? '',
    state: data.state?.trim() ?? '',
    pincode: data.pincode?.trim() || undefined,
    country: data.country?.trim() || undefined,
    countryId: data.countryId || null,
    stateId: data.stateId || null,
    cityId: data.cityId || null,
    email: data.email?.trim() || undefined,
    gstin: data.gstin?.trim().toUpperCase() ?? '',
    gstVendorType: data.gstVendorType,
    pan: data.pan?.trim().toUpperCase() || undefined,
    panStatus: data.panStatus,
    paymentMethod: data.paymentMethod || undefined,
    bankDetails: data.bankDetails?.trim() || undefined,
    vendorType: data.vendorType,
    contactPerson: data.contactPerson?.trim() ?? '',
    contactPhone: data.contactPhone?.trim() ?? '',
    paymentTermsDays: data.paymentTermsDays,
    defaultLeadTimeDays: data.defaultLeadTimeDays,
    suppliedCategories: data.suppliedCategories ?? [],
    rating: data.rating,
    status: toStatus(data.isActive),
  }
}

export async function fetchItemCategories() {
  return fetchAllMasterPages('item-categories')
}

export async function fetchHsnCodes() {
  return fetchAllMasterPages('hsn-sac')
}

export async function fetchGstGroups() {
  return fetchAllMasterPages('gst-groups')
}

export async function fetchGstRates() {
  return fetchAllMasterPages('gst-rates')
}

export async function fetchItems() {
  return fetchAllDedicatedPages<ItemDto>('/masters/items')
}

export async function fetchVendors() {
  return fetchAllDedicatedPages<VendorDto>('/masters/vendors')
}

export async function searchItemLookups(params: {
  search?: string
  itemType?: string
  itemTypes?: string[]
  salesAllowed?: boolean
  activeOnly?: boolean
  page?: number
  limit?: number
  /** When true, pages through the API until every matching item is returned (page size 100). */
  fetchAll?: boolean
}) {
  const activeOnly = params.activeOnly ?? true
  const itemTypesCsv =
    params.itemTypes && params.itemTypes.length > 0 ? params.itemTypes.join(',') : undefined
  if (!params.fetchAll) {
    return apiRequest<ItemLookupRow[]>(
      `${tenantPath('/lookups/items')}${buildQuery({
        search: params.search,
        itemType: itemTypesCsv ? undefined : params.itemType,
        itemTypes: itemTypesCsv,
        salesAllowed: params.salesAllowed,
        activeOnly,
        page: params.page ?? 1,
        limit: params.limit ?? 25,
      })}`,
    )
  }

  const pageSize = Math.min(params.limit ?? 100, 100)
  let page = 1
  const all: ItemLookupRow[] = []
  let total = 0
  for (;;) {
    const res = await apiRequest<ItemLookupRow[]>(
      `${tenantPath('/lookups/items')}${buildQuery({
        search: params.search,
        itemType: itemTypesCsv ? undefined : params.itemType,
        itemTypes: itemTypesCsv,
        salesAllowed: params.salesAllowed,
        activeOnly,
        page,
        limit: pageSize,
      })}`,
    )
    all.push(...res.data)
    total = res.meta?.total ?? all.length
    if (!res.meta || page >= res.meta.totalPages) break
    page += 1
  }
  return {
    data: all,
    meta: {
      page: 1,
      limit: all.length,
      total,
      totalPages: 1,
    },
  }
}

export async function searchVendorLookups(params: {
  search?: string
  activeOnly?: boolean
  page?: number
  limit?: number
}) {
  return apiRequest<VendorLookupRow[]>(
    `${tenantPath('/lookups/vendors')}${buildQuery({
      search: params.search,
      activeOnly: params.activeOnly ?? true,
      page: params.page ?? 1,
      limit: params.limit ?? 25,
    })}`,
  )
}

async function downloadAuthenticatedCsv(path: string, filename: string): Promise<void> {
  const session = getStoredSession()
  const res = await fetch(`${API_CONFIG.baseUrl}${path}`, {
    headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {},
  })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadMasterImportTemplate(resource: 'items' | 'vendors' | 'hsn-sac') {
  const names = { items: 'item-import-template.csv', vendors: 'vendor-import-template.csv', 'hsn-sac': 'hsn-sac-import-template.csv' }
  await downloadAuthenticatedCsv(tenantPath(`/masters/imports/${resource}/template`), names[resource])
}

export async function downloadMasterExport(
  resource: 'items' | 'vendors' | 'hsn-sac',
  params?: Record<string, string | undefined>,
) {
  const names = { items: 'items-export.csv', vendors: 'vendors-export.csv', 'hsn-sac': 'hsn-sac-export.csv' }
  await downloadAuthenticatedCsv(`${tenantPath(`/masters/exports/${resource}`)}${buildQuery(params)}`, names[resource])
}

export async function importMasterCsv(resource: 'items' | 'vendors' | 'hsn-sac', body: { rows: Record<string, string>[]; duplicateMode?: 'reject' | 'skip' | 'update' }) {
  return apiRequest<{ imported: number; updated: number; skipped: number; failed: number; rows: unknown[] }>(
    tenantPath(`/masters/imports/${resource}`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}


export async function createItemApi(body: Record<string, unknown>) {
  return apiRequest<ItemDto>(tenantPath('/masters/items'), { method: 'POST', body: JSON.stringify(body) })
}

export async function updateItemApi(id: string, body: Record<string, unknown>) {
  return apiRequest<ItemDto>(tenantPath(`/masters/items/${id}`), { method: 'PATCH', body: JSON.stringify(body) })
}

export async function deleteItemApi(id: string) {
  return apiRequest<null>(tenantPath(`/masters/items/${id}`), { method: 'DELETE' })
}

export async function activateItemApi(id: string) {
  return apiRequest<ItemDto>(tenantPath(`/masters/items/${id}/activate`), { method: 'POST' })
}

export async function deactivateItemApi(id: string) {
  return apiRequest<ItemDto>(tenantPath(`/masters/items/${id}/deactivate`), { method: 'POST' })
}

export async function createVendorApi(body: Record<string, unknown>) {
  return apiRequest<VendorDto>(tenantPath('/masters/vendors'), { method: 'POST', body: JSON.stringify(body) })
}

export async function updateVendorApi(id: string, body: Record<string, unknown>) {
  return apiRequest<VendorDto>(tenantPath(`/masters/vendors/${id}`), { method: 'PATCH', body: JSON.stringify(body) })
}

export async function deleteVendorApi(id: string) {
  return apiRequest<null>(tenantPath(`/masters/vendors/${id}`), { method: 'DELETE' })
}

export async function activateVendorApi(id: string) {
  return apiRequest<VendorDto>(tenantPath(`/masters/vendors/${id}/activate`), { method: 'POST' })
}

export async function deactivateVendorApi(id: string) {
  return apiRequest<VendorDto>(tenantPath(`/masters/vendors/${id}/deactivate`), { method: 'POST' })
}

export {
  createMasterApi,
  updateMasterApi,
  deleteMasterApi,
  activateMasterApi,
  deactivateMasterApi,
}
