import type { CrmSalesOrder } from '@prisma/client'
import { decimalToNumber, mapAuditFields, type AuditUserNames, toIso } from '../../../shared/index.js'

export interface SalesOrderLineDto {
  id: string
  lineNo: number
  productOrItem: string
  description: string
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  qty: number
  uom: string
  unitPrice: number
  discountPct: number
  taxPct: number
  taxableValue: number
  gstAmount: number
  lineTotal: number
  technicalScopeRef?: string | null
  /** HSN/SAC snapshot at line resolve — not live item master. */
  hsnCode?: string | null
  hsnId?: string | null
  taxScheme?: string | null
  cgstRate?: number | null
  sgstRate?: number | null
  utgstRate?: number | null
  igstRate?: number | null
  cgstAmount?: number | null
  sgstAmount?: number | null
  utgstAmount?: number | null
  igstAmount?: number | null
}

export type SalesOrderWithCompany = CrmSalesOrder & {
  company?: { id: string; name: string; companyCode?: string | null } | null
}

export interface SalesOrderDto {
  id: string
  salesOrderNo: string
  customerId: string
  /** Resolved from CRM company for list/detail consumers (mobile/web). */
  customerName: string | null
  itemId: string
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
  deliveryTime: string | null
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
  directSoReason: string | null
  locationId: string | null
  lines: SalesOrderLineDto[]
  /** GST header snapshot (PoS / supply type / scheme aggregates). */
  placeOfSupply: string | null
  placeOfSupplyStateCode: string | null
  placeOfSupplySource: string | null
  placeOfSupplyOverride: boolean
  placeOfSupplyOverrideReason: string | null
  supplierStateCode: string | null
  supplyType: string | null
  gstScheme: string | null
  cgstAmount: number | null
  sgstAmount: number | null
  utgstAmount: number | null
  igstAmount: number | null
  cessAmount: number | null
  createdById: string | null
  createdByName: string | null
  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null
}

function parseLines(value: unknown): SalesOrderLineDto[] {
  return Array.isArray(value) ? (value as SalesOrderLineDto[]) : []
}

export function mapSalesOrderToDto(order: SalesOrderWithCompany, names?: AuditUserNames): SalesOrderDto {
  const companyName = order.company?.name?.trim() || null
  return {
    id: order.id,
    salesOrderNo: order.salesOrderNo,
    customerId: order.companyId,
    customerName: companyName,
    itemId: order.itemId,
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
    deliveryTime: order.deliveryTime ?? null,
    warrantyTerms: order.warrantyTerms,
    commercialNotes: order.commercialNotes,
    technicalNotes: order.technicalNotes,
    orderDate: toIso(order.orderDate)?.slice(0, 10) ?? null,
    source: order.source,
    customerCode: order.customerCode ?? order.company?.companyCode ?? null,
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
    directSoReason: order.directSoReason ?? null,
    locationId: order.locationId,
    lines: parseLines(order.lines),
    placeOfSupply: order.placeOfSupply ?? null,
    placeOfSupplyStateCode: order.placeOfSupplyStateCode ?? null,
    placeOfSupplySource: order.placeOfSupplySource ?? null,
    placeOfSupplyOverride: Boolean(order.placeOfSupplyOverride),
    placeOfSupplyOverrideReason: order.placeOfSupplyOverrideReason ?? null,
    supplierStateCode: order.supplierStateCode ?? null,
    supplyType: order.supplyType ?? null,
    gstScheme: order.gstScheme ?? null,
    cgstAmount: order.cgstAmount != null ? decimalToNumber(order.cgstAmount) : null,
    sgstAmount: order.sgstAmount != null ? decimalToNumber(order.sgstAmount) : null,
    utgstAmount: order.utgstAmount != null ? decimalToNumber(order.utgstAmount) : null,
    igstAmount: order.igstAmount != null ? decimalToNumber(order.igstAmount) : null,
    cessAmount: order.cessAmount != null ? decimalToNumber(order.cessAmount) : null,
    ...mapAuditFields(order, names),
  }
}
