import type { CrmQuotation, CrmQuotationDocument } from '@prisma/client'
import { decimalToNumber, mapAuditFields, type AuditUserNames, toIso } from '../../../shared/index.js'
import type {
  QuotationApprovalEntryDto,
  QuotationChangeRecordDto,
  QuotationDocumentDto,
  QuotationDto,
  QuotationPriceLineDto,
  QuotationSectionDto,
} from './quotation.types.js'
import { parsePricing } from './quotation.types.js'

function parseJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function mapQuotationDocumentToDto(
  doc: CrmQuotationDocument,
  names?: AuditUserNames & { createdByName?: string },
): QuotationDocumentDto {
  return {
    id: doc.id,
    quotationId: doc.quotationId,
    revisionNo: doc.revisionNo,
    templateId: doc.templateId,
    opportunityId: doc.opportunityId,
    sections: parseJsonArray<QuotationSectionDto>(doc.sections),
    priceLines: parseJsonArray<QuotationPriceLineDto>(doc.priceLines),
    freightAmount: decimalToNumber(doc.freightAmount),
    installationAmount: decimalToNumber(doc.installationAmount),
    customCharges: decimalToNumber(doc.customCharges),
    status: doc.status,
    totalAmount: decimalToNumber(doc.totalAmount),
    revisionReason: doc.revisionReason,
    locked: doc.locked,
    approvalHistory: parseJsonArray<QuotationApprovalEntryDto>(doc.approvalHistory),
    contactId: doc.contactId,
    salesOwnerId: doc.salesOwnerId,
    salesOwnerName: doc.salesOwnerName,
    commercialNotes: doc.commercialNotes,
    technicalNotes: doc.technicalNotes,
    salesOrderId: doc.salesOrderId,
    salesOrderNo: doc.salesOrderNo,
    locationId: doc.locationId,
    createdById: doc.createdBy ?? '',
    createdByName: doc.createdByName ?? names?.createdByName ?? '',
    createdAt: doc.createdAt.toISOString(),
    modifiedById: doc.updatedBy,
    modifiedByName: names?.modifiedByName ?? null,
    modifiedAt: doc.updatedAt.toISOString(),
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  }
}

export function mapQuotationToDto(
  quotation: CrmQuotation & {
    documents?: CrmQuotationDocument[]
    opportunity?: { opportunityCode: string } | null
  },
  names?: AuditUserNames & { salesOwnerName?: string },
): QuotationDto {
  const documents = (quotation.documents ?? []).map((d) =>
    mapQuotationDocumentToDto(d, {
      createdByName: names?.createdByName,
      modifiedByName: names?.modifiedByName,
    }),
  )
  const pricing = parsePricing(quotation.pricing)
  return {
    id: quotation.id,
    quotationNo: quotation.quotationCode,
    opportunityId: quotation.opportunityId,
    opportunityNo: quotation.opportunity?.opportunityCode ?? null,
    customerId: quotation.companyId,
    productId: quotation.productId,
    qty: decimalToNumber(quotation.qty),
    revisionNo: quotation.revisionNo,
    rootQuotationId: quotation.id,
    isLatestRevision: true,
    locked: quotation.locked,
    status: quotation.status,
    customerApproval: quotation.customerApproval,
    customerApprovalAt: toIso(quotation.customerApprovalAt),
    customerApprovalBy: quotation.customerApprovalBy,
    customerRejectionReason: quotation.customerRejectionReason,
    terms: quotation.terms ?? '',
    paymentTerms: quotation.paymentTerms ?? '',
    deliveryTerms: quotation.deliveryTerms ?? '',
    validityDate: toIso(quotation.validityDate)?.slice(0, 10) ?? '',
    pricing,
    changeHistory: parseJsonArray<QuotationChangeRecordDto>(quotation.changeHistory),
    salesOrderId: quotation.salesOrderId,
    salesOrderNo: quotation.salesOrderNo,
    locationId: quotation.locationId,
    salesOwnerId: quotation.salesOwnerId,
    salesOwnerName: quotation.salesOwnerName ?? names?.salesOwnerName ?? '',
    ...mapAuditFields(quotation, names),
    documents,
  }
}
