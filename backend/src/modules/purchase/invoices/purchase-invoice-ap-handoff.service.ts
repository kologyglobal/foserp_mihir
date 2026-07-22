import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { createVendorInvoiceDraft } from '../../accounting/payables/vendor-invoices/vendor-invoice-draft.service.js'
import type { CreateVendorInvoiceInput } from '../../accounting/payables/vendor-invoices/vendor-invoice.schemas.js'
import { PurchaseInvoiceValidationError } from './purchase-invoice.errors.js'
import * as repo from './purchase-invoice.repository.js'

function dec(value: unknown): string {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? String(n) : '0'
}

function dateStr(value: Date | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10)
  return value.toISOString().slice(0, 10)
}

async function resolveLegalEntityId(tenantId: string): Promise<string> {
  const settings = await prisma.financeSettings.findFirst({
    where: { tenantId },
    select: { legalEntityId: true },
    orderBy: { createdAt: 'asc' },
  })
  if (settings?.legalEntityId) return settings.legalEntityId
  const le = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    select: { id: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  if (!le) {
    throw new PurchaseInvoiceValidationError(
      'No active legal entity configured for AP handoff. Set Finance Settings legal entity first.',
      [{ field: 'legalEntityId', message: 'Legal entity required for Vendor Invoice draft.' }],
    )
  }
  return le.id
}

export async function buildVendorInvoiceDraftPreview(tenantId: string, purchaseInvoiceId: string) {
  const invoice = await repo.findPurchaseInvoiceById(tenantId, purchaseInvoiceId)
  if (!invoice) throw new PurchaseInvoiceValidationError('Purchase invoice not found.')
  const legalEntityId = await resolveLegalEntityId(tenantId)
  const payload = await buildCreateVendorInvoiceInput(tenantId, invoice, legalEntityId)
  return {
    legalEntityId,
    sourceMode: payload.sourceMode,
    supplierInvoiceNumber: payload.supplierInvoiceNumber,
    documentDate: payload.documentDate,
    vendorId: payload.vendorId,
    currencyCode: payload.currencyCode,
    lineCount: payload.lines.length,
    sourceLinks: payload.sourceLinks,
    lines: payload.lines.map((line) => ({
      lineNumber: line.lineNumber,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      gstRate: line.gstRate,
      itemId: line.itemId ?? null,
    })),
    existingVendorInvoiceId: invoice.vendorInvoiceId,
    existingVendorInvoiceDraftRef: invoice.vendorInvoiceDraftRef,
  }
}

async function buildCreateVendorInvoiceInput(
  tenantId: string,
  invoice: NonNullable<Awaited<ReturnType<typeof repo.findPurchaseInvoiceById>>>,
  legalEntityId: string,
): Promise<CreateVendorInvoiceInput> {
  const po = invoice.purchaseOrderId
    ? await prisma.purchaseOrder.findFirst({
        where: { id: invoice.purchaseOrderId, tenantId, deletedAt: null },
        select: { id: true, orderNumber: true, orderDate: true },
      })
    : null
  const grn = invoice.goodsReceiptId
    ? await prisma.goodsReceipt.findFirst({
        where: { id: invoice.goodsReceiptId, tenantId, deletedAt: null },
        select: { id: true, grnNumber: true, receiptDate: true },
      })
    : null

  const sourceLinks: CreateVendorInvoiceInput['sourceLinks'] = []
  if (po) {
    sourceLinks.push({
      sourceType: 'PURCHASE_ORDER',
      sourceDocumentId: po.id,
      sourceDocumentNumberSnapshot: po.orderNumber,
      sourceDocumentDateSnapshot: dateStr(po.orderDate),
      metadata: { purchaseInvoiceId: invoice.id, purchaseInvoiceNumber: invoice.invoiceNumber },
    })
  }
  if (grn) {
    sourceLinks.push({
      sourceType: 'GOODS_RECEIPT',
      sourceDocumentId: grn.id,
      sourceDocumentNumberSnapshot: grn.grnNumber,
      sourceDocumentDateSnapshot: dateStr(grn.receiptDate),
      metadata: { purchaseInvoiceId: invoice.id, purchaseInvoiceNumber: invoice.invoiceNumber },
    })
  }

  const sourceMode =
    po && grn ? 'PURCHASE_ORDER_AND_GRN' : po ? 'PURCHASE_ORDER' : grn ? 'GRN' : 'DIRECT'

  const supplierInvoiceNumber =
    invoice.vendorInvoiceNumber?.trim() || invoice.invoiceNumber

  return {
    legalEntityId,
    vendorId: invoice.vendorId,
    sourceMode,
    invoiceType: 'GOODS',
    supplierInvoiceNumber,
    supplierInvoiceDate: dateStr(invoice.vendorInvoiceDate ?? invoice.invoiceDate),
    documentDate: dateStr(invoice.invoiceDate),
    currencyCode: invoice.currencyCode || 'INR',
    exchangeRate: '1',
    taxTreatment: invoice.reverseCharge ? 'REVERSE_CHARGE' : 'REGULAR',
    placeOfSupply: invoice.placeOfSupplyStateCode ?? null,
    lines: invoice.lines.map((line) => ({
      lineNumber: line.lineNumber,
      lineType: 'ITEM' as const,
      description: line.description?.trim() || line.itemNameSnapshot || line.itemCodeSnapshot || `Line ${line.lineNumber}`,
      itemId: line.itemId,
      itemCodeSnapshot: line.itemCodeSnapshot || null,
      itemNameSnapshot: line.itemNameSnapshot || null,
      quantity: dec(line.quantity),
      uomCodeSnapshot: line.uomCodeSnapshot || null,
      unitPrice: dec(line.rate),
      gstRate: dec(line.taxRatePct),
      sourceLinkType: line.goodsReceiptLineId ? 'GOODS_RECEIPT' : line.purchaseOrderLineId ? 'PURCHASE_ORDER' : null,
      sourceDocumentId: line.goodsReceiptLineId
        ? invoice.goodsReceiptId
        : line.purchaseOrderLineId
          ? invoice.purchaseOrderId
          : null,
      sourceDocumentLineId: line.goodsReceiptLineId ?? line.purchaseOrderLineId ?? null,
      sourceDocumentNumber: line.goodsReceiptLineId
        ? grn?.grnNumber ?? null
        : line.purchaseOrderLineId
          ? po?.orderNumber ?? null
          : null,
    })),
    sourceLinks,
  }
}

/**
 * Creates (or returns existing) Accounting VendorInvoice draft from a posted Purchase Invoice.
 * Does not post GL — VendorInvoice remains the financial SoT.
 */
export async function handoffPurchaseInvoiceToVendorInvoiceDraft(
  tenantId: string,
  purchaseInvoiceId: string,
  actorId: string,
) {
  const invoice = await repo.findPurchaseInvoiceById(tenantId, purchaseInvoiceId)
  if (!invoice) throw new PurchaseInvoiceValidationError('Purchase invoice not found.')

  if (invoice.vendorInvoiceId) {
    const existing = await prisma.vendorInvoice.findFirst({
      where: { id: invoice.vendorInvoiceId, tenantId },
      select: { id: true, draftReference: true, status: true, vendorInvoiceNumber: true },
    })
    if (existing) {
      return {
        vendorInvoiceId: existing.id,
        draftReference: existing.draftReference,
        status: existing.status,
        vendorInvoiceNumber: existing.vendorInvoiceNumber,
        reused: true as const,
      }
    }
  }

  const legalEntityId = await resolveLegalEntityId(tenantId)
  const input = await buildCreateVendorInvoiceInput(tenantId, invoice, legalEntityId)
  const req = { context: { userId: actorId } } as unknown as Request
  const created = await createVendorInvoiceDraft(req, tenantId, input)

  await repo.updatePurchaseInvoice(tenantId, purchaseInvoiceId, {
    vendorInvoiceId: created.id,
    vendorInvoiceDraftRef: created.draftReference ?? null,
    updatedById: actorId,
  })

  return {
    vendorInvoiceId: created.id,
    draftReference: created.draftReference ?? null,
    status: created.status,
    vendorInvoiceNumber: created.vendorInvoiceNumber ?? null,
    reused: false as const,
  }
}
