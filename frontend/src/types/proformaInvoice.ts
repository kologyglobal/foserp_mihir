import type { GstBreakdown } from './invoice'

export type ProformaInvoiceStatus = 'draft' | 'issued' | 'cancelled'

export type ProformaInvoiceSource = 'direct' | 'sales_order'

export interface ProformaInvoiceLine {
  id: string
  lineNo: number
  productId: string
  itemCode: string
  description: string
  hsnCode: string
  qty: number
  uom: string
  unitPrice: number
  discountPct: number
  taxPct: number
  taxableValue: number
  gstAmount: number
  lineTotal: number
}

export interface ProformaInvoice {
  id: string
  proformaNo: string
  proformaDate: string
  validUntil: string
  status: ProformaInvoiceStatus
  source: ProformaInvoiceSource
  salesOrderId: string | null
  salesOrderNo: string | null
  quotationId: string | null
  quotationNo: string | null
  customerId: string
  customerName: string
  customerGstin: string
  customerState: string
  customerAddress: string
  placeOfSupply: string
  customerPoNumber: string | null
  paymentTerms: string
  deliveryTerms: string
  billingAddress: string | null
  shippingAddress: string | null
  remarks: string
  locationId?: string | null
  lines: ProformaInvoiceLine[]
  gst: GstBreakdown
  issuedAt: string | null
  createdAt: string
  updatedAt: string
}

export const PROFORMA_STATUS_LABELS: Record<ProformaInvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  cancelled: 'Cancelled',
}
