import { Prisma, type VendorAdjustment } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { convertToBase, toDecimal } from '../../shared/finance-decimal.js'
import type { VendorAdjustmentCalculationResult } from './calculation/vendor-adjustment-calculation.types.js'
import {
  VendorAdjustmentDuplicateUniquenessKeyError,
  VendorAdjustmentEditNotAllowedError,
  VendorAdjustmentNotFoundError,
  VendorAdjustmentStaleVersionError,
} from './vendor-adjustment.errors.js'
import type {
  CreateVendorAdjustmentLineInput,
  CreateVendorAdjustmentRecordInput,
  CreateVendorAdjustmentSourceLinkInput,
  VendorAdjustmentDraftHeaderInput,
  VendorAdjustmentResolvedAccountIds,
  VendorAdjustmentWithLines,
} from './vendor-adjustment.types.js'
import { replaceVendorAdjustmentLines } from './vendor-adjustment-line.repository.js'
import { createVendorAdjustmentSourceLinks } from './vendor-adjustment-source-link.repository.js'
import type { ListVendorAdjustmentsQuery } from './vendor-adjustment.schemas.js'
import { getPagination } from '../../../../utils/pagination.js'
import { parseDateOnly } from '../../shared/finance.helpers.js'

const DRAFT_CHARS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function randomDraftSuffix(length = 6): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += DRAFT_CHARS[Math.floor(Math.random() * DRAFT_CHARS.length)]
  }
  return out
}

export function draftReferenceForDate(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '')
  return `VADJ-DRAFT-${ymd}-${randomDraftSuffix()}`
}

export async function generateUniqueDraftReference(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ref = draftReferenceForDate()
    const existing = await prisma.vendorAdjustment.findFirst({
      where: { tenantId, draftReference: ref },
      select: { id: true },
    })
    if (!existing) return ref
  }
  throw new Error('Could not generate unique vendor invoice draft reference')
}

export async function findVendorAdjustmentById(
  tenantId: string,
  legalEntityId: string,
  id: string,
): Promise<VendorAdjustmentWithLines | null> {
  return prisma.vendorAdjustment.findFirst({
    where: { id, tenantId, legalEntityId },
    include: { lines: { orderBy: { lineNumber: 'asc' } }, sourceLinks: true },
  })
}

export async function findVendorAdjustmentByDraftReference(
  tenantId: string,
  draftReference: string,
): Promise<VendorAdjustment | null> {
  return prisma.vendorAdjustment.findFirst({
    where: { tenantId, draftReference },
  })
}

export async function findVendorAdjustmentByInternalNumber(
  tenantId: string,
  legalEntityId: string,
  vendorAdjustmentNumber: string,
): Promise<VendorAdjustment | null> {
  return prisma.vendorAdjustment.findFirst({
    where: { tenantId, legalEntityId, vendorAdjustmentNumber },
  })
}

