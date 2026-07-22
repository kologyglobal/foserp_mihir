import type { Prisma, VendorInvoiceLine } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import { VendorInvoiceLineConflictError, VendorInvoiceNotFoundError } from './vendor-invoice.errors.js'
import type { CreateVendorInvoiceLineInput } from './vendor-invoice.types.js'

export async function listVendorInvoiceLines(
  tenantId: string,
  legalEntityId: string,
  vendorInvoiceId: string,
): Promise<VendorInvoiceLine[]> {
  return prisma.vendorInvoiceLine.findMany({
    where: { tenantId, legalEntityId, vendorInvoiceId },
    orderBy: { lineNumber: 'asc' },
  })
}

function mapLineCreateMany(
  tenantId: string,
  legalEntityId: string,
  vendorInvoiceId: string,
  lines: CreateVendorInvoiceLineInput[],
): Prisma.VendorInvoiceLineCreateManyInput[] {
  return lines.map((line) => ({
    tenantId,
    legalEntityId,
    vendorInvoiceId,
    lineNumber: line.lineNumber,
    lineType: line.lineType,
    itemId: line.itemId ?? null,
    itemCodeSnapshot: line.itemCodeSnapshot ?? null,
    itemNameSnapshot: line.itemNameSnapshot ?? null,
    description: line.description,
    hsnSacCode: line.hsnSacCode ?? null,
    quantity: toDecimal(line.quantity ?? 0),
    uomId: line.uomId ?? null,
    uomCodeSnapshot: line.uomCodeSnapshot ?? null,
    unitPrice: toDecimal(line.unitPrice ?? 0),
    grossAmount: toDecimal(line.grossAmount ?? 0),
    discountPercent: toDecimal(line.discountPercent ?? 0),
    discountAmount: toDecimal(line.discountAmount ?? 0),
    taxableAmount: toDecimal(line.taxableAmount ?? 0),
    cgstRate: toDecimal(line.cgstRate ?? 0),
    cgstAmount: toDecimal(line.cgstAmount ?? 0),
    sgstRate: toDecimal(line.sgstRate ?? 0),
    sgstAmount: toDecimal(line.sgstAmount ?? 0),
    igstRate: toDecimal(line.igstRate ?? 0),
    igstAmount: toDecimal(line.igstAmount ?? 0),
    cessRate: toDecimal(line.cessRate ?? 0),
    cessAmount: toDecimal(line.cessAmount ?? 0),
    otherRecoverableTaxAmount: toDecimal(line.otherRecoverableTaxAmount ?? 0),
    nonRecoverableTaxAmount: toDecimal(line.nonRecoverableTaxAmount ?? 0),
    lineTotal: toDecimal(line.lineTotal ?? 0),
    baseGrossAmount: toDecimal(line.baseGrossAmount ?? 0),
    baseDiscountAmount: toDecimal(line.baseDiscountAmount ?? 0),
    baseTaxableAmount: toDecimal(line.baseTaxableAmount ?? 0),
    baseCgstAmount: toDecimal(line.baseCgstAmount ?? 0),
    baseSgstAmount: toDecimal(line.baseSgstAmount ?? 0),
    baseIgstAmount: toDecimal(line.baseIgstAmount ?? 0),
    baseCessAmount: toDecimal(line.baseCessAmount ?? 0),
    baseOtherRecoverableTaxAmount: toDecimal(line.baseOtherRecoverableTaxAmount ?? 0),
    baseNonRecoverableTaxAmount: toDecimal(line.baseNonRecoverableTaxAmount ?? 0),
    baseLineTotal: toDecimal(line.baseLineTotal ?? 0),
    debitAccountId: line.debitAccountId ?? null,
    costCentreId: line.costCentreId ?? null,
    projectReference: line.projectReference ?? null,
    departmentReference: line.departmentReference ?? null,
    sourceLinkType: line.sourceLinkType ?? null,
    sourceDocumentId: line.sourceDocumentId ?? null,
    sourceDocumentNumber: line.sourceDocumentNumber ?? null,
    sourceDocumentLineId: line.sourceDocumentLineId ?? null,
    taxTreatment: line.taxTreatment ?? null,
    itcEligibility: line.itcEligibility ?? null,
  }))
}

/**
 * Replace all lines for an invoice. Narrow mutation for foundation / future draft services.
 * Does not recalculate header totals.
 */
export async function replaceVendorInvoiceLines(
  tenantId: string,
  legalEntityId: string,
  vendorInvoiceId: string,
  lines: CreateVendorInvoiceLineInput[],
): Promise<VendorInvoiceLine[]> {
  const header = await prisma.vendorInvoice.findFirst({
    where: { id: vendorInvoiceId, tenantId, legalEntityId },
    select: { id: true },
  })
  if (!header) throw new VendorInvoiceNotFoundError()

  const lineNumbers = lines.map((l) => l.lineNumber)
  if (new Set(lineNumbers).size !== lineNumbers.length) {
    throw new VendorInvoiceLineConflictError('Duplicate line numbers in replace payload')
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorInvoiceLine.deleteMany({ where: { vendorInvoiceId, tenantId, legalEntityId } })
    if (lines.length > 0) {
      await tx.vendorInvoiceLine.createMany({
        data: mapLineCreateMany(tenantId, legalEntityId, vendorInvoiceId, lines),
      })
    }
  })

  return listVendorInvoiceLines(tenantId, legalEntityId, vendorInvoiceId)
}
