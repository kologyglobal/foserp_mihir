import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { nextPurchaseDocumentNumber } from '../shared/purchase-document-number.js'
import {
  VendorQuotationNotEditableError,
  VendorQuotationNotFoundError,
  VendorQuotationRfqNotOpenError,
  VendorQuotationVendorNotInvitedError,
} from './vendor-quotation.errors.js'
import { mapVendorQuotationToDto } from './vendor-quotation.mapper.js'
import * as repo from './vendor-quotation.repository.js'
import type {
  CreateVendorQuotationInput,
  LifecycleRemarksInput,
  ListVendorQuotationsQuery,
  UpdateVendorQuotationInput,
} from './vendor-quotation.validation.js'

const activeRfqStatuses = ['SENT', 'QUOTATION_RECEIVED', 'UNDER_COMPARISON', 'VENDOR_SELECTED', 'CONVERTED_TO_PO']
const asDate = (value: string | null | undefined) => (value ? new Date(value) : null)

function normalizeLines(lines: CreateVendorQuotationInput['lines']) {
  return lines.map((line, index) => ({
    lineNumber: index + 1,
    requestForQuotationLineId: line.requestForQuotationLineId ?? null,
    itemId: line.itemId ?? null,
    itemCodeSnapshot: line.itemCodeSnapshot?.trim() || '',
    itemNameSnapshot: line.itemNameSnapshot?.trim() || '',
    description: line.description?.trim() || null,
    quantity: line.quantity,
    uomId: line.uomId ?? null,
    rate: line.rate,
    amount: line.quantity * line.rate,
    leadTimeDays: line.leadTimeDays ?? null,
    remarks: line.remarks?.trim() || null,
  }))
}

async function loadOrThrow(tenantId: string, id: string) {
  const quotation = await repo.findVendorQuotationById(tenantId, id)
  if (!quotation) throw new VendorQuotationNotFoundError()
  return quotation
}

async function assertVendorCanQuote(tenantId: string, requestForQuotationId: string, vendorId: string) {
  const rfq = await prisma.requestForQuotation.findFirst({
    where: { id: requestForQuotationId, ...tenantActiveFilter(tenantId) },
    include: { vendors: { where: { tenantId, vendorId } } },
  })
  if (!rfq || !activeRfqStatuses.includes(rfq.status)) throw new VendorQuotationRfqNotOpenError()
  if (!rfq.vendors.length) throw new VendorQuotationVendorNotInvitedError()
  return rfq
}

function quotationData(input: Partial<CreateVendorQuotationInput>, actorId: string): Prisma.VendorQuotationUncheckedUpdateInput {
  return {
    quotationDate: input.quotationDate ? asDate(input.quotationDate) ?? undefined : undefined,
    currencyCode: input.currencyCode,
    validUntil: input.validUntil === undefined ? undefined : (asDate(input.validUntil) as never),
    paymentTerms: input.paymentTerms === undefined ? undefined : input.paymentTerms?.trim() || null,
    deliveryTerms: input.deliveryTerms === undefined ? undefined : input.deliveryTerms?.trim() || null,
    freightAmount: input.freightAmount,
    discountAmount: input.discountAmount,
    otherCharges: input.otherCharges,
    taxAmount: input.taxAmount,
    warranty: input.warranty === undefined ? undefined : input.warranty?.trim() || null,
    remarks: input.remarks === undefined ? undefined : input.remarks?.trim() || null,
    updatedById: actorId,
  }
}

export async function listVendorQuotations(tenantId: string, query: ListVendorQuotationsQuery) {
  const result = await repo.findVendorQuotations(tenantId, query)
  return { ...result, items: result.items.map(mapVendorQuotationToDto) }
}

export async function getVendorQuotation(tenantId: string, id: string) {
  return mapVendorQuotationToDto(await loadOrThrow(tenantId, id))
}

