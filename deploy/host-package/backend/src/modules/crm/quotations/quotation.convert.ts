import type { CrmQuotation, CrmQuotationDocument } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import { findWonStage } from '../opportunities/opportunity.repository.js'
import { includeRelations } from './quotation.repository.js'
import { calcDocumentTotal, syncLineTotals } from './quotation.workflow.js'
import type { ConvertQuotationToSalesOrderInput } from '../sales-orders/sales-order.validation.js'
import type { QuotationPriceLineDto, QuotationSectionDto } from './quotation.types.js'
import type { SalesOrderLineDto } from '../sales-orders/sales-order.types.js'

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(value)
}

function sectionContent(sections: unknown, sectionType: string): string {
  const list = Array.isArray(sections) ? (sections as QuotationSectionDto[]) : []
  return list.find((s) => s.sectionType === sectionType)?.content?.trim() ?? ''
}

function formatAddress(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p?.trim()).join(', ')
}

function buildSoLines(
  priceLines: QuotationPriceLineDto[],
  freightAmount: number,
  installationAmount: number,
  customCharges: number,
): { lines: SalesOrderLineDto[]; summary: { taxableValue: number; gstAmount: number; grandTotal: number } } {
  const synced = syncLineTotals(priceLines.filter((l) => !l.isOptional))
  let lineNo = 0
  const lines: SalesOrderLineDto[] = synced.map((line) => {
    lineNo += 1
    const discountPct = line.discountPct ?? 0
    const taxPct = line.taxPct ?? 0
    const taxableValue = line.qty * line.unitPrice * (1 - discountPct / 100)
    const gstAmount = taxableValue * (taxPct / 100)
    const lineTotal = taxableValue + gstAmount
    return {
      id: line.id ?? crypto.randomUUID(),
      lineNo,
      productOrItem: line.productOrItem,
      description: line.description ?? '',
      productId: line.productId ?? null,
      qty: line.qty,
      uom: line.uom ?? 'NOS',
      unitPrice: line.unitPrice,
      discountPct,
      taxPct,
      taxableValue: Math.round(taxableValue * 100) / 100,
      gstAmount: Math.round(gstAmount * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
    }
  })

  const taxableValue = lines.reduce((s, l) => s + l.taxableValue, 0)
  const gstAmount = lines.reduce((s, l) => s + l.gstAmount, 0)
  const grandTotal = calcDocumentTotal(lines, freightAmount, installationAmount, customCharges)

  return {
    lines,
    summary: {
      taxableValue: Math.round(taxableValue * 100) / 100,
      gstAmount: Math.round(gstAmount * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
    },
  }
}

function assertConvertible(quotation: CrmQuotation, doc: CrmQuotationDocument, latestDoc: CrmQuotationDocument | null): void {
  if (quotation.salesOrderId) {
    throw new InvalidStateError('Sales order already created for this quotation')
  }
  if (doc.salesOrderId) {
    throw new InvalidStateError('Quotation document is already converted to a sales order')
  }
  if (doc.status !== 'approved') {
    throw new InvalidStateError(`Quotation document must be approved — current status is ${doc.status}`)
  }
  if (quotation.status !== 'approved') {
    throw new InvalidStateError(`Quotation must be approved — current status is ${quotation.status}`)
  }
  if (quotation.customerApproval !== 'approved') {
    throw new InvalidStateError('Customer approval is required before sales order conversion')
  }
  if (latestDoc && latestDoc.id !== doc.id) {
    throw new InvalidStateError('Only the latest approved quotation revision can be converted to a sales order')
  }
  if (quotation.validityDate && quotation.validityDate < new Date(new Date().toISOString().slice(0, 10))) {
    throw new ValidationError('Quotation validity has expired')
  }
  const history = Array.isArray(doc.approvalHistory) ? doc.approvalHistory : []
  if (!history.some((e) => (e as { action?: string }).action === 'approved')) {
    throw new ValidationError('Quotation approval must be completed')
  }
}

export async function convertQuotationToSalesOrder(
  tenantId: string,
  quotationId: string,
  userId: string,
  input: ConvertQuotationToSalesOrderInput,
) {
  const quotation = await prisma.crmQuotation.findFirst({
    where: { id: quotationId, tenantId, deletedAt: null },
    include: {
      documents: { where: { deletedAt: null }, orderBy: { revisionNo: 'desc' } },
      opportunity: { select: { id: true, pipelineId: true } },
    },
  })
  if (!quotation) {
    const { NotFoundError } = await import('../../../utils/errors.js')
    throw new NotFoundError('Quotation not found')
  }

  const latestDoc = quotation.documents[0] ?? null
  const doc = input.documentId
    ? quotation.documents.find((d) => d.id === input.documentId)
    : latestDoc
  if (!doc) {
    throw new ValidationError('Quotation document not found')
  }

  assertConvertible(quotation, doc, latestDoc)

  const priceLines = Array.isArray(doc.priceLines) ? (doc.priceLines as unknown as QuotationPriceLineDto[]) : []
  const activeLines = priceLines.filter((l) => !l.isOptional)
  if (!activeLines.length) {
    throw new ValidationError('At least one product / price line is required')
  }
  for (const line of activeLines) {
    if (!line.qty || line.qty <= 0) {
      throw new ValidationError(`Quantity required for ${line.description || line.productOrItem || 'line item'}`)
    }
    if (!line.unitPrice || line.unitPrice <= 0) {
      throw new ValidationError(`Unit price required for ${line.description || line.productOrItem || 'line item'}`)
    }
  }

  const paymentTerms = sectionContent(doc.sections, 'payment') || quotation.paymentTerms?.trim()
  const deliveryTerms = sectionContent(doc.sections, 'delivery') || quotation.deliveryTerms?.trim()
  if (!paymentTerms) throw new ValidationError('Payment terms are required')
  if (!deliveryTerms) throw new ValidationError('Delivery terms are required')
  if (!quotation.validityDate) throw new ValidationError('Quotation validity date is required')

  const company = await prisma.crmCompany.findFirst({
    where: { id: quotation.companyId, tenantId, deletedAt: null },
  })
  if (!company) throw new ValidationError('Customer not found')
  if (!company.addressLine1?.trim()) throw new ValidationError('Customer billing address is required')

  const contactId = doc.contactId
  if (!contactId && !company.contactPerson?.trim()) {
    throw new ValidationError('Contact person is required')
  }

  const freightAmount = Number(doc.freightAmount)
  const installationAmount = Number(doc.installationAmount)
  const customCharges = Number(doc.customCharges)
  const { lines, summary } = buildSoLines(activeLines, freightAmount, installationAmount, customCharges)
  if (summary.grandTotal <= 0) throw new ValidationError('Grand total must be greater than zero')

  const primaryLine = lines[0]
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const expectedDeliveryDate = parseDate(input.expectedDeliveryDate) ?? quotation.validityDate
  const warrantyTerms = sectionContent(doc.sections, 'warranty') || null

  const { nextCode } = await import('../../../services/codeSeries.service.js')

  return prisma.$transaction(async (tx) => {
    const salesOrderNo = await nextCode(tenantId, 'SALES_ORDER', tx)
    const remarks = `${quotation.quotationCode} Rev ${quotation.revisionNo} — CRM doc Rev ${doc.revisionNo}`

    const salesOrder = await tx.crmSalesOrder.create({
      data: {
        tenantId,
        salesOrderNo,
        companyId: quotation.companyId,
        productId: primaryLine.productId ?? quotation.productId,
        qty: totalQty,
        status: 'open',
        source: 'quotation',
        orderDate: new Date(),
        requiredDate: expectedDeliveryDate,
        expectedDeliveryDate,
        remarks,
        quotationId: quotation.id,
        quotationNo: quotation.quotationCode,
        quotationRevisionNo: quotation.revisionNo,
        quotationDocumentId: doc.id,
        quotationDocumentRevisionNo: doc.revisionNo,
        opportunityId: doc.opportunityId ?? quotation.opportunityId,
        contactId: contactId ?? null,
        unitPrice: primaryLine.unitPrice,
        discountPct: primaryLine.discountPct,
        grandTotal: summary.grandTotal,
        basicAmount: summary.taxableValue,
        gstAmount: summary.gstAmount,
        paymentTerms,
        deliveryTerms,
        warrantyTerms,
        commercialNotes: doc.commercialNotes ?? (sectionContent(doc.sections, 'commercial') || null),
        technicalNotes: doc.technicalNotes ?? (sectionContent(doc.sections, 'technical') || null),
        customerCode: company.companyCode,
        customerPoNumber: input.customerPoNumber ?? null,
        customerPoDate: parseDate(input.customerPoDate),
        deliveryLocation: input.deliveryLocation ?? null,
        billingAddress: formatAddress([company.addressLine1, company.addressLine2, company.city, company.state, company.pincode, company.country]),
        shippingAddress: formatAddress([company.addressLine1, company.addressLine2, company.city, company.state, company.pincode, company.country]),
        salesOwnerId: doc.salesOwnerId ?? quotation.salesOwnerId,
        salesOwnerName: doc.salesOwnerName ?? quotation.salesOwnerName,
        internalRemarks: input.internalRemarks ?? null,
        locationId: input.locationId ?? doc.locationId ?? quotation.locationId,
        lines: lines as unknown as Prisma.InputJsonValue,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    await tx.crmQuotationDocument.update({
      where: { id: doc.id },
      data: {
        status: 'converted',
        locked: true,
        salesOrderId: salesOrder.id,
        salesOrderNo: salesOrder.salesOrderNo,
        updatedBy: userId,
      },
    })

    await tx.crmQuotation.update({
      where: { id: quotationId },
      data: {
        status: 'converted',
        locked: true,
        salesOrderId: salesOrder.id,
        salesOrderNo: salesOrder.salesOrderNo,
        updatedBy: userId,
      },
    })

    if (quotation.opportunityId && quotation.opportunity) {
      const wonStage = await findWonStage(tenantId, quotation.opportunity.pipelineId)
      if (wonStage) {
        await tx.crmOpportunity.update({
          where: { id: quotation.opportunityId, tenantId },
          data: {
            status: 'WON',
            stageId: wonStage.id,
            probability: 100,
            winReason: `Quotation ${quotation.quotationCode} converted to ${salesOrderNo}`,
            updatedBy: userId,
          },
        })
      }
    }

    const updated = await tx.crmQuotation.findUniqueOrThrow({
      where: { id: quotationId },
      include: includeRelations,
    })

    return { salesOrder, quotation: updated }
  })
}
