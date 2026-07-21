import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { validateBranchOwnership } from '../../ledger/ledger.validators.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../../shared/finance.helpers.js'
import { resolvePeriodByDate } from '../../posting/posting-period.service.js'
import { calculateVendorInvoice } from './calculation/vendor-invoice-calculation.service.js'
import type { VendorInvoiceCalculationInput, VendorInvoiceCalculationResult } from './calculation/vendor-invoice-calculation.types.js'
import { normalizeSupplierInvoiceNumber } from './vendor-invoice-number-normalization.js'
import * as repo from './vendor-invoice.repository.js'
import {
  VendorInvoiceInactiveVendorError,
  VendorInvoiceValidationFailedError,
  VendorInvoiceVendorNotFoundError,
} from './vendor-invoice.errors.js'
import type { CreateVendorInvoiceInput, UpdateVendorInvoiceInput } from './vendor-invoice.schemas.js'
import type { CreateVendorInvoiceSourceLinkInput, VendorInvoiceDraftHeaderInput, VendorInvoiceWithLines } from './vendor-invoice.types.js'
import { serializeVendorInvoice } from './vendor-invoice-read.service.js'

interface ActiveVendor {
  id: string
  code: string
  name: string
  gstin: string | null
  pan: string | null
  state: string | null
  address: string | null
  address2: string | null
  city: string | null
  pincode: string | null
  country: string | null
  paymentTermsDays: number
}

async function loadActiveVendor(tenantId: string, vendorId: string): Promise<ActiveVendor> {
  const vendor = await prisma.masterVendor.findFirst({ where: { id: vendorId, tenantId, deletedAt: null } })
  if (!vendor) throw new VendorInvoiceVendorNotFoundError()
  if (vendor.status !== 'ACTIVE' || vendor.isBlocked) throw new VendorInvoiceInactiveVendorError()
  return {
    id: vendor.id,
    code: vendor.code,
    name: vendor.name,
    gstin: vendor.gstin || null,
    pan: vendor.pan,
    state: vendor.state || null,
    address: vendor.address,
    address2: vendor.address2,
    city: vendor.city,
    pincode: vendor.pincode,
    country: vendor.country,
    paymentTermsDays: vendor.paymentTermsDays,
  }
}

