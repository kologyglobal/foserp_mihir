import { useMasterStore } from '../store/masterStore'
import { useMrpStore } from '../store/mrpStore'
import type { Customer, Product } from '../types/master'
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
  lines: ProformaInvoiceLine[]
  so: SalesOrder
}

export function buildProformaNewUrl(salesOrderId: string): string {
  return `/sales/proforma-invoices/new?salesOrderId=${encodeURIComponent(salesOrderId)}`
}

export function resolveSalesOrderProformaPrefill(salesOrderId: string): ProformaSalesOrderPrefill | null {
  const so = useMrpStore.getState().getSalesOrder(salesOrderId)
  if (!so) return null
  if (['closed', 'cancelled'].includes(so.status)) return null

  const masters = useMasterStore.getState()
  const customer = masters.getCustomer(so.customerId)
  const products = masters.products as Product[]
  const lines = buildProformaLinesFromSalesOrder(so, products)

  return {
    salesOrderId: so.id,
    salesOrderNo: so.salesOrderNo,
    customerId: so.customerId,
    customer,
    paymentTerms: so.paymentTerms ?? '30% advance, balance before dispatch',
    deliveryTerms: so.deliveryTerms ?? 'Ex-works Pune',
    customerPoNumber: so.customerPoNumber ?? null,
    billingAddress: so.billingAddress ?? (customer ? formatCustomerBillingAddress(customer) : null),
    shippingAddress: so.shippingAddress ?? (customer ? resolveCustomerShippingAddress(customer) : null),
    quotationId: so.quotationId ?? null,
    quotationNo: so.quotationNo ?? null,
    locationId: so.locationId ?? null,
    lines,
    so,
  }
}
