import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { nextPurchaseDocumentNumber } from '../shared/purchase-document-number.js'
import { linkPurchaseRequisitionLinesToOrder } from '../shared/purchase-pr-line-po-link.js'
import {
  ComparisonInvalidAwardError,
  ComparisonNoSubmittedQuotationsError,
  ComparisonNotAwardableError,
  ComparisonNotFoundError,
  ComparisonPurchaseOrderExistsError,
} from './comparison.errors.js'
import { mapComparisonToDto, mapPurchaseOrderToDto } from './comparison.mapper.js'
import * as repo from './comparison.repository.js'
import type { AwardComparisonInput, ComparisonListQuery, CreateComparisonInput } from './comparison.validation.js'

async function loadOrThrow(tenantId: string, id: string) {
  const comparison = await repo.findComparisonById(tenantId, id)
  if (!comparison) throw new ComparisonNotFoundError()
  return comparison
}

async function mapComparison(tenantId: string, comparison: Awaited<ReturnType<typeof loadOrThrow>>) {
  const quotations = await repo.findComparisonQuotations(tenantId, comparison.requestForQuotationId)
  const userNames = await repo.resolveUserNames(tenantId, [comparison.awardedById, comparison.createdById])
  return mapComparisonToDto(comparison, quotations, userNames)
}

export async function listComparisons(tenantId: string, query: ComparisonListQuery) {
  const result = await repo.findComparisons(tenantId, query)
  return {
    ...result,
    items: await Promise.all(result.items.map((comparison) => mapComparison(tenantId, comparison))),
  }
}

export async function getComparison(tenantId: string, id: string) {
  return mapComparison(tenantId, await loadOrThrow(tenantId, id))
}

export async function createComparison(tenantId: string, actorId: string, input: CreateComparisonInput) {
  const rfq = await prisma.requestForQuotation.findFirst({
    where: { id: input.requestForQuotationId, ...tenantActiveFilter(tenantId) },
  })
  if (!rfq) throw new ComparisonNotFoundError('RFQ not found')
  const quotations = await repo.findSubmittedQuotations(tenantId, input.requestForQuotationId)
  if (!quotations.length) throw new ComparisonNoSubmittedQuotationsError()
  const comparisonNumber = await nextPurchaseDocumentNumber(tenantId, 'VENDOR_COMPARISON', 'VC')
  const comparison = await prisma.$transaction(async (tx) => {
    const lines = quotations.flatMap((quotation) => quotation.lines.map((line) => ({
      tenantId,
      requestForQuotationLineId: line.requestForQuotationLineId,
      vendorQuotationId: quotation.id,
      vendorQuotationLineId: line.id,
      itemId: line.itemId,
      quantity: line.quantity,
      rate: line.rate,
      amount: line.amount,
    })))
    const created = await tx.vendorComparison.create({
      data: {
        tenantId,
        comparisonNumber,
        comparisonDate: new Date(),
        requestForQuotationId: input.requestForQuotationId,
        status: 'UNDER_COMPARISON',
        createdById: actorId,
        updatedById: actorId,
        lines: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
    await tx.requestForQuotation.update({ where: { id: rfq.id }, data: { status: 'UNDER_COMPARISON', updatedById: actorId } })
    await repo.createStatusHistory(tenantId, created.id, null, 'UNDER_COMPARISON', actorId, null, tx)
    return created
  })
  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.RFQ,
    entityId: input.requestForQuotationId,
    action: PURCHASE_AUDIT_ACTION.RFQ_COMPARISON_COMPLETED,
    newValue: { comparisonId: comparison.id, comparisonNumber: comparison.comparisonNumber },
  })
  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.COMPARISON,
    entityId: comparison.id,
    action: PURCHASE_AUDIT_ACTION.RFQ_COMPARISON_COMPLETED,
    newValue: {
      comparisonNumber: comparison.comparisonNumber,
      requestForQuotationId: input.requestForQuotationId,
    },
  })
  return mapComparison(tenantId, comparison)
}

export async function awardComparison(tenantId: string, id: string, actorId: string, input: AwardComparisonInput) {
  const current = await loadOrThrow(tenantId, id)
  if (current.status !== 'UNDER_COMPARISON') throw new ComparisonNotAwardableError()
  const winningQuotation = await prisma.vendorQuotation.findFirst({
    where: { id: input.awardedVendorQuotationId, ...tenantActiveFilter(tenantId), requestForQuotationId: current.requestForQuotationId, status: 'SUBMITTED' },
  })
  if (!winningQuotation) throw new ComparisonInvalidAwardError()
  const updated = await prisma.$transaction(async (tx) => {
    await tx.vendorQuotation.updateMany({
      where: { ...tenantActiveFilter(tenantId), requestForQuotationId: current.requestForQuotationId, status: 'SUBMITTED' },
      data: { status: 'REJECTED', updatedById: actorId },
    })
    await tx.vendorQuotation.update({ where: { id: winningQuotation.id }, data: { status: 'SELECTED', updatedById: actorId } })
    await tx.vendorComparisonLine.updateMany({
      where: { tenantId, vendorComparisonId: id },
      data: { isSelected: false },
    })
    await tx.vendorComparisonLine.updateMany({
      where: { tenantId, vendorComparisonId: id, vendorQuotationId: winningQuotation.id },
      data: { isSelected: true },
    })
    await tx.vendorComparison.update({
      where: { id },
      data: {
        status: 'VENDOR_SELECTED',
        awardedVendorId: winningQuotation.vendorId,
        awardedVendorQuotationId: winningQuotation.id,
        selectionReason: input.selectionReason,
        awardedById: actorId,
        selectedAt: new Date(),
        updatedById: actorId,
      },
    })
    await tx.requestForQuotation.update({ where: { id: current.requestForQuotationId }, data: { status: 'VENDOR_SELECTED', updatedById: actorId } })
    await repo.createStatusHistory(tenantId, id, current.status, 'VENDOR_SELECTED', actorId, input.selectionReason, tx)
    const next = await repo.findComparisonById(tenantId, id, tx)
    if (!next) throw new ComparisonNotFoundError()
    return next
  })
  const awardPayload = {
    awardedVendorQuotationId: winningQuotation.id,
    awardedVendorId: winningQuotation.vendorId,
    reason: input.selectionReason,
  }
  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.RFQ,
    entityId: current.requestForQuotationId,
    action: PURCHASE_AUDIT_ACTION.RFQ_VENDOR_AWARDED,
    newValue: awardPayload,
  })
  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.COMPARISON,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.RFQ_VENDOR_AWARDED,
    newValue: awardPayload,
  })
  return mapComparison(tenantId, updated)
}

