import { Prisma, type VendorPayment } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../../shared/finance.helpers.js'
import { convertToBase, isPositive, sumDecimals, toDecimal } from '../../shared/finance-decimal.js'
import { getPagination } from '../../../../utils/pagination.js'
import type { VendorPaymentCalculationResult } from './calculation/vendor-payment-calculation.types.js'
import { replaceVendorPaymentAdjustmentLines } from './vendor-payment-adjustment.repository.js'
import {
  VendorPaymentDuplicateDraftReferenceError,
  VendorPaymentEditNotAllowedError,
  VendorPaymentNotFoundError,
  VendorPaymentStaleVersionError,
} from './vendor-payment.errors.js'
import type {
  CreateVendorPaymentAdjustmentLineInput,
  CreateVendorPaymentRecordInput,
  VendorPaymentDraftHeaderInput,
  VendorPaymentResolvedAccountIds,
  VendorPaymentWithLines,
} from './vendor-payment.types.js'
import type { ListVendorPaymentsQuery } from './vendor-payment.schemas.js'

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
  return `VPAY-DRAFT-${ymd}-${randomDraftSuffix()}`
}

export async function generateUniqueVendorPaymentDraftReference(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ref = draftReferenceForDate()
    const existing = await prisma.vendorPayment.findFirst({
      where: { tenantId, draftReference: ref },
      select: { id: true },
    })
    if (!existing) return ref
  }
  throw new Error('Could not generate unique vendor payment draft reference')
}

export async function findVendorPaymentById(
  tenantId: string,
  legalEntityId: string,
  id: string,
): Promise<VendorPayment | null> {
  return prisma.vendorPayment.findFirst({
    where: { id, tenantId, legalEntityId },
  })
}

export async function findVendorPaymentByDraftReference(
  tenantId: string,
  draftReference: string,
): Promise<VendorPayment | null> {
  return prisma.vendorPayment.findFirst({
    where: { tenantId, draftReference },
  })
}

export async function findVendorPaymentByNumber(
  tenantId: string,
  legalEntityId: string,
  vendorPaymentNumber: string,
): Promise<VendorPayment | null> {
  return prisma.vendorPayment.findFirst({
    where: { tenantId, legalEntityId, vendorPaymentNumber },
  })
}

/**
 * Controlled create for foundation tests / future draft services.
 * Does not calculate, approve, post, or assign vendorPaymentNumber.
 */
