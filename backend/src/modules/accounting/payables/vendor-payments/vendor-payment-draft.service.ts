import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { validateBranchOwnership } from '../../ledger/ledger.validators.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../../shared/finance.helpers.js'
import { resolvePeriodByDate } from '../../posting/posting-period.service.js'
import { calculateVendorPayment } from './calculation/vendor-payment-calculation.service.js'
import type {
  VendorPaymentCalculationConfiguration,
  VendorPaymentCalculationInput,
  VendorPaymentCalculationResult,
} from './calculation/vendor-payment-calculation.types.js'
import * as repo from './vendor-payment.repository.js'
import {
  VendorPaymentInactiveVendorError,
  VendorPaymentValidationFailedError,
  VendorPaymentVendorNotFoundError,
} from './vendor-payment.errors.js'
import type { CreateVendorPaymentInput, UpdateVendorPaymentInput } from './vendor-payment.schemas.js'
import type { VendorPaymentDraftHeaderInput, VendorPaymentWithLines } from './vendor-payment.types.js'
import { serializeVendorPayment } from './vendor-payment-read.service.js'

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
}

async function loadActiveVendor(tenantId: string, vendorId: string): Promise<ActiveVendor> {
  const vendor = await prisma.masterVendor.findFirst({ where: { id: vendorId, tenantId, deletedAt: null } })
  if (!vendor) throw new VendorPaymentVendorNotFoundError()
  if (vendor.status !== 'ACTIVE' || vendor.isBlocked) throw new VendorPaymentInactiveVendorError()
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
  }
}

async function audit(req: Request, tenantId: string, id: string, action: string, newValues?: unknown) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'finance',
    entity: 'vendor_payment',
    entityId: id,
    action,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

type DraftBody = Omit<CreateVendorPaymentInput, 'legalEntityId'>

