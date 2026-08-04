/**
 * One-shot: migrate CRM-only tax invoices (no salesInvoiceId) into canonical SalesInvoice drafts.
 *
 * Converted pairs are stamped by SQL migration 20260804020000_unify_sales_invoice_commercial.
 *
 * Usage (from backend/):
 *   npx tsx scripts/migrate-crm-tax-invoices-to-sales-invoices.ts
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../src/config/prisma.js'
import { generateUniqueDraftReference } from '../src/modules/accounting/receivables/sales-invoices/sales-invoice.repository.js'

async function defaultLegalEntityId(tenantId: string): Promise<string | null> {
  const le = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return le?.id ?? null
}

async function migrateTenant(tenantId: string): Promise<number> {
  const legalEntityId = await defaultLegalEntityId(tenantId)
  if (!legalEntityId) {
    console.warn(`[skip] tenant ${tenantId}: no active legal entity`)
    return 0
  }

  const rows = await prisma.crmTaxInvoice.findMany({
    where: {
      tenantId,
      deletedAt: null,
      salesInvoiceId: null,
      status: { not: 'cancelled' },
    },
    include: { lines: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
  })

  let created = 0
  for (const cti of rows) {
    const existing = await prisma.salesInvoice.findFirst({
      where: { tenantId, legacyCrmTaxInvoiceId: cti.id },
      select: { id: true },
    })
    if (existing) continue

    const draftReference = await generateUniqueDraftReference(legalEntityId)
    const status = cti.status === 'draft' ? 'DRAFT' : 'READY_TO_POST'
    const supplyType = cti.gstScheme === 'igst' ? 'INTER_STATE' : 'INTRA_STATE'
    const calcLines = cti.lines.map((l) => ({
      lineNumber: l.lineNo,
      sourceLineId: l.sourceLineId,
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.description,
      description: l.description,
      hsnCode: l.hsnCode,
      uom: l.uom,
      quantity: l.qty.toString(),
      unitPrice: l.unitPrice.toString(),
      lineDiscountType: 'PERCENTAGE' as const,
      lineDiscountValue: l.discountPct.toString(),
      gstRate: l.taxPct.toString(),
      isTaxInclusive: false,
    }))
    const calculationContext = {
      taxPricingMode: 'EXCLUSIVE' as const,
      freightMode: 'NON_TAXABLE' as const,
      roundingMode: 'NONE' as const,
      lines: calcLines,
    }

    const header = await prisma.salesInvoice.create({
      data: {
        tenantId,
        legalEntityId,
        draftReference,
        status,
        customerId: cti.companyId,
        customerNameSnapshot: cti.customerNameSnapshot,
        customerGstinSnapshot: cti.customerGstin,
        customerStateCodeSnapshot: cti.customerState,
        sourceType: cti.salesOrderId ? 'SALES_ORDER' : cti.proformaInvoiceId ? 'PROFORMA_INVOICE' : 'DIRECT',
        sourceDocumentId: cti.salesOrderId ?? cti.proformaInvoiceId ?? null,
        invoiceDate: cti.invoiceDate,
        postingDate: cti.invoiceDate,
        dueDate: cti.dueDate,
        referenceNumber: cti.invoiceNo,
        customerPoNumber: cti.customerPoNumber,
        placeOfSupply: cti.placeOfSupply,
        supplyType,
        taxTreatment: cti.customerGstin ? 'REGISTERED' : 'UNREGISTERED',
        calculationContext,
        taxableAmount: cti.taxableAmount,
        cgstAmount: cti.cgstAmount,
        sgstAmount: cti.sgstAmount,
        igstAmount: cti.igstAmount,
        totalTaxAmount: cti.totalTaxAmount,
        totalAmount: cti.grandTotal,
        baseTaxableAmount: cti.taxableAmount,
        baseCgstAmount: cti.cgstAmount,
        baseSgstAmount: cti.sgstAmount,
        baseIgstAmount: cti.igstAmount,
        baseTotalTaxAmount: cti.totalTaxAmount,
        baseTotalAmount: cti.grandTotal,
        narration: cti.remarks,
        quotationId: cti.quotationId,
        quotationNo: cti.quotationNo,
        proformaInvoiceId: cti.proformaInvoiceId,
        proformaNo: cti.proformaNo,
        salesOrderId: cti.salesOrderId,
        salesOrderNo: cti.salesOrderNo,
        deliveryTerms: cti.deliveryTerms,
        paymentTerms: cti.paymentTerms,
        legacyCrmTaxInvoiceId: cti.id,
        legacyCrmInvoiceNo: cti.invoiceNo,
        createdChannel: 'CRM',
        commercialMetadata: {
          migratedFromCrmTaxInvoice: true,
          billingAddress: cti.billingAddress,
          shippingAddress: cti.shippingAddress,
          createdByNameSnapshot: cti.createdByNameSnapshot,
        },
        createdBy: cti.createdBy,
        updatedBy: cti.updatedBy,
      },
    })

    if (cti.lines.length) {
      await prisma.salesInvoiceLine.createMany({
        data: cti.lines.map((l) => ({
          tenantId,
          legalEntityId,
          salesInvoiceId: header.id,
          lineNumber: l.lineNo,
          sourceLineId: l.sourceLineId,
          itemId: l.itemId,
          itemCodeSnapshot: l.itemCode,
          itemNameSnapshot: l.description,
          hsnCodeSnapshot: l.hsnCode,
          uomSnapshot: l.uom,
          description: l.description,
          quantity: l.qty,
          unitRate: l.unitPrice,
          discountPercent: l.discountPct,
          discountAmount: new Prisma.Decimal(0),
          taxableAmount: l.taxableValue,
          cgstRate: cti.gstScheme === 'igst' ? new Prisma.Decimal(0) : l.taxPct.div(2),
          cgstAmount: cti.gstScheme === 'igst' ? new Prisma.Decimal(0) : l.gstAmount.div(2),
          sgstRate: cti.gstScheme === 'igst' ? new Prisma.Decimal(0) : l.taxPct.div(2),
          sgstAmount: cti.gstScheme === 'igst' ? new Prisma.Decimal(0) : l.gstAmount.div(2),
          igstRate: cti.gstScheme === 'igst' ? l.taxPct : new Prisma.Decimal(0),
          igstAmount: cti.gstScheme === 'igst' ? l.gstAmount : new Prisma.Decimal(0),
          lineTotal: l.lineTotal,
        })),
      })
    }

    await prisma.crmTaxInvoice.update({
      where: { id: cti.id },
      data: {
        salesInvoiceId: header.id,
        salesInvoiceNumber: draftReference,
        accountingStatus: 'converted',
        accountingConvertedAt: new Date(),
      },
    })

    created += 1
    console.log(`  + ${cti.invoiceNo} → SI ${header.id} (${status})`)
  }
  return created
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } })
  let total = 0
  for (const t of tenants) {
    console.log(`Tenant ${t.slug} (${t.id})`)
    total += await migrateTenant(t.id)
  }
  console.log(`Done. Created ${total} SalesInvoice row(s) from CRM-only tax invoices.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