export async function createVendorPaymentRecord(
  input: CreateVendorPaymentRecordInput,
): Promise<VendorPayment> {
  await getLegalEntityOrThrow(input.tenantId, input.legalEntityId)

  try {
    return await prisma.vendorPayment.create({
      data: {
        tenantId: input.tenantId,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId ?? null,
        vendorId: input.vendorId,
        financialYearId: input.financialYearId,
        draftReference: input.draftReference,
        vendorPaymentNumber: null,
        paymentPurpose: input.paymentPurpose,
        paymentMethod: input.paymentMethod,
        status: input.status ?? 'DRAFT',
        documentDate: input.documentDate,
        paymentDate: input.paymentDate,
        proposedPostingDate: input.proposedPostingDate ?? null,
        valueDate: input.valueDate ?? null,
        dueReferenceDate: input.dueReferenceDate ?? null,
        currencyCode: input.currencyCode ?? 'INR',
        exchangeRate: toDecimal(input.exchangeRate ?? 1),
        vendorCodeSnapshot: input.vendorCodeSnapshot,
        vendorNameSnapshot: input.vendorNameSnapshot,
        vendorGstinSnapshot: input.vendorGstinSnapshot ?? null,
        vendorPanSnapshot: input.vendorPanSnapshot ?? null,
        vendorStateCodeSnapshot: input.vendorStateCodeSnapshot ?? null,
        vendorAddressSnapshot: (input.vendorAddressSnapshot as Prisma.InputJsonValue | undefined) ?? undefined,
        paymentAccountId: input.paymentAccountId ?? null,
        vendorPayableAccountId: input.vendorPayableAccountId ?? null,
        tdsPayableAccountId: input.tdsPayableAccountId ?? null,
        discountAccountId: input.discountAccountId ?? null,
        retentionAccountId: input.retentionAccountId ?? null,
        bankChargeAccountId: input.bankChargeAccountId ?? null,
        processingChargeAccountId: input.processingChargeAccountId ?? null,
        roundOffAccountId: input.roundOffAccountId ?? null,
        otherAdjustmentAccountId: input.otherAdjustmentAccountId ?? null,
        paymentAmount: toDecimal(input.paymentAmount ?? 0),
        settlementAdjustmentAmount: toDecimal(input.settlementAdjustmentAmount ?? 0),
        paymentExpenseAmount: toDecimal(input.paymentExpenseAmount ?? 0),
        roundOffAmount: toDecimal(input.roundOffAmount ?? 0),
        vendorSettlementAmount: toDecimal(input.vendorSettlementAmount ?? 0),
        cashOutflowAmount: toDecimal(input.cashOutflowAmount ?? 0),
        basePaymentAmount: toDecimal(input.basePaymentAmount ?? 0),
        baseSettlementAdjustmentAmount: toDecimal(input.baseSettlementAdjustmentAmount ?? 0),
        basePaymentExpenseAmount: toDecimal(input.basePaymentExpenseAmount ?? 0),
        baseRoundOffAmount: toDecimal(input.baseRoundOffAmount ?? 0),
        baseVendorSettlementAmount: toDecimal(input.baseVendorSettlementAmount ?? 0),
        baseCashOutflowAmount: toDecimal(input.baseCashOutflowAmount ?? 0),
        tdsBaseAmount: toDecimal(input.tdsBaseAmount ?? 0),
        tdsAmount: toDecimal(input.tdsAmount ?? 0),
        baseTdsBaseAmount: toDecimal(input.baseTdsBaseAmount ?? 0),
        baseTdsAmount: toDecimal(input.baseTdsAmount ?? 0),
        paymentReference: input.paymentReference ?? null,
        bankReference: input.bankReference ?? null,
        chequeNumber: input.chequeNumber ?? null,
        chequeDate: input.chequeDate ?? null,
        instrumentReference: input.instrumentReference ?? null,
        narration: input.narration ?? null,
        beneficiarySnapshot: (input.beneficiarySnapshot as Prisma.InputJsonValue | undefined) ?? undefined,
        paymentInstructionSnapshot:
          (input.paymentInstructionSnapshot as Prisma.InputJsonValue | undefined) ?? undefined,
        approvalRequired: input.approvalRequired ?? false,
        accountingVoucherId: null,
        postingEventId: null,
        payableOpenItemId: null,
        createdBy: input.createdBy ?? null,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new VendorPaymentDuplicateDraftReferenceError()
    }
    throw err
  }
}

export async function requireVendorPayment(
  tenantId: string,
  legalEntityId: string,
  id: string,
): Promise<VendorPayment> {
  const payment = await findVendorPaymentById(tenantId, legalEntityId, id)
  if (!payment) throw new VendorPaymentNotFoundError()
  return payment
}

/**
 * Phase 4B3 — load a payment by tenant + id only (no legalEntityId route param on the
 * `/payables/vendor-payments` HTTP surface).
 */
export async function findVendorPaymentWithLinesOrThrow(
  tenantId: string,
  id: string,
): Promise<VendorPaymentWithLines> {
  const payment = await prisma.vendorPayment.findFirst({
    where: { id, tenantId },
    include: { adjustmentLines: { orderBy: { lineNumber: 'asc' } } },
  })
  if (!payment) throw new VendorPaymentNotFoundError()
  return payment
}

const ACCOUNT_COMPONENT_FIELD: Record<string, keyof VendorPaymentResolvedAccountIds> = {
  PAYMENT_ACCOUNT: 'paymentAccountId',
  VENDOR_PAYABLE: 'vendorPayableAccountId',
  TDS_PAYABLE: 'tdsPayableAccountId',
  DISCOUNT_RECEIVED: 'discountAccountId',
  RETENTION_PAYABLE: 'retentionAccountId',
  WITHHOLDING_PAYABLE: 'otherAdjustmentAccountId',
  BANK_CHARGE: 'bankChargeAccountId',
  PROCESSING_CHARGE: 'processingChargeAccountId',
  ROUND_OFF_DEBIT: 'roundOffAccountId',
  ROUND_OFF_CREDIT: 'roundOffAccountId',
  OTHER_ADJUSTMENT: 'otherAdjustmentAccountId',
}

function resolveAccountIds(result: VendorPaymentCalculationResult): VendorPaymentResolvedAccountIds {
  const ids: VendorPaymentResolvedAccountIds = {
    paymentAccountId: null,
    vendorPayableAccountId: null,
    tdsPayableAccountId: null,
    discountAccountId: null,
    retentionAccountId: null,
    bankChargeAccountId: null,
    processingChargeAccountId: null,
    roundOffAccountId: null,
    otherAdjustmentAccountId: null,
  }
  for (const entry of result.accountReadiness.resolvedAccounts) {
    const field = ACCOUNT_COMPONENT_FIELD[entry.component]
    if (field && entry.accountId && !ids[field]) ids[field] = entry.accountId
  }
  return ids
}

/** Sum of TDS adjustment calculation-base amounts (persisted convenience field). */
function tdsBaseAmount(result: VendorPaymentCalculationResult): Prisma.Decimal {
  return sumDecimals(
    result.adjustments
      .filter((a) => a.adjustmentType === 'TDS' && a.calculationBaseAmount != null)
      .map((a) => a.calculationBaseAmount as string),
  )
}

/** Transaction-currency + base-currency header totals mapped from the calculation result. */
function headerAmountFields(result: VendorPaymentCalculationResult) {
  const t = result.totals
  const b = result.baseTotals
  const tdsBase = tdsBaseAmount(result)
  const rate = result.currency.exchangeRate
  return {
    paymentAmount: toDecimal(t.paymentAmount),
    settlementAdjustmentAmount: toDecimal(t.settlementAdjustmentAmount),
    paymentExpenseAmount: toDecimal(t.paymentExpenseAmount),
    roundOffAmount: toDecimal(t.netRoundOffAmount),
    vendorSettlementAmount: toDecimal(t.vendorSettlementAmount),
    cashOutflowAmount: toDecimal(t.cashOutflowAmount),
    basePaymentAmount: toDecimal(b.basePaymentAmount),
    baseSettlementAdjustmentAmount: toDecimal(b.baseSettlementAdjustmentAmount),
    basePaymentExpenseAmount: toDecimal(b.basePaymentExpenseAmount),
    baseRoundOffAmount: toDecimal(b.baseNetRoundOffAmount),
    baseVendorSettlementAmount: toDecimal(b.baseVendorSettlementAmount),
    baseCashOutflowAmount: toDecimal(b.baseCashOutflowAmount),
    tdsBaseAmount: tdsBase,
    tdsAmount: toDecimal(t.tdsAmount),
    baseTdsBaseAmount: convertToBase(tdsBase, rate),
    baseTdsAmount: toDecimal(b.baseTdsAmount),
  }
}

function adjustmentLineInputs(result: VendorPaymentCalculationResult): CreateVendorPaymentAdjustmentLineInput[] {
  return result.adjustments
    .filter((adj) => isPositive(adj.amount))
    .map((adj) => ({
      lineNumber: adj.lineNumber,
      adjustmentType: adj.adjustmentType,
      accountingRole: adj.accountingRole,
      description: adj.description,
      amount: toDecimal(adj.amount),
      baseAmount: toDecimal(adj.baseAmount),
      calculationBaseAmount: adj.calculationBaseAmount != null ? toDecimal(adj.calculationBaseAmount) : null,
      rate: adj.rate != null ? toDecimal(adj.rate) : null,
      sectionCode: adj.sectionCode,
      statutoryReference: adj.statutoryReference,
      accountId: adj.accountId,
      costCentreId: adj.costCentreId,
      projectReference: adj.projectReference,
      departmentReference: adj.departmentReference,
    }))
}

function headerCreateData(header: VendorPaymentDraftHeaderInput, result: VendorPaymentCalculationResult) {
  return {
    tenantId: header.tenantId,
    legalEntityId: header.legalEntityId,
    branchId: header.branchId ?? null,
    vendorId: header.vendorId,
    financialYearId: header.financialYearId,
    paymentPurpose: header.paymentPurpose,
    paymentMethod: header.paymentMethod,
    documentDate: header.documentDate,
    paymentDate: header.paymentDate,
    proposedPostingDate: header.proposedPostingDate ?? null,
    valueDate: header.valueDate ?? null,
    dueReferenceDate: header.dueReferenceDate ?? null,
    currencyCode: header.currencyCode,
    exchangeRate: toDecimal(header.exchangeRate),
    vendorCodeSnapshot: header.vendorSnapshot.vendorCodeSnapshot,
    vendorNameSnapshot: header.vendorSnapshot.vendorNameSnapshot,
    vendorGstinSnapshot: header.vendorSnapshot.vendorGstinSnapshot ?? null,
    vendorPanSnapshot: header.vendorSnapshot.vendorPanSnapshot ?? null,
    vendorStateCodeSnapshot: header.vendorSnapshot.vendorStateCodeSnapshot ?? null,
    vendorAddressSnapshot: (header.vendorSnapshot.vendorAddressSnapshot as Prisma.InputJsonValue | undefined) ?? undefined,
    paymentReference: header.paymentReference ?? null,
    bankReference: header.bankReference ?? null,
    chequeNumber: header.chequeNumber ?? null,
    chequeDate: header.chequeDate ?? null,
    instrumentReference: header.instrumentReference ?? null,
    narration: header.narration ?? null,
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
 * Phase 4B3 — create a DRAFT vendor payment with server-calculated totals, snapshots, and
 * adjustment lines. `paymentUniquenessKey` remains null until claimed by submit/mark-ready.
 */
export async function createVendorPaymentDraft(
  header: VendorPaymentDraftHeaderInput,
  result: VendorPaymentCalculationResult,
): Promise<VendorPaymentWithLines> {
  await getLegalEntityOrThrow(header.tenantId, header.legalEntityId)

  const payment = await prisma.vendorPayment.create({
    data: {
      ...headerCreateData(header, result),
      status: 'DRAFT',
      vendorPaymentNumber: null,
      paymentUniquenessKey: null,
      draftReference: header.draftReference,
      accountingVoucherId: null,
      postingEventId: null,
      payableOpenItemId: null,
      createdBy: header.userId ?? null,
    },
  })

  await replaceVendorPaymentAdjustmentLines(header.tenantId, header.legalEntityId, payment.id, adjustmentLineInputs(result))
  return findVendorPaymentWithLinesOrThrow(header.tenantId, payment.id)
}

/**
 * Phase 4B3 — replace a DRAFT payment's header + adjustment lines after recalculation.
 * Optimistic concurrency via `expectedUpdatedAt`; only DRAFT payments are editable.
 */
export async function replaceVendorPaymentDraft(
  tenantId: string,
  id: string,
  header: VendorPaymentDraftHeaderInput,
  result: VendorPaymentCalculationResult,
  expectedUpdatedAt: string,
): Promise<VendorPaymentWithLines> {
  const existing = await findVendorPaymentWithLinesOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') throw new VendorPaymentEditNotAllowedError()
  if (existing.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new VendorPaymentStaleVersionError()

  await prisma.vendorPayment.update({
    where: { id, tenantId },
    data: headerCreateData(header, result),
  })

  await replaceVendorPaymentAdjustmentLines(tenantId, existing.legalEntityId, id, adjustmentLineInputs(result))
  return findVendorPaymentWithLinesOrThrow(tenantId, id)
}

/**
 * Phase 4B3 — refresh calculation snapshots (totals + resolved accounts + accounting preview)
 * without touching status, adjustment lines, or other header fields. Used by validate flows.
 */
export async function persistCalculatedFields(
  tenantId: string,
  id: string,
  result: VendorPaymentCalculationResult,
  userId?: string | null,
): Promise<VendorPayment> {
  return prisma.vendorPayment.update({
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

/** Phase 4B3 — paginated list for the vendor-payment HTTP surface. */
export async function listVendorPayments(
  tenantId: string,
  query: ListVendorPaymentsQuery,
): Promise<{ items: VendorPaymentWithLines[]; total: number; page: number; limit: number }> {
  const { skip, take, page } = getPagination(query)
  const where: Prisma.VendorPaymentWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.paymentPurpose ? { paymentPurpose: query.paymentPurpose } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          paymentDate: {
            ...(query.dateFrom ? { gte: parseDateOnly(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: parseDateOnly(query.dateTo) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { draftReference: { contains: query.search } },
            { vendorPaymentNumber: { contains: query.search } },
            { paymentReference: { contains: query.search } },
            { vendorNameSnapshot: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.vendorPayment.findMany({
      where,
      include: { adjustmentLines: { orderBy: { lineNumber: 'asc' } } },
      skip,
      take,
      orderBy: { createdAt: query.sortOrder },
    }),
    prisma.vendorPayment.count({ where }),
  ])
  return { items, total, page, limit: query.limit }
}

export interface FinalizePostedVendorPaymentInput {
  tenantId: string
  vendorPaymentId: string
  expectedUpdatedAt: string
  vendorPaymentNumber: string
  accountingVoucherId: string
  postingEventId: string
  payableOpenItemId: string
  postedById: string | null
  financialYearId: string
}

/**
 * Phase 4B3 — conditional READY_TO_POST → POSTED finalisation inside the posting transaction.
 * Requires null number/voucher/event/open-item links and matching optimistic updatedAt.
 */
export async function finalizePostedVendorPayment(
  tx: Prisma.TransactionClient,
  input: FinalizePostedVendorPaymentInput,
): Promise<{ count: number }> {
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt)
  return tx.vendorPayment.updateMany({
    where: {
      id: input.vendorPaymentId,
      tenantId: input.tenantId,
      status: 'READY_TO_POST',
      vendorPaymentNumber: null,
      accountingVoucherId: null,
      postingEventId: null,
      payableOpenItemId: null,
      updatedAt: expectedUpdatedAt,
    },
    data: {
      status: 'POSTED',
      vendorPaymentNumber: input.vendorPaymentNumber,
      accountingVoucherId: input.accountingVoucherId,
      postingEventId: input.postingEventId,
      payableOpenItemId: input.payableOpenItemId,
      financialYearId: input.financialYearId,
      postedAt: new Date(),
      postedBy: input.postedById,
      updatedBy: input.postedById,
    },
  })
}

export interface CreateVendorPaymentPayableOpenItemInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  paymentPurpose: VendorPayment['paymentPurpose']
  documentId: string
  documentNumber: string
  documentDate: Date
  postingDate: Date
  dueDate?: Date | null
  currencyCode: string
  exchangeRate: Prisma.Decimal | number | string
  originalAmount: Prisma.Decimal | number | string
  baseOriginalAmount: Prisma.Decimal | number | string
  vendorPayableAccountId: string
  sourceVendorPaymentId: string
  accountingVoucherId: string
  postingEventId: string
  createdBy?: string | null
}

/**
 * Phase 4B3 — create exactly one DEBIT payable open item inside the posting tx.
 * documentType = VENDOR_ADVANCE when the payment purpose is ADVANCE, otherwise VENDOR_PAYMENT.
 * originalAmount = vendorSettlementAmount (NOT cash outflow); allocated = 0; outstanding = original.
 */
export async function createVendorPaymentPayableOpenItem(
  tx: Prisma.TransactionClient,
  input: CreateVendorPaymentPayableOpenItemInput,
) {
  const documentType = input.paymentPurpose === 'ADVANCE' ? 'VENDOR_ADVANCE' : 'VENDOR_PAYMENT'
  return tx.payableOpenItem.create({
    data: {
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      vendorId: input.vendorId,
      vendorCodeSnapshot: input.vendorCodeSnapshot,
      vendorNameSnapshot: input.vendorNameSnapshot,
      side: 'DEBIT',
      documentType,
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
      outstandingAmount: toDecimal(input.originalAmount),
      baseOriginalAmount: toDecimal(input.baseOriginalAmount),
      baseAllocatedAmount: toDecimal(0),
      baseAdjustedAmount: toDecimal(0),
      baseWrittenOffAmount: toDecimal(0),
      baseOutstandingAmount: toDecimal(input.baseOriginalAmount),
      status: 'OPEN',
      isDisputed: false,
      isOnHold: false,
      vendorPayableAccountId: input.vendorPayableAccountId,
      sourceVendorPaymentId: input.sourceVendorPaymentId,
      accountingVoucherId: input.accountingVoucherId,
      postingEventId: input.postingEventId,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    },
  })
}
