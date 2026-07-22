/**
 * Accounting master lookups (Wave 1 backend → Wave 6 frontend wiring).
 *
 * Tenant-scoped, paginated, searchable lookups over the real masters:
 * customers (CrmCompany), vendors (MasterVendor), items, and invoice-eligible
 * source documents (Sales Orders, Purchase Orders, GRNs) plus per-document
 * eligibility checks.
 *
 * Endpoints: `/api/v1/t/:tenantSlug/accounting/lookups/…`
 */
import { apiRequest, tenantPath } from './client'

const BASE = '/accounting/lookups'

function buildQuery(params?: object): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params as Record<string, string | number | boolean | undefined | null>)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

// ─── Types (mirror backend master-resolver lookup shapes) ────────────────────

export interface AccountingCustomerLookup {
  id: string
  code: string | null
  name: string
  gstin: string | null
  pan: string | null
  stateCode: string | null
  city: string | null
  email: string | null
  phone: string | null
  contactPerson: string | null
  creditDays: number | null
  isActive: boolean
}

export interface AccountingVendorLookup {
  id: string
  code: string
  name: string
  gstin: string | null
  pan: string | null
  stateCode: string | null
  city: string | null
  paymentTermsDays: number
  isActive: boolean
  isBlocked: boolean
}

export interface AccountingItemLookup {
  id: string
  code: string
  name: string
  itemType: string
  productType: string | null
  baseUomId: string | null
  categoryId: string | null
  hsnCode: string | null
  hsnId: string | null
  gstGroupId: string | null
  standardRate: string | null
  status: string
  isActive: boolean
}

export interface AccountingSalesOrderLookup {
  id: string
  orderNumber: string
  customerId: string
  status: string
  orderDate: string | null
  customerPoNumber: string | null
  qty: number
}

export interface AccountingPurchaseOrderLookup {
  id: string
  orderNumber: string
  vendorId: string
  status: string
  orderDate: string
  currencyCode: string
  totalAmount: string
}

export interface AccountingGrnLookup {
  id: string
  grnNumber: string
  vendorId: string
  purchaseOrderId: string
  purchaseOrderNumber: string
  status: string
  receiptDate: string
}

export interface SourceEligibilityResult {
  eligible: boolean
  documentId: string
  documentNumber: string
  documentDate: string | null
  status: string
  partyId: string
  errors: Array<{ code: string; message: string }>
  warnings: Array<{ code: string; message: string }>
  snapshot: Record<string, unknown>
}

export interface AccountingLookupListQuery {
  search?: string
  page?: number
  limit?: number
  activeOnly?: boolean
}

// ─── Parties & items ─────────────────────────────────────────────────────────

export async function listCustomerLookups(params?: AccountingLookupListQuery) {
  return apiRequest<AccountingCustomerLookup[]>(`${tenantPath(`${BASE}/customers`)}${buildQuery(params)}`)
}

export async function getCustomerLookup(id: string) {
  return apiRequest<AccountingCustomerLookup>(tenantPath(`${BASE}/customers/${id}`))
}

export async function listVendorLookups(params?: AccountingLookupListQuery) {
  return apiRequest<AccountingVendorLookup[]>(`${tenantPath(`${BASE}/vendors`)}${buildQuery(params)}`)
}

export async function getVendorLookup(id: string) {
  return apiRequest<AccountingVendorLookup>(tenantPath(`${BASE}/vendors/${id}`))
}

export async function listItemLookups(params?: AccountingLookupListQuery & { itemType?: string }) {
  return apiRequest<AccountingItemLookup[]>(`${tenantPath(`${BASE}/items`)}${buildQuery(params)}`)
}

// ─── Source documents ────────────────────────────────────────────────────────

export async function listSalesOrderLookups(
  params?: Omit<AccountingLookupListQuery, 'activeOnly'> & { customerId?: string; eligibleOnly?: boolean },
) {
  return apiRequest<AccountingSalesOrderLookup[]>(`${tenantPath(`${BASE}/sales-orders`)}${buildQuery(params)}`)
}

export async function getSalesOrderInvoiceEligibility(id: string, customerId?: string) {
  return apiRequest<SourceEligibilityResult>(
    `${tenantPath(`${BASE}/sales-orders/${id}/invoice-eligibility`)}${buildQuery({ customerId })}`,
  )
}

export async function listPurchaseOrderLookups(
  params?: Omit<AccountingLookupListQuery, 'activeOnly'> & { vendorId?: string; eligibleOnly?: boolean },
) {
  return apiRequest<AccountingPurchaseOrderLookup[]>(`${tenantPath(`${BASE}/purchase-orders`)}${buildQuery(params)}`)
}

export async function getPurchaseOrderInvoiceEligibility(id: string, vendorId?: string) {
  return apiRequest<SourceEligibilityResult>(
    `${tenantPath(`${BASE}/purchase-orders/${id}/invoice-eligibility`)}${buildQuery({ vendorId })}`,
  )
}

export async function listGrnLookups(
  params?: Omit<AccountingLookupListQuery, 'activeOnly'> & {
    vendorId?: string
    purchaseOrderId?: string
    eligibleOnly?: boolean
  },
) {
  return apiRequest<AccountingGrnLookup[]>(`${tenantPath(`${BASE}/grns`)}${buildQuery(params)}`)
}

export async function getGrnInvoiceEligibility(id: string, vendorId?: string) {
  return apiRequest<SourceEligibilityResult>(
    `${tenantPath(`${BASE}/grns/${id}/invoice-eligibility`)}${buildQuery({ vendorId })}`,
  )
}

export interface AccountingDispatchLookup {
  id: string
  dispatchNo: string
  customerId: string | null
  customerName: string | null
  salesOrderId: string | null
  salesOrderNo: string | null
  status: string
  confirmedAt: string | null
}

export async function listDispatchLookups(
  params?: Omit<AccountingLookupListQuery, 'activeOnly'> & { customerId?: string; eligibleOnly?: boolean },
) {
  return apiRequest<AccountingDispatchLookup[]>(`${tenantPath(`${BASE}/dispatches`)}${buildQuery(params)}`)
}

export async function getDispatchInvoiceEligibility(id: string, customerId?: string) {
  return apiRequest<SourceEligibilityResult>(
    `${tenantPath(`${BASE}/dispatches/${id}/invoice-eligibility`)}${buildQuery({ customerId })}`,
  )
}