async function audit(req: Request, tenantId: string, id: string, action: string, newValues?: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'finance',
    entity: 'vendor_invoice',
    entityId: id,
    action,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

type DraftBody = Omit<CreateVendorInvoiceInput, 'legalEntityId'>

function mapSourceLinks(sourceLinks: DraftBody['sourceLinks']): CreateVendorInvoiceSourceLinkInput[] {
  return (sourceLinks ?? []).map((link) => ({
    sourceType: link.sourceType,
    sourceDocumentId: link.sourceDocumentId,
    sourceDocumentNumberSnapshot: link.sourceDocumentNumberSnapshot ?? null,
    sourceDocumentDateSnapshot: link.sourceDocumentDateSnapshot ? parseDateOnly(link.sourceDocumentDateSnapshot) : null,
    metadata: (link.metadata as Prisma.InputJsonValue | null) ?? null,
  }))
}

/** Builds the Phase 4A2 calculation input from a create/update request body (or a re-parsed `calculationContext`). */
export function buildCalculationInputFromRequest(
  legalEntityId: string,
  body: DraftBody,
  companyStateCode: string | null,
  vendorStateCode: string | null,
): VendorInvoiceCalculationInput {
  return {
    legalEntityId,
    companyStateCode: body.companyStateCode ?? companyStateCode,
    vendorId: body.vendorId,
    vendorStateCode: body.vendorStateCode ?? vendorStateCode,
    placeOfSupply: body.placeOfSupply ?? null,
    supplyType: body.supplyType,
    taxTreatment: body.taxTreatment,
    itcEligibility: body.itcEligibility,
    itcEligiblePercent: body.itcEligiblePercent,
    tdsRecognitionMode: body.tdsRecognitionMode,
    tdsSectionCode: body.tdsSectionCode,
    tdsRate: body.tdsRate,
    tdsBaseOverride: body.tdsBaseOverride,
    currencyCode: body.currencyCode,
    exchangeRate: body.exchangeRate,
    invoiceDiscountType: body.invoiceDiscountType,
    invoiceDiscountValue: body.invoiceDiscountValue,
    freightAmount: body.freightAmount,
    freightGstRate: body.freightGstRate,
    otherChargeAmount: body.otherChargeAmount,
    otherChargeGstRate: body.otherChargeGstRate,
    supplierInvoiceNumber: body.supplierInvoiceNumber,
    invoiceDate: body.documentDate,
    postingDate: body.postingDate,
    configuration: body.configuration,
    lines: body.lines,
  }
}

function vendorSnapshot(vendor: ActiveVendor) {
  return {
    vendorCodeSnapshot: vendor.code,
    vendorNameSnapshot: vendor.name,
    vendorGstinSnapshot: vendor.gstin,
    vendorPanSnapshot: vendor.pan,
    vendorStateCodeSnapshot: vendor.state,
    vendorAddressSnapshot: {
      line1: vendor.address,
      line2: vendor.address2,
      city: vendor.city,
      state: vendor.state,
      pincode: vendor.pincode,
      country: vendor.country,
    } as unknown as Prisma.InputJsonValue,
  }
}

async function buildHeaderInput(
  tenantId: string,
  legalEntityId: string,
  body: DraftBody,
  vendor: ActiveVendor,
  companyGstin: string | null,
  companyStateCode: string | null,
  financialYearId: string,
  draftReference: string,
  approvalRequired: boolean,
  userId?: string | null,
): Promise<VendorInvoiceDraftHeaderInput> {
  return {
    tenantId,
    legalEntityId,
    branchId: body.branchId ?? null,
    vendorId: body.vendorId,
    financialYearId,
    draftReference,
    supplierInvoiceNumber: body.supplierInvoiceNumber,
    supplierInvoiceNumberNormalized: normalizeSupplierInvoiceNumber(body.supplierInvoiceNumber),
    supplierInvoiceDate: parseDateOnly(body.supplierInvoiceDate),
    invoiceType: body.invoiceType,
    taxTreatment: body.taxTreatment,
    itcEligibility: body.itcEligibility ?? 'PENDING_REVIEW',
    tdsRecognitionMode: body.tdsRecognitionMode ?? 'NOT_APPLICABLE',
    documentDate: parseDateOnly(body.documentDate),
    postingDate: body.postingDate ? parseDateOnly(body.postingDate) : null,
    dueDate: body.dueDate ? parseDateOnly(body.dueDate) : null,
    currencyCode: body.currencyCode,
    exchangeRate: body.exchangeRate,
    vendorSnapshot: vendorSnapshot(vendor),
    companyGstinSnapshot: companyGstin,
    companyStateCodeSnapshot: companyStateCode,
    placeOfSupplyStateCode: body.placeOfSupply ?? vendor.state ?? null,
    paymentTermsDaysSnapshot: body.paymentTermsDays ?? vendor.paymentTermsDays ?? null,
    paymentTermsSnapshot: body.paymentTerms ?? null,
    approvalRequired,
    calculationContext: body as unknown as Prisma.InputJsonValue,
    userId: userId ?? null,
  }
}

export async function createVendorInvoiceDraft(req: Request, tenantId: string, input: CreateVendorInvoiceInput) {
  const legalEntity = await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const branchCheck = await validateBranchOwnership(tenantId, input.legalEntityId, input.branchId)
  if (!branchCheck.valid) {
    throw new VendorInvoiceValidationFailedError(
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }
  const vendor = await loadActiveVendor(tenantId, input.vendorId)
  const { financialYear } = await resolvePeriodByDate(tenantId, input.legalEntityId, input.documentDate)
  const draftReference = await repo.generateUniqueDraftReference(tenantId)

  const calcInput = buildCalculationInputFromRequest(input.legalEntityId, input, legalEntity.stateCode, vendor.state)
  const result = await calculateVendorInvoice(calcInput, { tenantId, legalEntityId: input.legalEntityId, userId: req.context?.userId })

  const approvalRequired = input.approvalRequiredOverride ?? false
  const header = await buildHeaderInput(
    tenantId,
    input.legalEntityId,
    input,
    vendor,
    legalEntity.gstin,
    legalEntity.stateCode,
    financialYear.id,
    draftReference,
    approvalRequired,
    req.context?.userId,
  )

  const invoice = await repo.createVendorInvoiceDraft(header, result, mapSourceLinks(input.sourceLinks))
  await audit(req, tenantId, invoice.id, 'VENDOR_INVOICE_CREATED', { draftReference: invoice.draftReference })
  return serializeVendorInvoice(req, invoice, result)
}

export async function updateVendorInvoiceDraft(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateVendorInvoiceInput,
) {
  const existing = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id)
  const legalEntity = await getLegalEntityOrThrow(tenantId, existing.legalEntityId)
  const branchCheck = await validateBranchOwnership(tenantId, existing.legalEntityId, input.branchId)
  if (!branchCheck.valid) {
    throw new VendorInvoiceValidationFailedError(
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }
  const vendor = await loadActiveVendor(tenantId, input.vendorId)
  const { financialYear } = await resolvePeriodByDate(tenantId, existing.legalEntityId, input.documentDate)

  const calcInput = buildCalculationInputFromRequest(existing.legalEntityId, input, legalEntity.stateCode, vendor.state)
  const result = await calculateVendorInvoice(calcInput, { tenantId, legalEntityId: existing.legalEntityId, userId: req.context?.userId })

  const approvalRequired = input.approvalRequiredOverride ?? existing.approvalRequired
  const header = await buildHeaderInput(
    tenantId,
    existing.legalEntityId,
    input,
    vendor,
    legalEntity.gstin,
    legalEntity.stateCode,
    financialYear.id,
    existing.draftReference,
    approvalRequired,
    req.context?.userId,
  )

  const invoice = await repo.replaceVendorInvoiceDraft(tenantId, id, header, result, mapSourceLinks(input.sourceLinks), input.expectedUpdatedAt)
  await audit(req, tenantId, id, 'VENDOR_INVOICE_UPDATED')
  return serializeVendorInvoice(req, invoice, result)
}

/** Re-runs the Phase 4A2 calculation engine from the stored `calculationContext` — used by validate/submit/mark-ready/approve. */
export async function recalculateVendorInvoice(
  tenantId: string,
  invoice: VendorInvoiceWithLines,
  userId?: string | null,
): Promise<VendorInvoiceCalculationResult> {
  const legalEntity = await getLegalEntityOrThrow(tenantId, invoice.legalEntityId)
  const vendor = await loadActiveVendor(tenantId, invoice.vendorId).catch(() => null)
  const context = invoice.calculationContext as unknown as DraftBody
  const calcInput = buildCalculationInputFromRequest(
    invoice.legalEntityId,
    context,
    legalEntity.stateCode,
    vendor?.state ?? invoice.vendorStateCodeSnapshot,
  )
  return calculateVendorInvoice(calcInput, { tenantId, legalEntityId: invoice.legalEntityId, vendorInvoiceId: invoice.id, userId })
}

export async function validateVendorInvoice(req: Request, tenantId: string, id: string) {
  const invoice = await repo.findVendorInvoiceWithLinesOrThrow(tenantId, id)
  const result = await recalculateVendorInvoice(tenantId, invoice, req.context?.userId)

  if (['DRAFT', 'READY_TO_POST', 'REJECTED', 'PENDING_APPROVAL'].includes(invoice.status)) {
    await repo.persistCalculatedFields(tenantId, id, result, req.context?.userId)
  }

  await audit(req, tenantId, id, 'VENDOR_INVOICE_VALIDATED', {
    isValid: result.validation.isValid,
    errorCount: result.validation.errors.length,
    warningCount: result.validation.warnings.length,
  })

  return {
    valid: result.validation.isValid,
    errors: result.validation.errors,
    warnings: result.validation.warnings,
    duplicateAssessment: result.duplicateAssessment,
    accountReadiness: result.accountReadiness,
    accountingPreview: result.accountingPreview,
    calculation: result,
  }
}
