import type { CrmQuotation, CrmQuotationDocument, CrmOpportunity } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { ConflictError, InvalidStateError, ValidationError } from '../../../utils/errors.js'
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

function todayDateOnly(): Date {
  return new Date(new Date().toISOString().slice(0, 10))
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

function alreadyConvertedConflict(
  salesOrderId: string | null | undefined,
  salesOrderNo: string | null | undefined,
): never {
  throw new ConflictError('Quotation already converted to a sales order', [
    { field: 'salesOrderId', message: salesOrderId ?? '' },
    { field: 'salesOrderNo', message: salesOrderNo ?? '' },
  ])
}

function assertConvertible(quotation: CrmQuotation, doc: CrmQuotationDocument, latestDoc: CrmQuotationDocument | null): void {
  if (quotation.salesOrderId || doc.salesOrderId || quotation.status === 'converted' || doc.status === 'converted') {
    alreadyConvertedConflict(
      quotation.salesOrderId ?? doc.salesOrderId,
      quotation.salesOrderNo ?? doc.salesOrderNo,
    )
  }
  // Default company config: require approved (no Sent shortcut). Accepted = approved + customerApproval.
  if (doc.status !== 'approved') {
    throw new InvalidStateError(`Quotation document must be approved — current status is ${doc.status}`)
  }
  if (quotation.status !== 'approved') {
    throw new InvalidStateError(`Quotation must be approved — current status is ${quotation.status}`)
  }
  if (quotation.customerApproval !== 'approved') {
    throw new InvalidStateError('Approve the quotation before creating a sales order')
  }
  if (latestDoc && latestDoc.id !== doc.id) {
    throw new InvalidStateError('Only the latest approved quotation revision can be converted to a sales order')
  }
  if (quotation.validityDate && quotation.validityDate < todayDateOnly()) {
    throw new ValidationError('Quotation validity has expired')
  }
  const history = Array.isArray(doc.approvalHistory) ? doc.approvalHistory : []
  if (!history.some((e) => (e as { action?: string }).action === 'approved')) {
    throw new ValidationError('Quotation approval must be completed')
  }
}

async function assertOpportunityConvertible(
  tenantId: string,
  opportunityId: string | null | undefined,
): Promise<CrmOpportunity> {
  if (!opportunityId) {
    throw new ValidationError('Link this quotation to an opportunity before creating a sales order')
  }
  const opportunity = await prisma.crmOpportunity.findFirst({
    where: { id: opportunityId, tenantId, deletedAt: null },
  })
  if (!opportunity) throw new ValidationError('Opportunity not found')
  if (opportunity.status === 'LOST') {
    throw new InvalidStateError('Cannot convert quotation — opportunity is Lost')
  }
  if (opportunity.status === 'ARCHIVED') {
    throw new InvalidStateError('Cannot convert quotation — opportunity is Cancelled/Archived')
  }
  return opportunity
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

  const opportunity = await assertOpportunityConvertible(
    tenantId,
    doc.opportunityId ?? quotation.opportunityId,
  )

  const priceLines = Array.isArray(doc.priceLines) ? (doc.priceLines as unknown as QuotationPriceLineDto[]) : []
  const activeLines = priceLines.filter((l) => !l.isOptional)
  if (!activeLines.length) {
    throw new ValidationError('At least one product / price line is required')
  }
  for (const line of activeLines) {
    if (!line.qty || line.qty <= 0) {
      throw new ValidationError(`Quantity required for ${line.description || line.productOrItem || 'line item'}`)
    }
    if (!line.uom?.trim()) {
      throw new ValidationError(`UOM required for ${line.description || line.productOrItem || 'line item'}`)
    }
    if (line.unitPrice == null || line.unitPrice <= 0) {
      throw new ValidationError(`Unit price required for ${line.description || line.productOrItem || 'line item'}`)
    }
    if (line.taxPct == null || line.taxPct < 0) {
      throw new ValidationError(`Tax % required for ${line.description || line.productOrItem || 'line item'}`)
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
  if (!company.isActive || company.status === 'inactive') {
    throw new ValidationError('Customer is inactive — cannot convert quotation')
  }
  if (!company.addressLine1?.trim()) throw new ValidationError('Customer billing address is required')

  const contactId = doc.contactId
  if (!contactId && !company.contactPerson?.trim()) {
    throw new ValidationError('Contact person is required')
  }

  const freightAmount = Number(doc.freightAmount)
  const installationAmount = Number(doc.installationAmount)
  const customCharges = Number(doc.customCharges)
  // Server-side totals only — never trust FE totals.
  const { lines, summary } = buildSoLines(activeLines, freightAmount, installationAmount, customCharges)
  if (summary.grandTotal <= 0) throw new ValidationError('Grand total must be greater than zero')

  const primaryLine = lines[0]
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const expectedDeliveryDate = parseDate(input.expectedDeliveryDate) ?? quotation.validityDate
  const warrantyTerms = sectionContent(doc.sections, 'warranty') || null
  const opportunityId = opportunity.id

  const { nextCode } = await import('../../../services/codeSeries.service.js')

  try {
    return await prisma.$transaction(async (tx) => {
      // Re-check inside transaction for double-submit races.
      const fresh = await tx.crmQuotation.findFirst({
        where: { id: quotationId, tenantId, deletedAt: null },
        select: { salesOrderId: true, salesOrderNo: true, status: true },
      })
      if (fresh?.salesOrderId || fresh?.status === 'converted') {
        alreadyConvertedConflict(fresh.salesOrderId, fresh.salesOrderNo)
      }

      const salesOrderNo = await nextCode(tenantId, 'SALES_ORDER', tx)
      const remarks = `${quotation.quotationCode} Rev ${quotation.revisionNo} — CRM doc Rev ${doc.revisionNo}`
      const now = new Date()

      const salesOrder = await tx.crmSalesOrder.create({
        data: {
          tenantId,
          salesOrderNo,
          companyId: quotation.companyId,
          productId: primaryLine.productId ?? quotation.productId,
          qty: totalQty,
          status: 'open',
          source: 'quotation',
          orderDate: now,
          requiredDate: expectedDeliveryDate,
          expectedDeliveryDate,
          remarks,
          quotationId: quotation.id,
          quotationNo: quotation.quotationCode,
          quotationRevisionNo: quotation.revisionNo,
          quotationDocumentId: doc.id,
          quotationDocumentRevisionNo: doc.revisionNo,
          opportunityId,
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
          billingAddress: formatAddress([
            company.addressLine1,
            company.addressLine2,
            company.city,
            company.state,
            company.pincode,
            company.country,
          ]),
          shippingAddress: formatAddress([
            company.addressLine1,
            company.addressLine2,
            company.city,
            company.state,
            company.pincode,
            company.country,
          ]),
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

      // Supersede older active revisions of this quotation.
      await tx.crmQuotationDocument.updateMany({
        where: {
          tenantId,
          quotationId,
          deletedAt: null,
          id: { not: doc.id },
          status: { notIn: ['converted', 'superseded', 'rejected'] },
        },
        data: {
          status: 'superseded',
          locked: true,
          updatedBy: userId,
        },
      })

      const changeHistory = Array.isArray(quotation.changeHistory)
        ? [...(quotation.changeHistory as object[])]
        : []
      changeHistory.push({
        action: 'converted',
        revisionNo: quotation.revisionNo,
        changedAt: now.toISOString(),
        changedBy: userId,
        convertedAt: now.toISOString(),
        convertedBy: userId,
        salesOrderId: salesOrder.id,
        salesOrderNo: salesOrder.salesOrderNo,
        summary: `Converted to Sales Order ${salesOrder.salesOrderNo}`,
      })

      await tx.crmQuotation.update({
        where: { id: quotationId },
        data: {
          status: 'converted',
          locked: true,
          salesOrderId: salesOrder.id,
          salesOrderNo: salesOrder.salesOrderNo,
          changeHistory: changeHistory as unknown as Prisma.InputJsonValue,
          updatedBy: userId,
        },
      })

      const winReason = `Quotation ${quotation.quotationCode} converted to ${salesOrderNo}`
      const alreadyWon = opportunity.status === 'WON'
      const wonStage = await findWonStage(tenantId, opportunity.pipelineId)

      if (!alreadyWon) {
        if (!wonStage) {
          throw new InvalidStateError('No won stage configured in pipeline')
        }
        await tx.crmOpportunity.update({
          where: { id: opportunityId, tenantId },
          data: {
            status: 'WON',
            stageId: wonStage.id,
            probability: 100,
            amount: summary.grandTotal,
            // Use expectedCloseDate as close date (schema has no actualCloseDate).
            expectedCloseDate: opportunity.expectedCloseDate ?? todayDateOnly(),
            winReason,
            updatedBy: userId,
            lastActivityAt: now,
          },
        })
        await tx.crmOpportunityStatusHistory.create({
          data: {
            tenantId,
            opportunityId,
            fromStatus: opportunity.status,
            toStatus: 'WON',
            changedBy: userId,
            reason: winReason,
          },
        })
        await tx.crmOpportunityStageHistory.create({
          data: {
            tenantId,
            opportunityId,
            fromStageId: opportunity.stageId,
            toStageId: wonStage.id,
            changedBy: userId,
            reason: winReason,
          },
        })
        const fromStage = opportunity.stageId
          ? await tx.crmPipelineStage.findFirst({
              where: { id: opportunity.stageId, tenantId },
              select: { name: true },
            })
          : null
        await tx.crmActivity.create({
          data: {
            tenantId,
            activityType: 'STAGE_CHANGE',
            subject: `Deal won: ${fromStage?.name ?? '—'} → ${wonStage.name}`,
            description: winReason,
            companyId: opportunity.companyId,
            contactId: opportunity.contactId,
            leadId: opportunity.leadId,
            opportunityId,
            assignedTo: userId,
            scheduledAt: now,
            completedAt: now,
            status: 'COMPLETED',
            outcome: 'Won via quotation conversion',
            createdBy: userId,
            updatedBy: userId,
          },
        })
      } else {
        // Already Won: link SO value, preserve original close date, no duplicate Won activity.
        await tx.crmOpportunity.update({
          where: { id: opportunityId, tenantId },
          data: {
            amount: summary.grandTotal,
            probability: 100,
            updatedBy: userId,
            lastActivityAt: now,
          },
        })
        await tx.crmActivity.create({
          data: {
            tenantId,
            activityType: 'NOTE',
            subject: `Sales order ${salesOrderNo} linked`,
            description: `Quotation ${quotation.quotationCode} converted to ${salesOrderNo} (opportunity was already Won).`,
            companyId: opportunity.companyId,
            contactId: opportunity.contactId,
            leadId: opportunity.leadId,
            opportunityId,
            assignedTo: userId,
            scheduledAt: now,
            completedAt: now,
            status: 'COMPLETED',
            outcome: 'SO linked from quotation',
            createdBy: userId,
            updatedBy: userId,
          },
        })
      }

      const updated = await tx.crmQuotation.findUniqueOrThrow({
        where: { id: quotationId },
        include: includeRelations,
      })

      return { salesOrder, quotation: updated }
    })
  } catch (err) {
    if (err instanceof ConflictError || err instanceof InvalidStateError || err instanceof ValidationError) {
      throw err
    }
    // Unique race on code series or concurrent convert — re-read and surface 409 when already linked.
    const again = await prisma.crmQuotation.findFirst({
      where: { id: quotationId, tenantId, deletedAt: null },
      select: { salesOrderId: true, salesOrderNo: true, status: true },
    })
    if (again?.salesOrderId || again?.status === 'converted') {
      alreadyConvertedConflict(again.salesOrderId, again.salesOrderNo)
    }
    throw err
  }
}
