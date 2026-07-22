import type { SalesOrder } from '@/types/mrp'
import { apiRequest, tenantPath } from './client'

export type SalesOrderApiDto = SalesOrder

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

export async function fetchSalesOrders(params?: Record<string, string | undefined>) {
  return apiRequest<SalesOrderApiDto[]>(`${tenantPath('/crm/sales-orders')}${buildQuery(params)}`)
}

export async function fetchSalesOrder(id: string) {
  return apiRequest<SalesOrderApiDto>(tenantPath(`/crm/sales-orders/${id}`))
}

export type CreateSalesOrderBody = {
  customerId: string
  source?: 'quotation' | 'direct'
  productId?: string | null
  qty?: number
  unitPrice?: number
  discountPct?: number | null
  customerPoNumber: string
  customerPoDate?: string | null
  paymentTerms: string
  deliveryTerms: string
  warrantyTerms?: string | null
  commercialNotes?: string | null
  technicalNotes?: string | null
  expectedDeliveryDate?: string | null
  requiredDate?: string | null
  orderDate?: string | null
  deliveryLocation?: string | null
  locationId?: string | null
  billingAddress?: string | null
  shippingAddress?: string | null
  opportunityId?: string | null
  contactId?: string | null
  quotationId?: string | null
  quotationNo?: string | null
  quotationRevisionNo?: number | null
  quotationDocumentId?: string | null
  salesOwnerId?: string | null
  salesOwnerName?: string | null
  internalRemarks?: string | null
  remarks?: string | null
  directSoReason?: string | null
  lines?: Array<{
    id?: string
    lineNo?: number
    productOrItem: string
    description?: string
    productId?: string | null
    qty: number
    uom?: string
    unitPrice: number
    discountPct?: number
    taxPct?: number
    technicalScopeRef?: string | null
  }>
}

export type UpdateSalesOrderBody = Partial<
  Pick<
    CreateSalesOrderBody,
    | 'customerPoNumber'
    | 'customerPoDate'
    | 'expectedDeliveryDate'
    | 'requiredDate'
    | 'deliveryLocation'
    | 'locationId'
    | 'internalRemarks'
    | 'remarks'
    | 'paymentTerms'
    | 'deliveryTerms'
    | 'warrantyTerms'
    | 'commercialNotes'
    | 'technicalNotes'
    | 'billingAddress'
    | 'shippingAddress'
    | 'directSoReason'
    | 'qty'
    | 'unitPrice'
    | 'discountPct'
    | 'contactId'
    | 'salesOwnerId'
    | 'salesOwnerName'
    | 'lines'
  >
>

export async function createSalesOrderApi(data: CreateSalesOrderBody) {
  return apiRequest<SalesOrderApiDto>(tenantPath('/crm/sales-orders'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSalesOrderApi(id: string, data: UpdateSalesOrderBody) {
  return apiRequest<SalesOrderApiDto>(tenantPath(`/crm/sales-orders/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteSalesOrderApi(id: string) {
  return apiRequest<null>(tenantPath(`/crm/sales-orders/${id}`), { method: 'DELETE' })
}

export async function confirmSalesOrderApi(id: string) {
  return apiRequest<SalesOrderApiDto>(tenantPath(`/crm/sales-orders/${id}/confirm`), {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function closeSalesOrderApi(id: string) {
  return apiRequest<SalesOrderApiDto>(tenantPath(`/crm/sales-orders/${id}/close`), {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export type SalesOrderCommercialOpsDto = {
  orderedQty: number
  cancelledQty: number
  netOrderedQty: number
  dispatchedQty: number
  remainingQty: number
  orderedAmount: number
  dispatchedAmount: number
}

export type SalesOrderCommercialMoneyDto = {
  orderedAmount: number
  dispatchedAmount: number
  invoicedAmount: number
  collectedAmount: number
  outstandingAmount: number
  nextPaymentDueDate: string | null
  nextPaymentDueAmount: number | null
  postedInvoiceCount: number
  draftInvoiceCount: number
}

export type SalesOrderCommercialPositionDto = {
  salesOrderId: string
  salesOrderNo: string
  companyId: string
  status: string
  currencyCode: string
  ops: SalesOrderCommercialOpsDto
  money: SalesOrderCommercialMoneyDto | null
  moneyVisible: boolean
  fulfilment: import('./dispatchApi').SalesOrderFulfilment
}

export type CompanyCommercialPositionDto = {
  companyId: string
  salesOrderCount: number
  ops: SalesOrderCommercialOpsDto
  money: SalesOrderCommercialMoneyDto | null
  moneyVisible: boolean
}

export async function fetchSalesOrderCommercialPosition(id: string) {
  return apiRequest<SalesOrderCommercialPositionDto>(
    tenantPath(`/crm/sales-orders/${id}/commercial-position`),
  )
}

export async function fetchCompanyCommercialPosition(companyId: string) {
  return apiRequest<CompanyCommercialPositionDto>(
    tenantPath(`/crm/companies/${companyId}/commercial-position`),
  )
}

export type ConvertQuotationToSalesOrderResponse = {
  salesOrderId: string
  salesOrderNo: string
  salesOrder: SalesOrderApiDto
  quotation: import('./quotationApi').QuotationApiDto
}

export async function convertQuotationToSalesOrderApi(
  quotationId: string,
  data?: {
    documentId?: string
    customerPoNumber?: string
    customerPoDate?: string | null
    expectedDeliveryDate?: string | null
    deliveryLocation?: string | null
    locationId?: string | null
    internalRemarks?: string | null
  },
) {
  return apiRequest<ConvertQuotationToSalesOrderResponse>(
    tenantPath(`/crm/quotations/${quotationId}/convert-to-sales-order`),
    { method: 'POST', body: JSON.stringify(data ?? {}) },
  )
}
