import { isApiMode } from '../config/apiConfig'
import { useMasterStore } from '../store/masterStore'
import { useMrpStore } from '../store/mrpStore'
import type { Customer, Item } from '../types/master'
import type { SalesOrder } from '../types/mrp'
import type { ProformaInvoiceLine } from '../types/proformaInvoice'
import { buildProformaLinesFromSalesOrder } from './proformaInvoiceLines'
import { formatCustomerBillingAddress, resolveCustomerShippingAddress } from './customerUtils'

export interface ProformaSalesOrderPrefill {
  salesOrderId: string
  salesOrderNo: string
  customerId: string
  customer: Customer | undefined
  paymentTerms: string
  deliveryTerms: string
  customerPoNumber: string | null
  billingAddress: string | null
  shippingAddress: string | null
  quotationId: string | null
  quotationNo: string | null
  locationId: string | null
  remarks: string
  placeOfSupply: string | null
  placeOfSupplyStateCode: string | null
  supplierStateCode: string | null
  supplyType: string | null
  gstScheme: string | null
  lines: ProformaInvoiceLine[]
  so: SalesOrder
}

export type ProformaSalesOrderPrefillResult =
  | { ok: true; data: ProformaSalesOrderPrefill }
  | { ok: false; error: string }

export function buildProformaNewUrl(salesOrderId: string): string {
  return `/sales/proforma-invoices/new?salesOrderId=${encodeURIComponent(salesOrderId)}`
}

function mapSalesOrderToPrefill(so: SalesOrder): ProformaSalesOrderPrefill | null {
  if (['closed', 'cancelled'].includes(so.status)) return null

  const masters = useMasterStore.getState()
  const customer = masters.getCustomer(so.customerId)
  const items = masters.items as Item[]
  const lines = buildProformaLinesFromSalesOrder(so, items)
  const remarks = (so.internalRemarks ?? so.remarks ?? '').trim()

  return {
    salesOrderId: so.id,
    salesOrderNo: so.salesOrderNo,
    customerId: so.customerId,
    customer,
    paymentTerms: so.paymentTerms ?? '',
    deliveryTerms: so.deliveryTerms ?? '',
    customerPoNumber: so.customerPoNumber ?? null,
    billingAddress: so.billingAddress ?? (customer ? formatCustomerBillingAddress(customer) : null),
    shippingAddress: so.shippingAddress ?? (customer ? resolveCustomerShippingAddress(customer) : null),
    quotationId: so.quotationId ?? null,
    quotationNo: so.quotationNo ?? null,
    locationId: so.locationId ?? null,
    remarks,
    placeOfSupply: so.placeOfSupply ?? so.placeOfSupplyStateCode ?? null,
    placeOfSupplyStateCode: so.placeOfSupplyStateCode ?? null,
    supplierStateCode: so.supplierStateCode ?? null,
    supplyType: so.supplyType ?? null,
    gstScheme: so.gstScheme ?? null,
    lines,
    so,
  }
}

export function resolveSalesOrderProformaPrefill(salesOrderId: string): ProformaSalesOrderPrefill | null {
  const so = useMrpStore.getState().getSalesOrder(salesOrderId)
  if (!so) return null
  return mapSalesOrderToPrefill(so)
}

/**
 * Sync mapping with explicit errors (demo store or already-hydrated SO).
 * Prefer {@link ensureSalesOrderProformaPrefill} on create forms so API mode can GET by id.
 */
export function resolveSalesOrderProformaPrefillResult(
  salesOrderId: string,
): ProformaSalesOrderPrefillResult {
  if (!salesOrderId.trim()) return { ok: false, error: 'Select a sales order.' }
  const so = useMrpStore.getState().getSalesOrder(salesOrderId)
  if (!so) return { ok: false, error: 'Sales order not found.' }
  if (['closed', 'cancelled'].includes(so.status)) {
    return { ok: false, error: 'Cannot create proforma for a closed or cancelled sales order.' }
  }
  const data = mapSalesOrderToPrefill(so)
  if (!data) return { ok: false, error: 'Could not map this sales order to a proforma.' }
  if (!data.lines.length) {
    return { ok: false, error: 'Sales order has no invoiceable lines.' }
  }
  return { ok: true, data }
}

/**
 * Ensure SO is available (store or API get-by-id), then map for proforma create.
 * Always re-fetches in API mode so deep links get full line detail.
 */
export async function ensureSalesOrderProformaPrefill(
  salesOrderId: string,
): Promise<ProformaSalesOrderPrefillResult> {
  if (!salesOrderId.trim()) return { ok: false, error: 'Select a sales order.' }

  if (isApiMode()) {
    const { apiFetchSalesOrder } = await import('../services/bridges/salesOrderApiBridge')
    const res = await apiFetchSalesOrder(salesOrderId)
    if (!res.ok) return { ok: false, error: res.error ?? 'Failed to load sales order.' }
  }

  return resolveSalesOrderProformaPrefillResult(salesOrderId)
}