export async function findVendorAdjustmentBySupplierReference(
  tenantId: string,
  legalEntityId: string,
  vendorId: string,
  supplierReferenceNumberNormalized: string,
): Promise<VendorAdjustment[]> {
  return prisma.vendorAdjustment.findMany({
    where: {
      tenantId,
      legalEntityId,
      vendorId,
      supplierReferenceNumberNormalized,
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Narrow create for foundation / future services. Does not calculate, approve, or post.
 */
export async function createVendorAdjustmentRecord(
  input: CreateVendorAdjustmentRecordInput,
): Promise<VendorAdjustment> {
  await getLegalEntityOrThrow(input.tenantId, input.legalEntityId)

  try {
    return await prisma.vendorAdjustment.create({
      data: {
        tenantId: input.tenantId,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId ?? null,
        vendorId: input.vendorId,
        financialYearId: input.financialYearId,
        draftReference: input.draftReference,
        vendorAdjustmentNumber: null,
        supplierReferenceNumber: input.supplierReferenceNumber,
        supplierReferenceNumberNormalized: input.supplierReferenceNumberNormalized,
        supplierReferenceUniquenessKey: input.supplierReferenceUniquenessKey ?? null,
        supplierReferenceDate: input.supplierReferenceDate,
        adjustmentType: input.adjustmentType,
        reason: input.reason ?? 'OTHER',
        status: input.status ?? 'DRAFT',
        taxEffect: input.taxEffect ?? 'NONE',
        itcTreatment: input.itcTreatment ?? 'NO_ITC_CHANGE',
        tdsTreatment: input.tdsTreatment ?? 'NO_TDS_CHANGE',
        documentDate: input.documentDate,
        dueDate: input.dueDate ?? null,
        currencyCode: input.currencyCode ?? 'INR',
        exchangeRate: toDecimal(input.exchangeRate ?? 1),
        vendorCodeSnapshot: input.vendorCodeSnapshot,
        vendorNameSnapshot: input.vendorNameSnapshot,
        vendorGstinSnapshot: input.vendorGstinSnapshot ?? null,
        vendorPanSnapshot: input.vendorPanSnapshot ?? null,
        vendorStateCodeSnapshot: input.vendorStateCodeSnapshot ?? null,
        vendorAddressSnapshot: (input.vendorAddressSnapshot as Prisma.InputJsonValue | undefined) ?? undefined,
        companyGstinSnapshot: input.companyGstinSnapshot ?? null,
        companyStateCodeSnapshot: input.companyStateCodeSnapshot ?? null,
        placeOfSupplyStateCode: input.placeOfSupplyStateCode ?? null,
        accountingVoucherId: null,
        postingEventId: null,
        createdBy: input.createdBy ?? null,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new VendorAdjustmentDuplicateUniquenessKeyError()
    }
    throw err
  }
}

export async function requireVendorAdjustment(
  tenantId: string,
  legalEntityId: string,
  id: string,
): Promise<VendorAdjustmentWithLines> {
  const invoice = await findVendorAdjustmentById(tenantId, legalEntityId, id)
  if (!invoice) throw new VendorAdjustmentNotFoundError()
  return invoice
}

/**
 * Phase 4A3 — load an invoice by tenant + id only (no legalEntityId route param on the
 * `/payables/vendor-adjustments` HTTP surface).
 */
export async function findVendorAdjustmentWithLinesOrThrow(
  tenantId: string,
  id: string,
): Promise<VendorAdjustmentWithLines> {
  const invoice = await prisma.vendorAdjustment.findFirst({
    where: { id, tenantId },
    include: { lines: { orderBy: { lineNumber: 'asc' } }, sourceLinks: true },
  })
  if (!invoice) throw new VendorAdjustmentNotFoundError()
  return invoice
}

const ACCOUNT_COMPONENT_FIELD: Record<string, keyof VendorAdjustmentResolvedAccountIds> = {
  VENDOR_PAYABLE: 'vendorPayableAccountId',
  INPUT_CGST: 'inputCgstAccountId',
  INPUT_SGST: 'inputSgstAccountId',
  INPUT_IGST: 'inputIgstAccountId',
  INPUT_CESS: 'inputCessAccountId',
  TDS_PAYABLE: 'tdsPayableAccountId',
  ROUND_OFF: 'roundOffAccountId',
}

/** Resolved GL account ids from the calculation engine — only the header-level (non line-level) components apply. */
function resolveAccountIds(result: VendorAdjustmentCalculationResult): VendorAdjustmentResolvedAccountIds {
  const ids: VendorAdjustmentResolvedAccountIds = {
    vendorPayableAccountId: null,
    inputCgstAccountId: null,
    inputSgstAccountId: null,
    inputIgstAccountId: null,
    inputCessAccountId: null,
    otherRecoverableTaxAccountId: null,
    nonRecoverableTaxAccountId: null,
    tdsPayableAccountId: null,
    roundOffAccountId: null,
  }
  for (const entry of result.accountReadiness.resolvedAccounts) {
    const field = ACCOUNT_COMPONENT_FIELD[entry.component]
    if (field && entry.accountId) ids[field] = entry.accountId
  }
  return ids
}

/** Transaction-currency + base-currency header totals mapped from the calculation result. */
function headerAmountFields(result: VendorAdjustmentCalculationResult) {
  const t = result.totals
  const b = result.baseTotals
  return {
    grossAmount: toDecimal(t.grossAmount),
    discountAmount: toDecimal(t.discountAmount),
    taxableAmount: toDecimal(t.taxableAmount),
    inputCgstAmount: toDecimal(t.inputCgstAmount),
    inputSgstAmount: toDecimal(t.inputSgstAmount),
    inputIgstAmount: toDecimal(t.inputIgstAmount),
    inputCessAmount: toDecimal(t.inputCessAmount),
    otherRecoverableTaxAmount: toDecimal(t.otherRecoverableTaxAmount),
    nonRecoverableTaxAmount: toDecimal(t.nonRecoverableTaxAmount),
    freightAmount: toDecimal(t.freightAmount),
    otherChargeAmount: toDecimal(t.otherChargeAmount),
    roundOffAmount: toDecimal(t.roundOffAmount),
    adjustmentGrandTotal: toDecimal(t.adjustmentGrandTotal),
    tdsBaseAmount: toDecimal(t.tdsBaseAmount),
    tdsAmount: toDecimal(t.tdsAmount),
    vendorPayableAmount: toDecimal(t.vendorPayableAmount),
    baseGrossAmount: toDecimal(b.grossAmount),
    baseDiscountAmount: toDecimal(b.discountAmount),
    baseTaxableAmount: toDecimal(b.taxableAmount),
    baseInputCgstAmount: toDecimal(b.inputCgstAmount),
    baseInputSgstAmount: toDecimal(b.inputSgstAmount),
    baseInputIgstAmount: toDecimal(b.inputIgstAmount),
    baseInputCessAmount: toDecimal(b.inputCessAmount),
    baseOtherRecoverableTaxAmount: toDecimal(b.otherRecoverableTaxAmount),
    baseNonRecoverableTaxAmount: toDecimal(b.nonRecoverableTaxAmount),
    baseFreightAmount: toDecimal(b.freightAmount),
    baseOtherChargeAmount: toDecimal(b.otherChargeAmount),
    baseRoundOffAmount: toDecimal(b.roundOffAmount),
    baseAdjustmentGrandTotal: toDecimal(b.adjustmentGrandTotal),
    baseTdsBaseAmount: toDecimal(b.tdsBaseAmount),
    baseTdsAmount: toDecimal(b.tdsAmount),
    baseVendorPayableAmount: toDecimal(b.vendorPayableAmount),
  }
}

function lineCreateInputs(result: VendorAdjustmentCalculationResult, exchangeRate: Prisma.Decimal | number | string): CreateVendorAdjustmentLineInput[] {
  return result.lines.map((line) => ({
    lineNumber: line.lineNumber,
    lineType: line.lineType,
    description: line.description,
    itemId: line.itemId,
    itemCodeSnapshot: line.itemCodeSnapshot,
    itemNameSnapshot: line.itemNameSnapshot,
    hsnSacCode: line.hsnSacCode,
    quantity: toDecimal(line.quantity),
    uomId: line.uomId,
    uomCodeSnapshot: line.uomCodeSnapshot,
    unitPrice: toDecimal(line.unitPrice),
    grossAmount: toDecimal(line.grossAmount),
    discountPercent: toDecimal(line.discountPercent),
    discountAmount: toDecimal(line.discountAmount),
    taxableAmount: toDecimal(line.taxableAmount),
    cgstRate: toDecimal(line.cgstRate),
    cgstAmount: toDecimal(line.cgstAmount),
    sgstRate: toDecimal(line.sgstRate),
    sgstAmount: toDecimal(line.sgstAmount),
    igstRate: toDecimal(line.igstRate),
    igstAmount: toDecimal(line.igstAmount),
    cessRate: toDecimal(line.cessRate),
    cessAmount: toDecimal(line.cessAmount),
    otherRecoverableTaxAmount: toDecimal(line.recoverableTaxAmount),
    nonRecoverableTaxAmount: toDecimal(line.nonRecoverableTaxAmount),
    lineTotal: toDecimal(line.lineTotal),
    baseGrossAmount: convertToBase(line.grossAmount, exchangeRate),
    baseDiscountAmount: convertToBase(line.discountAmount, exchangeRate),
    baseTaxableAmount: convertToBase(line.taxableAmount, exchangeRate),
    baseCgstAmount: convertToBase(line.cgstAmount, exchangeRate),
    baseSgstAmount: convertToBase(line.sgstAmount, exchangeRate),
    baseIgstAmount: convertToBase(line.igstAmount, exchangeRate),
    baseCessAmount: convertToBase(line.cessAmount, exchangeRate),
    baseOtherRecoverableTaxAmount: convertToBase(line.recoverableTaxAmount, exchangeRate),
    baseNonRecoverableTaxAmount: convertToBase(line.nonRecoverableTaxAmount, exchangeRate),
    baseLineTotal: convertToBase(line.lineTotal, exchangeRate),
    offsetAccountId: line.offsetAccountId,
    costCentreId: line.costCentreId,
    projectReference: line.projectReference,
    departmentReference: line.departmentReference,
    sourceLinkType: line.sourceLinkType,
    sourceDocumentId: line.sourceDocumentId,
    sourceDocumentNumber: line.sourceDocumentNumber,
    sourceDocumentLineId: line.sourceDocumentLineId,
  }))
}

function headerCreateData(header: VendorAdjustmentDraftHeaderInput, result: VendorAdjustmentCalculationResult) {
  return {
    tenantId: header.tenantId,
    legalEntityId: header.legalEntityId,
    branchId: header.branchId ?? null,
    vendorId: header.vendorId,
    financialYearId: header.financialYearId,
    supplierReferenceNumber: header.supplierReferenceNumber,
    supplierReferenceNumberNormalized: header.supplierReferenceNumberNormalized,
    supplierReferenceDate: header.supplierReferenceDate,
    adjustmentType: header.adjustmentType,
    reason: header.reason,
    taxEffect: header.taxEffect,
    itcTreatment: header.itcTreatment,
    tdsTreatment: header.tdsTreatment,
    documentDate: header.documentDate,
    postingDate: header.postingDate ?? null,
    dueDate: header.dueDate ?? null,
    currencyCode: header.currencyCode,
    exchangeRate: toDecimal(header.exchangeRate),
    vendorCodeSnapshot: header.vendorSnapshot.vendorCodeSnapshot,
    vendorNameSnapshot: header.vendorSnapshot.vendorNameSnapshot,
    vendorGstinSnapshot: header.vendorSnapshot.vendorGstinSnapshot ?? null,
    vendorPanSnapshot: header.vendorSnapshot.vendorPanSnapshot ?? null,
    vendorStateCodeSnapshot: header.vendorSnapshot.vendorStateCodeSnapshot ?? null,
    vendorAddressSnapshot: (header.vendorSnapshot.vendorAddressSnapshot as Prisma.InputJsonValue | undefined) ?? undefined,
    companyGstinSnapshot: header.companyGstinSnapshot ?? null,
    companyStateCodeSnapshot: header.companyStateCodeSnapshot ?? null,
    placeOfSupplyStateCode: header.placeOfSupplyStateCode ?? null,
    approvalRequired: header.approvalRequired,
    calculationVersion: result.calculationVersion,
    calculationContext: header.calculationContext,
    calculationSnapshot: { ...result.snapshot, calculatedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue,
    accountingPreviewSnapshot: result.accountingPreview as unknown as Prisma.InputJsonValue,
    updatedBy: header.userId ?? null,
    ...headerAmountFields(result),
    ...resolveAccountIds(result),
  }
}

/**
 * Phase 4A3 — create a DRAFT vendor invoice with server-calculated totals, snapshots, and lines.
 * `supplierReferenceUniquenessKey` remains null until claimed by submit/mark-ready.
 */
export async function createVendorAdjustmentDraft(
  header: VendorAdjustmentDraftHeaderInput,
  result: VendorAdjustmentCalculationResult,
  sourceLinks: CreateVendorAdjustmentSourceLinkInput[],
): Promise<VendorAdjustmentWithLines> {
  await getLegalEntityOrThrow(header.tenantId, header.legalEntityId)

  const invoice = await prisma.vendorAdjustment.create({
    data: {
      ...headerCreateData(header, result),
      status: 'DRAFT',
      vendorAdjustmentNumber: null,
      supplierReferenceUniquenessKey: null,
      draftReference: header.draftReference,
      accountingVoucherId: null,
      postingEventId: null,
      createdBy: header.userId ?? null,
    },
  })

  await replaceVendorAdjustmentLines(header.tenantId, header.legalEntityId, invoice.id, lineCreateInputs(result, header.exchangeRate))
  if (sourceLinks.length > 0) {
    await createVendorAdjustmentSourceLinks(header.tenantId, header.legalEntityId, invoice.id, sourceLinks)
  }

  return findVendorAdjustmentWithLinesOrThrow(header.tenantId, invoice.id)
}

/**
 * Phase 4A3 — replace a DRAFT vendor invoice's header + lines + source links after recalculation.
 * Optimistic concurrency via `expectedUpdatedAt`; only DRAFT invoices are editable.
 */
export async function replaceVendorAdjustmentDraft(
  tenantId: string,
  id: string,
  header: VendorAdjustmentDraftHeaderInput,
  result: VendorAdjustmentCalculationResult,
  sourceLinks: CreateVendorAdjustmentSourceLinkInput[],
  expectedUpdatedAt: string,
): Promise<VendorAdjustmentWithLines> {
  const existing = await findVendorAdjustmentWithLinesOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') throw new VendorAdjustmentEditNotAllowedError()
  if (existing.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new VendorAdjustmentStaleVersionError()

  await prisma.$transaction(async (tx) => {
    await tx.vendorAdjustment.update({
      where: { id, tenantId },
      data: headerCreateData(header, result),
    })
    await tx.vendorAdjustmentSourceLink.deleteMany({ where: { tenantId, legalEntityId: existing.legalEntityId, vendorAdjustmentId: id } })
  })

  await replaceVendorAdjustmentLines(tenantId, existing.legalEntityId, id, lineCreateInputs(result, header.exchangeRate))
  if (sourceLinks.length > 0) {
    await createVendorAdjustmentSourceLinks(tenantId, existing.legalEntityId, id, sourceLinks)
  }

  return findVendorAdjustmentWithLinesOrThrow(tenantId, id)
}

/**
 * Phase 4A3 — refresh calculation snapshots (totals + resolved accounts + accounting preview)
 * without touching status, lines, or other header fields. Used by validate / revalidate flows.
 */
export async function persistCalculatedFields(
  tenantId: string,
  id: string,
  result: VendorAdjustmentCalculationResult,
  userId?: string | null,
): Promise<VendorAdjustment> {
  return prisma.vendorAdjustment.update({
    where: { id, tenantId },
    data: {
      ...headerAmountFields(result),
      ...resolveAccountIds(result),
      calculationVersion: result.calculationVersion,
      calculationSnapshot: { ...result.snapshot, calculatedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue,
      accountingPreviewSnapshot: result.accountingPreview as unknown as Prisma.InputJsonValue,
      updatedBy: userId ?? null,
    },
  })
}

/** Phase 4A3 — paginated list for the vendor-adjustment HTTP surface. */
export async function listVendorAdjustments(
  tenantId: string,
  query: ListVendorAdjustmentsQuery,
): Promise<{ items: VendorAdjustmentWithLines[]; total: number; page: number; limit: number }> {
  const { skip, take, page } = getPagination(query)
  const where: Prisma.VendorAdjustmentWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.adjustmentType ? { adjustmentType: query.adjustmentType } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          documentDate: {
            ...(query.dateFrom ? { gte: parseDateOnly(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: parseDateOnly(query.dateTo) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { draftReference: { contains: query.search } },
            { vendorAdjustmentNumber: { contains: query.search } },
            { supplierReferenceNumber: { contains: query.search } },
            { vendorNameSnapshot: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.vendorAdjustment.findMany({
      where,
      include: { lines: { orderBy: { lineNumber: 'asc' } }, sourceLinks: true },
      skip,
      take,
      orderBy: { createdAt: query.sortOrder },
    }),
    prisma.vendorAdjustment.count({ where }),
  ])
  return { items, total, page, limit: query.limit }
}

export interface FinalizePostedVendorAdjustmentInput {
  tenantId: string
  vendorAdjustmentId: string
  expectedUpdatedAt: string
  vendorAdjustmentNumber: string
  accountingVoucherId: string
  postingEventId: string
  postedById: string | null
  financialYearId: string
}

/**
 * Phase 4A4 — conditional READY_TO_POST → POSTED finalisation inside the posting transaction.
 * Requires null number/voucher/event links and matching optimistic updatedAt.
 */
export async function finalizePostedVendorAdjustment(
  tx: Prisma.TransactionClient,
  input: FinalizePostedVendorAdjustmentInput,
): Promise<{ count: number }> {
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt)
  return tx.vendorAdjustment.updateMany({
    where: {
      id: input.vendorAdjustmentId,
      tenantId: input.tenantId,
      status: 'READY_TO_POST',
      vendorAdjustmentNumber: null,
      accountingVoucherId: null,
      postingEventId: null,
      updatedAt: expectedUpdatedAt,
    },
    data: {
      status: 'POSTED',
      vendorAdjustmentNumber: input.vendorAdjustmentNumber,
      accountingVoucherId: input.accountingVoucherId,
      postingEventId: input.postingEventId,
      financialYearId: input.financialYearId,
      postedAt: new Date(),
      postedBy: input.postedById,
      updatedBy: input.postedById,
    },
  })
}

export interface CreateVendorAdjustmentPayableOpenItemInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  documentId: string
  documentNumber: string
  documentDate: Date
  postingDate: Date
  dueDate?: Date | null
  currencyCode: string
  exchangeRate: Prisma.Decimal | number | string
  originalAmount: Prisma.Decimal | number | string
  outstandingAmount: Prisma.Decimal | number | string
  baseOriginalAmount: Prisma.Decimal | number | string
  baseOutstandingAmount: Prisma.Decimal | number | string
  vendorPayableAccountId: string
  sourceVendorAdjustmentId: string
  side: 'DEBIT' | 'CREDIT'
  documentType: 'VENDOR_DEBIT_NOTE' | 'VENDOR_CREDIT_ADJUSTMENT'
  accountingVoucherId: string
  postingEventId: string
  createdBy?: string | null
}

/**
 * Phase 4A4 — create exactly one CREDIT VENDOR_ADJUSTMENT payable open item inside the posting tx.
 */
export async function createVendorAdjustmentPayableOpenItem(
  tx: Prisma.TransactionClient,
  input: CreateVendorAdjustmentPayableOpenItemInput,
) {
  try {
    return await tx.payableOpenItem.create({
      data: {
        tenantId: input.tenantId,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId ?? null,
        vendorId: input.vendorId,
        vendorCodeSnapshot: input.vendorCodeSnapshot,
        vendorNameSnapshot: input.vendorNameSnapshot,
        side: input.side,
        documentType: input.documentType,
        documentId: input.documentId,
        documentNumber: input.documentNumber,
        documentDate: input.documentDate,
        postingDate: input.postingDate,
        dueDate: input.dueDate ?? null,
        currencyCode: input.currencyCode,
        exchangeRate: toDecimal(input.exchangeRate),
        originalAmount: toDecimal(input.originalAmount),
        allocatedAmount: toDecimal(0),
        adjustedAmount: toDecimal(0),
        writtenOffAmount: toDecimal(0),
        outstandingAmount: toDecimal(input.outstandingAmount),
        baseOriginalAmount: toDecimal(input.baseOriginalAmount),
        baseAllocatedAmount: toDecimal(0),
        baseAdjustedAmount: toDecimal(0),
        baseWrittenOffAmount: toDecimal(0),
        baseOutstandingAmount: toDecimal(input.baseOutstandingAmount),
        status: 'OPEN',
        isDisputed: false,
        isOnHold: false,
        vendorPayableAccountId: input.vendorPayableAccountId,
        sourceVendorAdjustmentId: input.sourceVendorAdjustmentId,
        accountingVoucherId: input.accountingVoucherId,
        postingEventId: input.postingEventId,
        createdBy: input.createdBy ?? null,
        updatedBy: input.createdBy ?? null,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw err
    }
    throw err
  }
}
