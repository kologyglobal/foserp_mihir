import type {
  Prisma,
  VendorAdjustment,
  VendorAdjustmentItcTreatment,
  VendorAdjustmentLine,
  VendorAdjustmentReason,
  VendorAdjustmentSourceLink,
  VendorAdjustmentTaxEffect,
  VendorAdjustmentTdsTreatment,
  VendorAdjustmentType,
  VendorAdjustmentLineType,
  VendorAdjustmentSourceLinkType,
  VendorAdjustmentStatus,
  VendorInvoiceTaxTreatment,
} from '@prisma/client'

export type VendorAdjustmentWithLines = VendorAdjustment & {
  lines: VendorAdjustmentLine[]
  sourceLinks?: VendorAdjustmentSourceLink[]
}

export interface CreateVendorAdjustmentRecordInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  financialYearId: string
  draftReference: string
  supplierReferenceNumber: string
  supplierReferenceNumberNormalized: string
  supplierReferenceUniquenessKey?: string | null
  supplierReferenceDate: Date
  adjustmentType: VendorAdjustmentType
  reason?: VendorAdjustmentReason
  status?: VendorAdjustmentStatus
  taxEffect?: VendorAdjustmentTaxEffect
  itcTreatment?: VendorAdjustmentItcTreatment
  tdsTreatment?: VendorAdjustmentTdsTreatment
  purchaseTaxTreatment?: VendorInvoiceTaxTreatment
  documentDate: Date
  dueDate?: Date | null
  currencyCode?: string
  exchangeRate?: Prisma.Decimal | number | string
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  vendorGstinSnapshot?: string | null
  vendorPanSnapshot?: string | null
  vendorStateCodeSnapshot?: string | null
  vendorAddressSnapshot?: Prisma.InputJsonValue | null
  companyGstinSnapshot?: string | null
  companyStateCodeSnapshot?: string | null
  placeOfSupplyStateCode?: string | null
  paymentTermsDaysSnapshot?: number | null
  paymentTermsSnapshot?: string | null
  createdBy?: string | null
}

export interface CreateVendorAdjustmentLineInput {
  lineNumber: number
  lineType: VendorAdjustmentLineType
  description: string
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  hsnSacCode?: string | null
  quantity?: Prisma.Decimal | number | string
  uomId?: string | null
  uomCodeSnapshot?: string | null
  unitPrice?: Prisma.Decimal | number | string
  grossAmount?: Prisma.Decimal | number | string
  discountPercent?: Prisma.Decimal | number | string
  discountAmount?: Prisma.Decimal | number | string
  taxableAmount?: Prisma.Decimal | number | string
  cgstRate?: Prisma.Decimal | number | string
  cgstAmount?: Prisma.Decimal | number | string
  sgstRate?: Prisma.Decimal | number | string
  sgstAmount?: Prisma.Decimal | number | string
  igstRate?: Prisma.Decimal | number | string
  igstAmount?: Prisma.Decimal | number | string
  cessRate?: Prisma.Decimal | number | string
  cessAmount?: Prisma.Decimal | number | string
  otherRecoverableTaxAmount?: Prisma.Decimal | number | string
  nonRecoverableTaxAmount?: Prisma.Decimal | number | string
  lineTotal?: Prisma.Decimal | number | string
  baseGrossAmount?: Prisma.Decimal | number | string
  baseDiscountAmount?: Prisma.Decimal | number | string
  baseTaxableAmount?: Prisma.Decimal | number | string
  baseCgstAmount?: Prisma.Decimal | number | string
  baseSgstAmount?: Prisma.Decimal | number | string
  baseIgstAmount?: Prisma.Decimal | number | string
  baseCessAmount?: Prisma.Decimal | number | string
  baseOtherRecoverableTaxAmount?: Prisma.Decimal | number | string
  baseNonRecoverableTaxAmount?: Prisma.Decimal | number | string
  baseLineTotal?: Prisma.Decimal | number | string
  offsetAccountId?: string | null
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
  sourceLinkType?: VendorAdjustmentSourceLinkType | null
  sourceDocumentId?: string | null
  sourceDocumentNumber?: string | null
  sourceDocumentLineId?: string | null
}

export interface CreateVendorAdjustmentSourceLinkInput {
  sourceType: VendorAdjustmentSourceLinkType
  sourceDocumentId: string
  sourceDocumentNumberSnapshot?: string | null
  sourceDocumentDateSnapshot?: Date | null
  metadata?: Prisma.InputJsonValue | null
}

/**
 * Phase 4A3 — full header persistence for the draft workflow (create/replace). Distinct from
 * the narrower `CreateVendorAdjustmentRecordInput` (Phase 4A1 foundation) which does not carry
 * calculated totals, snapshots, or resolved GL accounts.
 */
export interface VendorAdjustmentVendorSnapshot {
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  vendorGstinSnapshot?: string | null
  vendorPanSnapshot?: string | null
  vendorStateCodeSnapshot?: string | null
  vendorAddressSnapshot?: Prisma.InputJsonValue | null
}

export interface VendorAdjustmentResolvedAccountIds {
  vendorPayableAccountId: string | null
  inputCgstAccountId: string | null
  inputSgstAccountId: string | null
  inputIgstAccountId: string | null
  inputCessAccountId: string | null
  otherRecoverableTaxAccountId: string | null
  nonRecoverableTaxAccountId: string | null
  tdsPayableAccountId: string | null
  roundOffAccountId: string | null
}

export interface VendorAdjustmentDraftHeaderInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  financialYearId: string
  draftReference: string
  supplierReferenceNumber: string
  supplierReferenceNumberNormalized: string
  supplierReferenceDate: Date
  adjustmentType: VendorAdjustmentType
  reason: VendorAdjustmentReason
  taxEffect: VendorAdjustmentTaxEffect
  itcTreatment: VendorAdjustmentItcTreatment
  tdsTreatment: VendorAdjustmentTdsTreatment
  purchaseTaxTreatment: VendorInvoiceTaxTreatment
  documentDate: Date
  postingDate?: Date | null
  dueDate?: Date | null
  currencyCode: string
  exchangeRate: Prisma.Decimal | number | string
  vendorSnapshot: VendorAdjustmentVendorSnapshot
  companyGstinSnapshot?: string | null
  companyStateCodeSnapshot?: string | null
  placeOfSupplyStateCode?: string | null
  paymentTermsDaysSnapshot?: number | null
  paymentTermsSnapshot?: string | null
  approvalRequired: boolean
  calculationContext: Prisma.InputJsonValue
  userId?: string | null
}

