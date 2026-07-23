import type { SalesOrder } from '../../types/mrp'
import { ApiError, formatApiError } from '../api/apiErrors'
import * as api from '../api/salesOrderApi'
import { applyQuotationApiResponse } from './quotationApiBridge'
import { useMrpStore } from '../../store/mrpStore'
import { useCrmStore } from '../../store/crmStore'
import type { StoreActionResult } from '../../store/storeAction'
import type { CrmSalesOrderHandoverInput } from '../../utils/crmQuotationSoConversion'

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

function fail(err: unknown): StoreActionResult {
  return { ok: false, error: formatApiError(err) }
}

function toApiDateTime(value: string | null | undefined): string | null | undefined {
  if (value == null || value === '') return value === '' ? null : value
  if (value.includes('T')) return value
  return `${value}T00:00:00.000Z`
}

function asText(value: string | null | undefined, fallback = ''): string {
  return value ?? fallback
}

/**
 * Normalize API SO rows for store/UI.
 * Backend DTO allows null for requiredDate/productId/linkage FKs; store types expect strings
 * for requiredDate/productId — coerce null→'' so `.slice` never runs on null after hydrate.
 * Linkage FKs (quotationId/opportunityId) stay null when cleared by cleanup.
 */
export function salesOrderFromApi(dto: api.SalesOrderApiDto): SalesOrder {
  const raw = dto as api.SalesOrderApiDto & {
    requiredDate?: string | null
    productId?: string | null
    remarks?: string | null
  }
  return {
    ...dto,
    salesOrderNo: asText(raw.salesOrderNo),
    customerId: asText(raw.customerId),
    productId: asText(raw.productId),
    requiredDate: asText(raw.requiredDate),
    remarks: asText(raw.remarks),
    createdAt: asText(raw.createdAt, new Date().toISOString()),
    modifiedAt: (raw as { modifiedAt?: string | null }).modifiedAt ?? null,
    quotationId: raw.quotationId ?? null,
    quotationNo: raw.quotationNo ?? null,
    opportunityId: raw.opportunityId ?? null,
    quotationDocumentId: raw.quotationDocumentId ?? null,
    customerPoNumber: raw.customerPoNumber ?? null,
    lines: raw.lines ?? [],
  }
}

export function applySalesOrderApiResponse(dto: api.SalesOrderApiDto): void {
  const so = salesOrderFromApi(dto)
  useMrpStore.setState((s) => ({
    salesOrders: [so, ...s.salesOrders.filter((o) => o.id !== so.id)],
  }))
}

export async function syncSalesOrdersFromApi(): Promise<SalesOrder[]> {
  const { fetchAllCrmPages } = await import('../api/crmApi')
  const orders = await fetchAllCrmPages<api.SalesOrderApiDto>('/crm/sales-orders')
  const mapped = orders.map(salesOrderFromApi)
  useMrpStore.setState({ salesOrders: mapped })
  return mapped
}

export async function apiConvertQuotationToSalesOrder(
  quotationId: string,
  documentId: string,
  handover?: CrmSalesOrderHandoverInput,
): Promise<
  StoreActionResult & {
    salesOrderId?: string
    salesOrderNo?: string
    alreadyConverted?: boolean
  }
> {
  return withSubmitLock(lockKey('quotation:convert-so', quotationId), async () => {
    try {
      const res = await api.convertQuotationToSalesOrderApi(quotationId, {
        documentId,
        customerPoNumber: handover?.customerPoNumber,
        customerPoDate: toApiDateTime(handover?.customerPoDate),
        expectedDeliveryDate: toApiDateTime(handover?.expectedDeliveryDate),
        deliveryLocation: handover?.deliveryLocation,
        locationId: handover?.locationId,
        internalRemarks: handover?.internalRemarks,
      })
      applyQuotationApiResponse(res.data.quotation)
      applySalesOrderApiResponse(res.data.salesOrder)

      const oppId = res.data.quotation.opportunityId
      if (oppId) {
        useCrmStore.setState((s) => ({
          opportunities: s.opportunities.map((o) =>
            o.id === oppId
              ? {
                  ...o,
                  salesOrderId: res.data.salesOrderId,
                  value: res.data.salesOrder.grandTotal ?? o.value,
                  stage: 'won' as const,
                  status: 'won' as const,
                  probability: 100,
                  modifiedAt: new Date().toISOString(),
                }
              : o,
          ),
        }))
      }

      return {
        ok: true,
        salesOrderId: res.data.salesOrderId,
        salesOrderNo: res.data.salesOrderNo,
      }
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        const soId = err.fieldErrors?.find((e) => e.field === 'salesOrderId')?.message
        const soNo = err.fieldErrors?.find((e) => e.field === 'salesOrderNo')?.message
        return {
          ok: false,
          error: err.message,
          alreadyConverted: true,
          salesOrderId: soId || undefined,
          salesOrderNo: soNo || undefined,
        }
      }
      return fail(err)
    }
  })
}

function optionalUuid(value: string | null | undefined): string | null | undefined {
  if (value == null || value === '') return null
  return value
}

export async function apiCreateSalesOrder(
  input: api.CreateSalesOrderBody,
): Promise<StoreActionResult & { salesOrderId?: string; salesOrderNo?: string }> {
  return withSubmitLock(lockKey('sales-order:create'), async () => {
    try {
      const res = await api.createSalesOrderApi({
        ...input,
        locationId: optionalUuid(input.locationId),
        customerPoDate: toApiDateTime(input.customerPoDate),
        expectedDeliveryDate: toApiDateTime(input.expectedDeliveryDate),
        requiredDate: toApiDateTime(input.requiredDate),
        orderDate: toApiDateTime(input.orderDate),
      })
      applySalesOrderApiResponse(res.data)
      return { ok: true, salesOrderId: res.data.id, salesOrderNo: res.data.salesOrderNo }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateSalesOrder(
  id: string,
  patch: api.UpdateSalesOrderBody,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('sales-order:update', id), async () => {
    try {
      const res = await api.updateSalesOrderApi(id, {
        ...patch,
        locationId: patch.locationId !== undefined ? optionalUuid(patch.locationId) : undefined,
        customerPoDate: patch.customerPoDate !== undefined ? toApiDateTime(patch.customerPoDate) : undefined,
        expectedDeliveryDate:
          patch.expectedDeliveryDate !== undefined ? toApiDateTime(patch.expectedDeliveryDate) : undefined,
        requiredDate: patch.requiredDate !== undefined ? toApiDateTime(patch.requiredDate) : undefined,
      })
      applySalesOrderApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteSalesOrder(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('sales-order:delete', id), async () => {
    try {
      await api.deleteSalesOrderApi(id)
      useMrpStore.setState((s) => ({
        salesOrders: s.salesOrders.filter((o) => o.id !== id),
      }))
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiConfirmSalesOrder(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('sales-order:confirm', id), async () => {
    try {
      const res = await api.confirmSalesOrderApi(id)
      applySalesOrderApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCloseSalesOrder(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('sales-order:close', id), async () => {
    try {
      const res = await api.closeSalesOrderApi(id)
      applySalesOrderApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}
