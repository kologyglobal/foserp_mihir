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
    orderDiscountCalcType: (doc as { orderDiscountCalcType?: string }).orderDiscountCalcType ?? 'FLAT',
    orderDiscountValue: decimalToNumber((doc as { orderDiscountValue?: unknown }).orderDiscountValue ?? 0),
    orderDiscountAmount: decimalToNumber((doc as { orderDiscountAmount?: unknown }).orderDiscountAmount ?? 0),
    freightCalcType: (doc as { freightCalcType?: string }).freightCalcType ?? 'FLAT',
    freightValue: decimalToNumber((doc as { freightValue?: unknown }).freightValue ?? doc.freightAmount),
    freightIsTaxable: Boolean((doc as { freightIsTaxable?: boolean }).freightIsTaxable),
    freightTaxRate: decimalToNumber((doc as { freightTaxRate?: unknown }).freightTaxRate ?? 0),
    freightTaxAmount: decimalToNumber((doc as { freightTaxAmount?: unknown }).freightTaxAmount ?? 0),
    installationCalcType: (doc as { installationCalcType?: string }).installationCalcType ?? 'FLAT',
    installationValue: decimalToNumber(
      (doc as { installationValue?: unknown }).installationValue ?? doc.installationAmount,
    ),
    installationIsTaxable: Boolean((doc as { installationIsTaxable?: boolean }).installationIsTaxable),
    installationTaxRate: decimalToNumber((doc as { installationTaxRate?: unknown }).installationTaxRate ?? 0),
    installationTaxAmount: decimalToNumber((doc as { installationTaxAmount?: unknown }).installationTaxAmount ?? 0),
    customChargesCalcType: (doc as { customChargesCalcType?: string }).customChargesCalcType ?? 'FLAT',
    customChargesValue: decimalToNumber(
      (doc as { customChargesValue?: unknown }).customChargesValue ?? doc.customCharges,
    ),
    customChargesIsTaxable: Boolean((doc as { customChargesIsTaxable?: boolean }).customChargesIsTaxable),
    customChargesTaxRate: decimalToNumber((doc as { customChargesTaxRate?: unknown }).customChargesTaxRate ?? 0),
    customChargesTaxAmount: decimalToNumber((doc as { customChargesTaxAmount?: unknown }).customChargesTaxAmount ?? 0),
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
    company?: { id: string; name: string; companyCode?: string | null } | null
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
    customerName: quotation.company?.name?.trim() || null,
    customerCode: quotation.company?.companyCode?.trim() || null,
    itemId: quotation.itemId,
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
    deliveryTime: quotation.deliveryTime ?? '',
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
