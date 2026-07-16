import type { CrmSalesOrder } from '@prisma/client'
import { decimalToNumber, mapAuditFields, type AuditUserNames, toIso } from '../../../shared/index.js'

export interface SalesOrderLineDto {
  id: string
  lineNo: number
  productOrItem: string
  description: string
  productId?: string | null
  qty: number
  uom: string
  unitPrice: number
  discountPct: number
  taxPct: number
  taxableValue: number
  gstAmount: number
  lineTotal: number
  technicalScopeRef?: string | null
}

export interface SalesOrderDto {
  id: string
  salesOrderNo: string
  customerId: string
  productId: string | null
  qty: number
  requiredDate: string | null
  status: string
  remarks: string | null
  createdAt: string
  quotationId: string | null
  quotationNo: string | null
  quotationRevisionNo: number | null
  quotationDocumentId: string | null
  quotationDocumentRevisionNo: number | null
  opportunityId: string | null
  contactId: string | null
  unitPrice: number | null
  discountPct: number | null
  grandTotal: number | null
  paymentTerms: string | null
  deliveryTerms: string | null
  warrantyTerms: string | null
  commercialNotes: string | null
  technicalNotes: string | null
  orderDate: string | null
  source: string | null
  customerCode: string | null
  customerPoNumber: string | null
  customerPoDate: string | null
  expectedDeliveryDate: string | null
  deliveryLocation: string | null
  billingAddress: string | null
  shippingAddress: string | null
  salesOwnerId: string | null
  salesOwnerName: string | null
  basicAmount: number | null
  gstAmount: number | null
  internalRemarks: string | null
  locationId: string | null
  lines: SalesOrderLineDto[]
  createdById: string | null
  createdByName: string | null
  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null
}

function parseLines(value: unknown): SalesOrderLineDto[] {
  return Array.isArray(value) ? (value as SalesOrderLineDto[]) : []
}

export function mapSalesOrderToDto(order: CrmSalesOrder, names?: AuditUserNames): SalesOrderDto {
  return {
    id: order.id,
    salesOrderNo: order.salesOrderNo,
    customerId: order.companyId,
    productId: order.productId,
    qty: decimalToNumber(order.qty),
    requiredDate: toIso(order.requiredDate)?.slice(0, 10) ?? null,
    status: order.status,
    remarks: order.remarks,
    quotationId: order.quotationId,
    quotationNo: order.quotationNo,
    quotationRevisionNo: order.quotationRevisionNo,
    quotationDocumentId: order.quotationDocumentId,
    quotationDocumentRevisionNo: order.quotationDocumentRevisionNo,
    opportunityId: order.opportunityId,
    contactId: order.contactId,
    unitPrice: order.unitPrice != null ? decimalToNumber(order.unitPrice) : null,
    discountPct: order.discountPct != null ? decimalToNumber(order.discountPct) : null,
    grandTotal: order.grandTotal != null ? decimalToNumber(order.grandTotal) : null,
    paymentTerms: order.paymentTerms,
    deliveryTerms: order.deliveryTerms,
    warrantyTerms: order.warrantyTerms,
    commercialNotes: order.commercialNotes,
    technicalNotes: order.technicalNotes,
    orderDate: toIso(order.orderDate)?.slice(0, 10) ?? null,
    source: order.source,
    customerCode: order.customerCode,
    customerPoNumber: order.customerPoNumber,
    customerPoDate: toIso(order.customerPoDate)?.slice(0, 10) ?? null,
    expectedDeliveryDate: toIso(order.expectedDeliveryDate)?.slice(0, 10) ?? null,
    deliveryLocation: order.deliveryLocation,
    billingAddress: order.billingAddress,
    shippingAddress: order.shippingAddress,
    salesOwnerId: order.salesOwnerId,
    salesOwnerName: order.salesOwnerName,
    basicAmount: order.basicAmount != null ? decimalToNumber(order.basicAmount) : null,
    gstAmount: order.gstAmount != null ? decimalToNumber(order.gstAmount) : null,
    internalRemarks: order.internalRemarks,
    locationId: order.locationId,
    lines: parseLines(order.lines),
    ...mapAuditFields(order, names),
  }
}