export async function createVendorQuotation(tenantId: string, actorId: string, input: CreateVendorQuotationInput) {
  await assertVendorCanQuote(tenantId, input.requestForQuotationId, input.vendorId)
  const quotationNumber = await nextPurchaseDocumentNumber(tenantId, 'VENDOR_QUOTATION', 'VQ')
  const lines = normalizeLines(input.lines)
  const basicTotal = lines.reduce((total, line) => total + line.amount, 0)
  const created = await prisma.$transaction(async (tx) => {
    const quotation = await repo.createVendorQuotation({
      tenantId,
      quotationNumber,
      quotationDate: asDate(input.quotationDate) ?? new Date(),
      requestForQuotationId: input.requestForQuotationId,
      vendorId: input.vendorId,
      status: 'DRAFT',
      currencyCode: input.currencyCode,
      validUntil: asDate(input.validUntil),
      paymentTerms: input.paymentTerms?.trim() || null,
      deliveryTerms: input.deliveryTerms?.trim() || null,
      freightAmount: input.freightAmount,
      discountAmount: input.discountAmount,
      otherCharges: input.otherCharges,
      taxAmount: input.taxAmount,
      totalAmount: basicTotal,
      warranty: input.warranty?.trim() || null,
      remarks: input.remarks?.trim() || null,
      createdById: actorId,
      updatedById: actorId,
      lines: { create: lines.map((line) => ({ tenantId, ...line })) },
    }, tx)
    await repo.createStatusHistory(tenantId, quotation.id, null, 'DRAFT', actorId, null, tx)
    return quotation
  })
  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.VQ,
    entityId: created.id,
    action: PURCHASE_AUDIT_ACTION.VQ_CREATED,
    newValue: {
      quotationNumber: created.quotationNumber,
      requestForQuotationId: created.requestForQuotationId,
      vendorId: created.vendorId,
    },
  })
  return mapVendorQuotationToDto(created)
}

export async function updateVendorQuotation(tenantId: string, id: string, actorId: string, input: UpdateVendorQuotationInput) {
  const current = await loadOrThrow(tenantId, id)
  if (current.status !== 'DRAFT') throw new VendorQuotationNotEditableError()
  const updated = await prisma.$transaction(async (tx) => {
    await tx.vendorQuotation.update({ where: { id }, data: quotationData(input, actorId) })
    if (input.lines) await repo.replaceVendorQuotationLines(tenantId, id, normalizeLines(input.lines), tx)
    const next = await repo.findVendorQuotationById(tenantId, id, tx)
    if (!next) throw new VendorQuotationNotFoundError()
    return next
  })
  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.VQ,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.VQ_UPDATED,
  })
  return mapVendorQuotationToDto(updated)
}

export async function submitVendorQuotation(
  tenantId: string,
  id: string,
  actorId: string,
  input: LifecycleRemarksInput = {},
) {
  const current = await loadOrThrow(tenantId, id)
  if (current.status !== 'DRAFT') throw new VendorQuotationNotEditableError('Only draft vendor quotations can be submitted')
  const rfq = await assertVendorCanQuote(tenantId, current.requestForQuotationId ?? '', current.vendorId)
  const basicTotal = current.lines.reduce((total, line) => total + Number(line.amount), 0)
  const landedCost = basicTotal - Number(current.discountAmount) + Number(current.freightAmount) + Number(current.otherCharges) + Number(current.taxAmount)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.vendorQuotation.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), totalAmount: basicTotal, landedCost, updatedById: actorId, remarks: input.remarks?.trim() || current.remarks },
    })
    if (rfq.status === 'SENT') {
      await tx.requestForQuotation.update({ where: { id: rfq.id }, data: { status: 'QUOTATION_RECEIVED', updatedById: actorId } })
    }
    await repo.createStatusHistory(tenantId, id, 'DRAFT', 'SUBMITTED', actorId, input.remarks?.trim() || null, tx)
    const next = await repo.findVendorQuotationById(tenantId, id, tx)
    if (!next) throw new VendorQuotationNotFoundError()
    return next
  })
  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.VQ,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.VQ_SUBMITTED,
  })
  if (current.requestForQuotationId) {
    await writePurchaseAudit({
      tenantId,
      actorId,
      entity: PURCHASE_AUDIT_ENTITY.RFQ,
      entityId: current.requestForQuotationId,
      action: PURCHASE_AUDIT_ACTION.RFQ_VENDOR_QUOTATION_ENTERED,
      newValue: {
        vendorQuotationId: id,
        vendorId: current.vendorId,
        quotationNumber: current.quotationNumber,
      },
    })
  }
  return mapVendorQuotationToDto(updated)
}