/** Builds the Phase 4B2 calculation input from a create/update request body (or a re-parsed `calculationContext`). */
export function buildCalculationInputFromRequest(
  tenantId: string,
  legalEntityId: string,
  body: DraftBody,
): VendorPaymentCalculationInput {
  return {
    tenantId,
    legalEntityId,
    branchId: body.branchId ?? null,
    vendorId: body.vendorId,
    paymentPurpose: body.paymentPurpose,
    paymentMethod: body.paymentMethod,
    documentDate: body.documentDate,
    paymentDate: body.paymentDate,
    proposedPostingDate: body.proposedPostingDate ?? null,
    valueDate: body.valueDate ?? null,
    currencyCode: body.currencyCode,
    exchangeRate: body.exchangeRate,
    paymentAmount: body.paymentAmount,
    paymentAccountId: body.paymentAccountId ?? null,
    vendorPayableAccountId: body.vendorPayableAccountId ?? null,
    paymentReference: body.paymentReference ?? null,
    bankReference: body.bankReference ?? null,
    chequeNumber: body.chequeNumber ?? null,
    chequeDate: body.chequeDate ?? null,
    instrumentReference: body.instrumentReference ?? null,
    narration: body.narration ?? null,
    adjustments: body.adjustments ?? [],
    configuration: body.configuration as VendorPaymentCalculationConfiguration | undefined,
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

function buildHeaderInput(
  tenantId: string,
  legalEntityId: string,
  body: DraftBody,
  vendor: ActiveVendor,
  financialYearId: string,
  draftReference: string,
  approvalRequired: boolean,
  userId?: string | null,
): VendorPaymentDraftHeaderInput {
  return {
    tenantId,
    legalEntityId,
    branchId: body.branchId ?? null,
    vendorId: body.vendorId,
    financialYearId,
    draftReference,
    paymentPurpose: body.paymentPurpose,
    paymentMethod: body.paymentMethod,
    documentDate: parseDateOnly(body.documentDate),
    paymentDate: parseDateOnly(body.paymentDate),
    proposedPostingDate: body.proposedPostingDate ? parseDateOnly(body.proposedPostingDate) : null,
    valueDate: body.valueDate ? parseDateOnly(body.valueDate) : null,
    dueReferenceDate: body.dueReferenceDate ? parseDateOnly(body.dueReferenceDate) : null,
    currencyCode: body.currencyCode,
    exchangeRate: body.exchangeRate,
    vendorSnapshot: vendorSnapshot(vendor),
    paymentReference: body.paymentReference ?? null,
    bankReference: body.bankReference ?? null,
    chequeNumber: body.chequeNumber ?? null,
    chequeDate: body.chequeDate ? parseDateOnly(body.chequeDate) : null,
    instrumentReference: body.instrumentReference ?? null,
    narration: body.narration ?? null,
    approvalRequired,
    calculationContext: body as unknown as Prisma.InputJsonValue,
    userId: userId ?? null,
  }
}

export async function createVendorPaymentDraft(req: Request, tenantId: string, input: CreateVendorPaymentInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const branchCheck = await validateBranchOwnership(tenantId, input.legalEntityId, input.branchId)
  if (!branchCheck.valid) {
    throw new VendorPaymentValidationFailedError(
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }
  const vendor = await loadActiveVendor(tenantId, input.vendorId)
  const { financialYear } = await resolvePeriodByDate(tenantId, input.legalEntityId, input.documentDate)

  const calcInput = buildCalculationInputFromRequest(tenantId, input.legalEntityId, input)
  const result = await calculateVendorPayment(calcInput, {
    tenantId,
    legalEntityId: input.legalEntityId,
    userId: req.context?.userId,
  })

  const draftReference = await repo.generateUniqueVendorPaymentDraftReference(tenantId)
  const approvalRequired = input.approvalRequiredOverride ?? false
  const header = buildHeaderInput(
    tenantId,
    input.legalEntityId,
    input,
    vendor,
    financialYear.id,
    draftReference,
    approvalRequired,
    req.context?.userId,
  )

  const payment = await repo.createVendorPaymentDraft(header, result)
  await audit(req, tenantId, payment.id, 'VENDOR_PAYMENT_CREATED', { draftReference: payment.draftReference })
  return serializeVendorPayment(req, payment, result)
}

export async function updateVendorPaymentDraft(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateVendorPaymentInput,
) {
  const existing = await repo.findVendorPaymentWithLinesOrThrow(tenantId, id)
  await getLegalEntityOrThrow(tenantId, existing.legalEntityId)
  const branchCheck = await validateBranchOwnership(tenantId, existing.legalEntityId, input.branchId)
  if (!branchCheck.valid) {
    throw new VendorPaymentValidationFailedError(
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }
  const vendor = await loadActiveVendor(tenantId, input.vendorId)
  const { financialYear } = await resolvePeriodByDate(tenantId, existing.legalEntityId, input.documentDate)

  const calcInput = buildCalculationInputFromRequest(tenantId, existing.legalEntityId, input)
  const result = await calculateVendorPayment(calcInput, {
    tenantId,
    legalEntityId: existing.legalEntityId,
    userId: req.context?.userId,
  })

  const approvalRequired = input.approvalRequiredOverride ?? existing.approvalRequired
  const header = buildHeaderInput(
    tenantId,
    existing.legalEntityId,
    input,
    vendor,
    financialYear.id,
    existing.draftReference,
    approvalRequired,
    req.context?.userId,
  )

  const payment = await repo.replaceVendorPaymentDraft(tenantId, id, header, result, input.expectedUpdatedAt)
  await audit(req, tenantId, id, 'VENDOR_PAYMENT_UPDATED')
  return serializeVendorPayment(req, payment, result)
}

/** Re-runs the Phase 4B2 calculation engine from the stored `calculationContext`. */
export async function recalculateVendorPayment(
  tenantId: string,
  payment: VendorPaymentWithLines,
  userId?: string | null,
): Promise<VendorPaymentCalculationResult> {
  const context = payment.calculationContext as unknown as DraftBody
  const calcInput = buildCalculationInputFromRequest(tenantId, payment.legalEntityId, context)
  return calculateVendorPayment(calcInput, {
    tenantId,
    legalEntityId: payment.legalEntityId,
    userId,
  })
}

export async function validateVendorPayment(req: Request, tenantId: string, id: string) {
  const payment = await repo.findVendorPaymentWithLinesOrThrow(tenantId, id)
  const result = await recalculateVendorPayment(tenantId, payment, req.context?.userId)

  if (['DRAFT', 'READY_TO_POST', 'REJECTED', 'PENDING_APPROVAL'].includes(payment.status)) {
    await repo.persistCalculatedFields(tenantId, id, result, req.context?.userId)
  }

  await audit(req, tenantId, id, 'VENDOR_PAYMENT_VALIDATED', {
    isValid: result.validation.isValid,
    errorCount: result.validation.errors.length,
    warningCount: result.validation.warnings.length,
  })

  return {
    valid: result.validation.isValid,
    errors: result.validation.errors,
    warnings: result.validation.warnings,
    paymentPosition: result.paymentPosition,
    accountReadiness: result.accountReadiness,
    accountingPreview: result.accountingPreview,
    openItemPreview: result.openItemPreview,
    calculation: result,
  }
}
