import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { resolveUserNames } from '../../../shared/index.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import * as companyRepo from '../companies/company.repository.js'
import * as repo from './sales-order.repository.js'
import { mapSalesOrderToDto } from './sales-order.types.js'
import {
  assertCloseable,
  assertConfirmable,
  assertDraftEditable,
  buildLinesFromInput,
  mergeUpdateLines,
  parseDateInput,
} from './sales-order.workflow.js'
import type {
  CreateSalesOrderInput,
  ListSalesOrdersQuery,
  UpdateSalesOrderInput,
} from './sales-order.validation.js'

async function mapOrder(tenantId: string, order: NonNullable<Awaited<ReturnType<typeof repo.findSalesOrderById>>>) {
  const nameMap = await resolveUserNames([order.createdBy, order.updatedBy], tenantId, prisma)
  return mapSalesOrderToDto(order, {
    createdByName: order.createdBy ? nameMap.get(order.createdBy) : undefined,
    modifiedByName: order.updatedBy ? nameMap.get(order.updatedBy) : undefined,
  })
}

function formatAddress(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p?.trim()).join(', ')
}

export async function listSalesOrders(tenantId: string, query: ListSalesOrdersQuery) {
  const result = await repo.findSalesOrders(tenantId, query)
  const nameMap = await resolveUserNames(
    result.items.flatMap((o) => [o.createdBy, o.updatedBy]),
    tenantId,
    prisma,
  )
  return {
    items: result.items.map((o) =>
      mapSalesOrderToDto(o, {
        createdByName: o.createdBy ? nameMap.get(o.createdBy) : undefined,
        modifiedByName: o.updatedBy ? nameMap.get(o.updatedBy) : undefined,
      }),
    ),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getSalesOrder(tenantId: string, id: string) {
  const order = await repo.findSalesOrderById(tenantId, id)
  if (!order) throw new NotFoundError('Sales order not found')
  return mapOrder(tenantId, order)
}

export async function createSalesOrder(tenantId: string, userId: string, input: CreateSalesOrderInput) {
  const company = await companyRepo.findCompanyById(tenantId, input.customerId)
  if (!company) throw new ValidationError('Customer (CRM company) not found')

  if (input.quotationId) {
    const existing = await repo.findSalesOrderByQuotationId(tenantId, input.quotationId)
    if (existing) throw new InvalidStateError('Sales order already exists for this quotation — use convert endpoint')
  }

  const { lines, summary } = buildLinesFromInput(input)
  const salesOrderNo = await nextCode(tenantId, 'SALES_ORDER')
  const orderDate = parseDateInput(input.orderDate) ?? new Date()
  const expectedDeliveryDate = parseDateInput(input.expectedDeliveryDate) ?? null
  const requiredDate = parseDateInput(input.requiredDate) ?? expectedDeliveryDate
  const billingAddress =
    input.billingAddress?.trim() ||
    formatAddress([company.addressLine1, company.addressLine2, company.city, company.state, company.pincode])
  const shippingAddress = input.shippingAddress?.trim() || billingAddress
  const directSoReason = input.source === 'direct' ? (input.directSoReason?.trim() ?? null) : input.directSoReason?.trim() ?? null
  const remarks =
    input.remarks?.trim() ||
    (directSoReason ? `Direct SO — ${directSoReason}` : null)

  const created = await repo.createSalesOrder({
    tenant: { connect: { id: tenantId } },
    company: { connect: { id: company.id } },
    salesOrderNo,
    productId: lines[0]?.productId ?? input.productId ?? null,
    qty: summary.qty,
    status: 'open',
    source: input.source,
    orderDate,
    requiredDate,
    expectedDeliveryDate,
    remarks,
    quotationId: input.quotationId ?? null,
    quotationNo: input.quotationNo ?? null,
    quotationRevisionNo: input.quotationRevisionNo ?? null,
    quotationDocumentId: input.quotationDocumentId ?? null,
    opportunityId: input.opportunityId ?? null,
    contactId: input.contactId ?? null,
    unitPrice: summary.unitPrice,
    discountPct: summary.discountPct,
    grandTotal: summary.grandTotal,
    basicAmount: summary.basicAmount,
    gstAmount: summary.gstAmount,
    paymentTerms: input.paymentTerms,
    deliveryTerms: input.deliveryTerms,
    warrantyTerms: input.warrantyTerms ?? null,
    commercialNotes: input.commercialNotes ?? null,
    technicalNotes: input.technicalNotes ?? null,
    customerCode: company.companyCode,
    customerPoNumber: input.customerPoNumber,
    customerPoDate: parseDateInput(input.customerPoDate) ?? null,
    deliveryLocation: input.deliveryLocation ?? null,
    billingAddress,
    shippingAddress,
    salesOwnerId: input.salesOwnerId ?? userId,
    salesOwnerName: input.salesOwnerName ?? null,
    internalRemarks: input.internalRemarks ?? null,
    directSoReason,
    locationId: input.locationId ?? null,
    lines: lines as unknown as Prisma.InputJsonValue,
    createdBy: userId,
    updatedBy: userId,
  })

  return mapOrder(tenantId, created)
}

export async function updateSalesOrder(tenantId: string, id: string, userId: string, input: UpdateSalesOrderInput) {
  const existing = await repo.findSalesOrderById(tenantId, id)
  if (!existing) throw new NotFoundError('Sales order not found')
  assertDraftEditable(existing)

  const lineBundle = mergeUpdateLines(input)
  const data: Parameters<typeof repo.updateSalesOrder>[2] = {
    updatedBy: userId,
  }

  if (input.customerPoNumber !== undefined) data.customerPoNumber = input.customerPoNumber
  if (input.customerPoDate !== undefined) data.customerPoDate = parseDateInput(input.customerPoDate) ?? null
  if (input.expectedDeliveryDate !== undefined) data.expectedDeliveryDate = parseDateInput(input.expectedDeliveryDate) ?? null
  if (input.requiredDate !== undefined) data.requiredDate = parseDateInput(input.requiredDate) ?? null
  if (input.deliveryLocation !== undefined) data.deliveryLocation = input.deliveryLocation
  if (input.locationId !== undefined) data.locationId = input.locationId
  if (input.internalRemarks !== undefined) data.internalRemarks = input.internalRemarks
  if (input.remarks !== undefined) data.remarks = input.remarks
  if (input.paymentTerms !== undefined) data.paymentTerms = input.paymentTerms
  if (input.deliveryTerms !== undefined) data.deliveryTerms = input.deliveryTerms
  if (input.warrantyTerms !== undefined) data.warrantyTerms = input.warrantyTerms
  if (input.commercialNotes !== undefined) data.commercialNotes = input.commercialNotes
  if (input.technicalNotes !== undefined) data.technicalNotes = input.technicalNotes
  if (input.billingAddress !== undefined) data.billingAddress = input.billingAddress
  if (input.shippingAddress !== undefined) data.shippingAddress = input.shippingAddress
  if (input.directSoReason !== undefined) data.directSoReason = input.directSoReason
  if (input.contactId !== undefined) data.contactId = input.contactId
  if (input.salesOwnerId !== undefined) data.salesOwnerId = input.salesOwnerId
  if (input.salesOwnerName !== undefined) data.salesOwnerName = input.salesOwnerName
  if (input.qty !== undefined && !lineBundle) data.qty = input.qty
  if (input.unitPrice !== undefined && !lineBundle) data.unitPrice = input.unitPrice
  if (input.discountPct !== undefined && !lineBundle) data.discountPct = input.discountPct

  if (lineBundle) {
    data.lines = lineBundle.lines as unknown as Prisma.InputJsonValue
    data.qty = lineBundle.summary.qty
    data.unitPrice = lineBundle.summary.unitPrice
    data.discountPct = lineBundle.summary.discountPct
    data.basicAmount = lineBundle.summary.basicAmount
    data.gstAmount = lineBundle.summary.gstAmount
    data.grandTotal = lineBundle.summary.grandTotal
    data.productId = lineBundle.lines[0]?.productId ?? existing.productId
  }

  const updated = await repo.updateSalesOrder(tenantId, id, data)
  if (!updated) throw new NotFoundError('Sales order not found')
  return mapOrder(tenantId, updated)
}

export async function deleteSalesOrder(tenantId: string, id: string, userId: string) {
  const existing = await repo.findSalesOrderById(tenantId, id)
  if (!existing) throw new NotFoundError('Sales order not found')
  assertDraftEditable(existing)
  await repo.softDeleteSalesOrder(tenantId, id, userId)
}

export async function confirmSalesOrder(tenantId: string, id: string, userId: string) {
  const existing = await repo.findSalesOrderById(tenantId, id)
  if (!existing) throw new NotFoundError('Sales order not found')
  assertConfirmable(existing)
  const updated = await repo.updateSalesOrder(tenantId, id, {
    status: 'confirmed',
    updatedBy: userId,
  })
  if (!updated) throw new NotFoundError('Sales order not found')
  return mapOrder(tenantId, updated)
}

export async function closeSalesOrder(tenantId: string, id: string, userId: string) {
  const existing = await repo.findSalesOrderById(tenantId, id)
  if (!existing) throw new NotFoundError('Sales order not found')
  assertCloseable(existing)
  const updated = await repo.updateSalesOrder(tenantId, id, {
    status: 'closed',
    updatedBy: userId,
  })
  if (!updated) throw new NotFoundError('Sales order not found')
  return mapOrder(tenantId, updated)
}
