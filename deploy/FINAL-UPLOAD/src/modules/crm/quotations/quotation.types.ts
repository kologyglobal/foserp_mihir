export interface QuotationPricingDto {
  unitPrice: number
  discountPct: number
  subtotal: number
  gstPct: number
  gstAmount: number
  grandTotal: number
}

export interface QuotationChangeRecordDto {
  revisionNo: number
  changedAt: string
  changedByName: string
  summary: string
}

export interface QuotationPriceLineDto {
  id: string
  productOrItem: string
  description: string
  productId?: string | null
  qty: number
  uom: string
  unitPrice: number
  discountPct: number
  taxPct: number
  lineTotal: number
  isOptional: boolean
}

export interface QuotationSectionDto {
  id: string
  sectionType: string
  title: string
  content: string
  sequenceNo: number
  editable: boolean
  contentFormat?: string
  specRows?: unknown[]
  masterCode?: string | null
}

export interface QuotationApprovalEntryDto {
  id: string
  action: 'submitted' | 'approved' | 'rejected'
  byId: string
  byName: string
  at: string
  remarks: string | null
}

export interface QuotationDocumentDto {
  id: string
  quotationId: string
  revisionNo: number
  templateId: string | null
  opportunityId: string | null
  sections: QuotationSectionDto[]
  priceLines: QuotationPriceLineDto[]
  freightAmount: number
  installationAmount: number
  customCharges: number
  status: string
  totalAmount: number
  revisionReason: string | null
  locked: boolean
  approvalHistory: QuotationApprovalEntryDto[]
  contactId: string | null
  salesOwnerId: string | null
  salesOwnerName: string | null
  commercialNotes: string | null
  technicalNotes: string | null
  salesOrderId: string | null
  salesOrderNo: string | null
  locationId: string | null
  createdById: string
  createdByName: string
  createdAt: string
  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null
  approvedById: string | null
  approvedByName: string | null
  approvedAt: string | null
}

export interface QuotationDto {
  id: string
  quotationNo: string
  opportunityId: string | null
  opportunityNo: string | null
  customerId: string
  productId: string | null
  qty: number
  revisionNo: number
  rootQuotationId: string
  isLatestRevision: boolean
  locked: boolean
  status: string
  customerApproval: string
  customerApprovalAt: string | null
  customerApprovalBy: string | null
  customerRejectionReason: string | null
  terms: string
  paymentTerms: string
  deliveryTerms: string
  validityDate: string
  pricing: QuotationPricingDto
  changeHistory: QuotationChangeRecordDto[]
  salesOrderId: string | null
  salesOrderNo: string | null
  locationId: string | null
  salesOwnerId: string | null
  salesOwnerName: string | null
  createdById: string
  createdByName: string
  createdAt: string
  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null
  approvedById: string | null
  approvedByName: string | null
  approvedAt: string | null
  documents: QuotationDocumentDto[]
}

export function parsePricing(value: unknown): QuotationPricingDto {
  const p = (value && typeof value === 'object' ? value : {}) as Partial<QuotationPricingDto>
  return {
    unitPrice: p.unitPrice ?? 0,
    discountPct: p.discountPct ?? 0,
    subtotal: p.subtotal ?? 0,
    gstPct: p.gstPct ?? 18,
    gstAmount: p.gstAmount ?? 0,
    grandTotal: p.grandTotal ?? 0,
  }
}

export function computePricing(qty: number, unitPrice: number, discountPct: number, gstPct: number): QuotationPricingDto {
  const subtotal = qty * unitPrice * (1 - discountPct / 100)
  const gstAmount = subtotal * (gstPct / 100)
  return {
    unitPrice,
    discountPct,
    subtotal,
    gstPct,
    gstAmount,
    grandTotal: subtotal + gstAmount,
  }
}