export async function createPurchaseOrderFromComparison(tenantId: string, id: string, actorId: string) {
  const comparison = await loadOrThrow(tenantId, id)
  const existing = await prisma.purchaseOrder.findFirst({
    where: { ...tenantActiveFilter(tenantId), vendorComparisonId: id },
  })
  if (existing) throw new ComparisonPurchaseOrderExistsError()
  if (comparison.status !== 'VENDOR_SELECTED' || !comparison.awardedVendorQuotationId || !comparison.awardedVendorId) {
    throw new ComparisonNotAwardableError('Select a vendor before creating a purchase order')
  }
  const quotation = await prisma.vendorQuotation.findFirst({
    where: { id: comparison.awardedVendorQuotationId, ...tenantActiveFilter(tenantId), status: 'SELECTED' },
    include: {
      lines: {
        orderBy: { lineNumber: 'asc' },
        include: {
          requestForQuotationLine: { select: { purchaseRequisitionLineId: true } },
        },
      },
    },
  })
  if (!quotation) throw new ComparisonInvalidAwardError('Awarded vendor quotation is unavailable')
  const rfq = await prisma.requestForQuotation.findFirst({ where: { id: comparison.requestForQuotationId, ...tenantActiveFilter(tenantId) } })
  if (!rfq) throw new ComparisonNotFoundError('RFQ not found')
  const orderNumber = await nextPurchaseDocumentNumber(tenantId, 'PURCHASE_ORDER', 'PO')
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseOrder.create({
      data: {
        tenantId, orderNumber, orderDate: new Date(), vendorId: quotation.vendorId, origin: 'RFQ_COMPARISON', status: 'DRAFT',
        purchaseRequisitionId: rfq.purchaseRequisitionId, requestForQuotationId: rfq.id, vendorQuotationId: quotation.id, vendorComparisonId: comparison.id,
        currencyCode: quotation.currencyCode, paymentTerms: quotation.paymentTerms, deliveryTerms: quotation.deliveryTerms,
        subtotalAmount: quotation.totalAmount, taxAmount: quotation.taxAmount, freightAmount: quotation.freightAmount, totalAmount: quotation.landedCost,
        remarks: quotation.remarks, createdById: actorId, updatedById: actorId,
        lines: {
          create: quotation.lines.map((line) => ({
            tenantId,
            lineNumber: line.lineNumber,
            purchaseRequisitionLineId: line.requestForQuotationLine?.purchaseRequisitionLineId ?? null,
            itemId: line.itemId,
            itemCodeSnapshot: line.itemCodeSnapshot,
            itemNameSnapshot: line.itemNameSnapshot,
            description: line.description,
            quantity: line.quantity,
            uomId: line.uomId,
            rate: line.rate,
            amount: line.amount,
            remarks: line.remarks,
          })),
        },
      },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
    await tx.vendorComparison.update({ where: { id }, data: { status: 'CONVERTED_TO_PO', updatedById: actorId } })
    await tx.requestForQuotation.update({ where: { id: rfq.id }, data: { status: 'CONVERTED_TO_PO', updatedById: actorId } })
    await linkPurchaseRequisitionLinesToOrder(
      tx,
      tenantId,
      created.id,
      created.orderNumber,
      quotation.lines
        .map((line) => line.requestForQuotationLine?.purchaseRequisitionLineId)
        .filter((lineId): lineId is string => Boolean(lineId)),
    )
    await repo.createStatusHistory(tenantId, id, comparison.status, 'CONVERTED_TO_PO', actorId, `Purchase order ${orderNumber} created`, tx)
    return created
  })
  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PO,
    entityId: order.id,
    action: PURCHASE_AUDIT_ACTION.PO_CREATED,
    newValue: {
      orderNumber: order.orderNumber,
      comparisonId: id,
      requestForQuotationId: rfq.id,
    },
  })
  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.RFQ,
    entityId: rfq.id,
    action: PURCHASE_AUDIT_ACTION.RFQ_CONVERTED_TO_PO,
    newValue: { purchaseOrderId: order.id, orderNumber: order.orderNumber, comparisonId: id },
  })
  return mapPurchaseOrderToDto(order)
}
