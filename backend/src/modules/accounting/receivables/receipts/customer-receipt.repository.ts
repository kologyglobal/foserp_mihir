import type { CustomerReceipt, CustomerReceiptDeductionLine, Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { formatForPersistence, roundExchangeRate, toDecimal } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../../shared/finance.helpers.js'
import { resolvePeriodByDate } from '../../posting/posting-period.service.js'
import type { CustomerReceiptCalculationResult, ReceiptChargeSummaryRow } from './calculation/customer-receipt-calculation.types.js'
import type { CustomerParty } from '../customer-party/customer-party.types.js'
import {
  CustomerReceiptAlreadyCancelledError,
  CustomerReceiptInvalidStatusError,
  CustomerReceiptNotEditableError,
  CustomerReceiptNotFoundError,
  CustomerReceiptStaleUpdateError,
} from './customer-receipt.errors.js'
import type { CreateCustomerReceiptInput, UpdateCustomerReceiptInput } from './customer-receipt.schemas.js'
import type {
  CustomerReceiptCalculationContext,
  CustomerReceiptDeductionLineDto,
  CustomerReceiptDto,
  CustomerReceiptTdsDto,
  CustomerReceiptWithDeductions,
  ListCustomerReceiptsQuery,
} from './customer-receipt.types.js'

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function mapDeductionLine(line: CustomerReceiptDeductionLine): CustomerReceiptDeductionLineDto {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    type: line.type,
    code: line.code,
    description: line.description,
    amount: formatForPersistence(line.amount),
    baseAmount: formatForPersistence(line.baseAmount),
    accountId: line.accountId,
  }
}

function buildTdsDto(receipt: CustomerReceipt): CustomerReceiptTdsDto | null {
  if (!receipt.tdsMode || receipt.tdsMode === 'NONE') return null
  return {
    mode: receipt.tdsMode as CustomerReceiptTdsDto['mode'],
    value: receipt.tdsValue != null ? formatForPersistence(receipt.tdsValue) : null,
    calculationBase: receipt.tdsCalculationBase != null ? formatForPersistence(receipt.tdsCalculationBase) : null,
    sectionCode: receipt.tdsSectionCode,
    certificateReference: receipt.tdsCertificateReference,
    accountId: receipt.customerTdsReceivableAccountId,
    amount: formatForPersistence(receipt.customerTdsAmount),
  }
}

export function mapCustomerReceiptToDto(
  receipt: CustomerReceipt,
  deductionLines?: CustomerReceiptDeductionLine[],
): CustomerReceiptDto {
  const dto: CustomerReceiptDto = {
    id: receipt.id,
    tenantId: receipt.tenantId,
    legalEntityId: receipt.legalEntityId,
    branchId: receipt.branchId,
    financialYearId: receipt.financialYearId,
    receiptNumber: receipt.receiptNumber,
    draftReference: receipt.draftReference,
    status: receipt.status,
    customerId: receipt.customerId,
    customerCodeSnapshot: receipt.customerCodeSnapshot,
    customerNameSnapshot: receipt.customerNameSnapshot,
    customerGstinSnapshot: receipt.customerGstinSnapshot,
    customerPanSnapshot: receipt.customerPanSnapshot,
    customerStateCodeSnapshot: receipt.customerStateCodeSnapshot,
    customerCountryCodeSnapshot: receipt.customerCountryCodeSnapshot,
    customerBillingAddressSnapshot: receipt.customerBillingAddressSnapshot as Record<string, unknown> | null,
    sourceType: receipt.sourceType,
    sourceDocumentId: receipt.sourceDocumentId,
    sourceDocumentNumberSnapshot: receipt.sourceDocumentNumberSnapshot,
    paymentMethod: receipt.paymentMethod,
    receiptDate: formatDate(receipt.receiptDate)!,
    postingDate: formatDate(receipt.postingDate),
    valueDate: formatDate(receipt.valueDate),
    referenceNumber: receipt.referenceNumber,
    transactionReference: receipt.transactionReference,
    customerBankReference: receipt.customerBankReference,
    chequeNumber: receipt.chequeNumber,
    chequeDate: formatDate(receipt.chequeDate),
    bankName: receipt.bankName,
    currencyCode: receipt.currencyCode,
    exchangeRate: roundExchangeRate(receipt.exchangeRate).toFixed(8),
    grossReceiptAmount: formatForPersistence(receipt.grossReceiptAmount),
    customerTdsAmount: formatForPersistence(receipt.customerTdsAmount),
    bankChargeAmount: formatForPersistence(receipt.bankChargeAmount),
    otherDeductionAmount: formatForPersistence(receipt.otherDeductionAmount),
    bankCashAmount: formatForPersistence(receipt.bankCashAmount),
    allocatableAmount: formatForPersistence(receipt.allocatableAmount),
    allocatedAmount: formatForPersistence(receipt.allocatedAmount),
    unallocatedAmount: formatForPersistence(receipt.unallocatedAmount),
    baseGrossReceiptAmount: formatForPersistence(receipt.baseGrossReceiptAmount),
    baseCustomerTdsAmount: formatForPersistence(receipt.baseCustomerTdsAmount),
    baseBankChargeAmount: formatForPersistence(receipt.baseBankChargeAmount),
    baseOtherDeductionAmount: formatForPersistence(receipt.baseOtherDeductionAmount),
    baseBankCashAmount: formatForPersistence(receipt.baseBankCashAmount),
    baseAllocatableAmount: formatForPersistence(receipt.baseAllocatableAmount),
    baseAllocatedAmount: formatForPersistence(receipt.baseAllocatedAmount),
    baseUnallocatedAmount: formatForPersistence(receipt.baseUnallocatedAmount),
    bankCashAccountId: receipt.bankCashAccountId,
    customerReceivableAccountId: receipt.customerReceivableAccountId,
    bankChargeAccountId: receipt.bankChargeAccountId,
    customerTdsReceivableAccountId: receipt.customerTdsReceivableAccountId,
    otherDeductionAccountId: receipt.otherDeductionAccountId,
    customerTds: buildTdsDto(receipt),
    accountingVoucherId: receipt.accountingVoucherId,
    postingEventId: receipt.postingEventId,
    creditOpenItemId: receipt.creditOpenItemId,
    narration: receipt.narration,
    internalRemarks: receipt.internalRemarks,
    postedAt: receipt.postedAt?.toISOString() ?? null,
    postedBy: receipt.postedBy,
    cancelledAt: receipt.cancelledAt?.toISOString() ?? null,
    cancelledBy: receipt.cancelledBy,
    cancellationReason: receipt.cancellationReason,
    createdBy: receipt.createdBy,
    updatedBy: receipt.updatedBy,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
  }
  if (deductionLines) {
    dto.bankCharges = deductionLines.filter((l) => l.type === 'BANK_CHARGE').map(mapDeductionLine)
    dto.otherDeductions = deductionLines.filter((l) => l.type === 'OTHER_DEDUCTION').map(mapDeductionLine)
  }
  return dto
}

export async function findCustomerReceiptById(
  tenantId: string,
  id: string,
): Promise<CustomerReceiptDto | null> {
  const receipt = await prisma.customerReceipt.findFirst({ where: { id, tenantId } })
  return receipt ? mapCustomerReceiptToDto(receipt) : null
}

export async function findCustomerReceiptRecordById(
  tenantId: string,
  id: string,
): Promise<CustomerReceipt | null> {
  return prisma.customerReceipt.findFirst({ where: { id, tenantId } })
}

export async function findCustomerReceiptWithDeductions(
  tenantId: string,
  id: string,
): Promise<CustomerReceiptWithDeductions | null> {
  return prisma.customerReceipt.findFirst({
    where: { id, tenantId },
    include: { deductionLines: { orderBy: { lineNumber: 'asc' } } },
  })
}

export async function findCustomerReceiptWithDeductionsOrThrow(
  tenantId: string,
  id: string,
): Promise<CustomerReceiptWithDeductions> {
  const receipt = await findCustomerReceiptWithDeductions(tenantId, id)
  if (!receipt) throw new CustomerReceiptNotFoundError()
  return receipt
}

/* ─── Phase 3B3 — draft reference generation (mirrors sales invoice pattern) ─── */

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
  return `RCPT-DRAFT-${ymd}-${randomDraftSuffix()}`
}

export async function generateUniqueDraftReference(legalEntityId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ref = draftReferenceForDate()
    const existing = await prisma.customerReceipt.findFirst({
      where: { legalEntityId, draftReference: ref },
      select: { id: true },
    })
    if (!existing) return ref
  }
  throw new Error('Could not generate unique draft reference')
}

const EDITABLE_STATUSES = ['DRAFT', 'READY_TO_POST'] as const

function assertEditable(receipt: CustomerReceipt): void {
  if (receipt.status === 'CANCELLED') throw new CustomerReceiptAlreadyCancelledError()
  if (!EDITABLE_STATUSES.includes(receipt.status as (typeof EDITABLE_STATUSES)[number])) {
    throw new CustomerReceiptNotEditableError()
  }
}

function assertUpdatedAt(receipt: CustomerReceipt, updatedAt: string): void {
  const expected = new Date(updatedAt).getTime()
  if (receipt.updatedAt.getTime() !== expected) {
    throw new CustomerReceiptStaleUpdateError()
  }
}

export interface ResolvedReceiptAccounts {
  bankCashAccountId: string | null
  customerReceivableAccountId: string | null
  customerTdsAccountId: string | null
  bankChargeAccountIds: Array<string | null>
  otherDeductionAccountIds: Array<string | null>
}

function partySnapshots(party: CustomerParty) {
  return {
    customerCodeSnapshot: party.code,
    customerNameSnapshot: party.name,
    customerGstinSnapshot: party.gstin,
    customerPanSnapshot: party.pan,
    customerStateCodeSnapshot: party.stateCode,
    customerCountryCodeSnapshot: party.countryCode,
    customerBillingAddressSnapshot: party.billingAddress as unknown as Prisma.InputJsonValue,
  }
}

function headerAmountsFromCalc(calc: CustomerReceiptCalculationResult) {
  const tds = calc.tdsSummary && calc.tdsSummary.mode !== 'NONE' ? calc.tdsSummary : null
  return {
    grossReceiptAmount: toDecimal(calc.grossReceiptAmount),
    customerTdsAmount: toDecimal(calc.customerTdsAmount),
    bankChargeAmount: toDecimal(calc.bankChargeAmount),
    otherDeductionAmount: toDecimal(calc.otherDeductionAmount),
    bankCashAmount: toDecimal(calc.bankCashAmount),
    allocatableAmount: toDecimal(calc.allocatableAmount),
    allocatedAmount: toDecimal('0'),
    unallocatedAmount: toDecimal(calc.allocatableAmount),
    baseGrossReceiptAmount: toDecimal(calc.baseGrossReceiptAmount),
    baseCustomerTdsAmount: toDecimal(calc.baseCustomerTdsAmount),
    baseBankChargeAmount: toDecimal(calc.baseBankChargeAmount),
    baseOtherDeductionAmount: toDecimal(calc.baseOtherDeductionAmount),
    baseBankCashAmount: toDecimal(calc.baseBankCashAmount),
    baseAllocatableAmount: toDecimal(calc.baseAllocatableAmount),
    baseAllocatedAmount: toDecimal('0'),
    baseUnallocatedAmount: toDecimal(calc.baseAllocatableAmount),
    tdsMode: tds?.mode ?? null,
    tdsValue: tds?.value != null ? toDecimal(tds.value) : null,
    tdsCalculationBase: tds?.calculationBase != null ? toDecimal(tds.calculationBase) : null,
    tdsSectionCode: tds?.sectionCode ?? null,
    tdsCertificateReference: tds?.certificateReference ?? null,
  }
}

function headerAccountsFromResolved(resolved: ResolvedReceiptAccounts) {
  return {
    bankCashAccountId: resolved.bankCashAccountId,
    customerReceivableAccountId: resolved.customerReceivableAccountId,
    customerTdsReceivableAccountId: resolved.customerTdsAccountId,
    bankChargeAccountId: resolved.bankChargeAccountIds.find((a) => a) ?? null,
    otherDeductionAccountId: resolved.otherDeductionAccountIds.find((a) => a) ?? null,
  }
}

function mapDeductionLineData(
  tenantId: string,
  legalEntityId: string,
  receiptId: string,
  calc: CustomerReceiptCalculationResult,
  resolved: ResolvedReceiptAccounts,
): Prisma.CustomerReceiptDeductionLineCreateManyInput[] {
  const lines: Prisma.CustomerReceiptDeductionLineCreateManyInput[] = []
  let lineNumber = 1

  const chargeRow = (row: ReceiptChargeSummaryRow, accountId: string | null) => ({
    tenantId,
    legalEntityId,
    receiptId,
    lineNumber: lineNumber++,
    type: 'BANK_CHARGE' as const,
    code: row.code ?? null,
    description: row.description,
    amount: toDecimal(row.amount),
    baseAmount: toDecimal(row.baseAmount),
    accountId,
  })
  const deductionRow = (row: ReceiptChargeSummaryRow, accountId: string | null) => ({
    tenantId,
    legalEntityId,
    receiptId,
    lineNumber: lineNumber++,
    type: 'OTHER_DEDUCTION' as const,
    code: row.code ?? null,
    description: row.description,
    amount: toDecimal(row.amount),
    baseAmount: toDecimal(row.baseAmount),
    accountId,
  })

  calc.bankChargeSummary.forEach((row, idx) => {
    lines.push(chargeRow(row, resolved.bankChargeAccountIds[idx] ?? row.accountId ?? null))
  })
  calc.otherDeductionSummary.forEach((row, idx) => {
    lines.push(deductionRow(row, resolved.otherDeductionAccountIds[idx] ?? row.accountId ?? null))
  })

  return lines
}

export async function createCustomerReceiptDraft(
  tenantId: string,
  input: CreateCustomerReceiptInput,
  calc: CustomerReceiptCalculationResult,
  party: CustomerParty,
  createdBy: string | undefined,
  resolvedAccounts: ResolvedReceiptAccounts,
): Promise<CustomerReceiptWithDeductions> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const { financialYear } = await resolvePeriodByDate(tenantId, input.legalEntityId, input.postingDate)
  const draftReference = await generateUniqueDraftReference(input.legalEntityId)
  const context = buildContext(input)

  return prisma.$transaction(async (tx) => {
    const header = await tx.customerReceipt.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId ?? null,
        financialYearId: financialYear.id,
        receiptNumber: null,
        draftReference,
        status: 'DRAFT',
        customerId: input.customerId,
        ...partySnapshots(party),
        sourceType: input.sourceType,
        sourceDocumentId: input.sourceDocumentId ?? null,
        sourceDocumentNumberSnapshot: input.sourceDocumentNumber ?? null,
        calculationContext: context as unknown as Prisma.InputJsonValue,
        paymentMethod: input.paymentMethod,
        receiptDate: parseDateOnly(input.receiptDate),
        postingDate: parseDateOnly(input.postingDate),
        valueDate: input.valueDate ? parseDateOnly(input.valueDate) : null,
        transactionReference: input.transactionReference ?? null,
        customerBankReference: input.bankReference ?? null,
        chequeNumber: input.instrumentNumber ?? null,
        chequeDate: input.instrumentDate ? parseDateOnly(input.instrumentDate) : null,
        currencyCode: input.currencyCode,
        exchangeRate: roundExchangeRate(input.exchangeRate),
        narration: input.narration ?? null,
        internalRemarks: input.notes ?? null,
        accountingVoucherId: null,
        postingEventId: null,
        createdBy: createdBy ?? null,
        updatedBy: createdBy ?? null,
        ...headerAmountsFromCalc(calc),
        ...headerAccountsFromResolved(resolvedAccounts),
      },
    })

    const lineData = mapDeductionLineData(tenantId, input.legalEntityId, header.id, calc, resolvedAccounts)
    if (lineData.length > 0) await tx.customerReceiptDeductionLine.createMany({ data: lineData })

    return tx.customerReceipt.findFirstOrThrow({
      where: { id: header.id, tenantId },
      include: { deductionLines: { orderBy: { lineNumber: 'asc' } } },
    })
  })
}

function buildContext(input: CreateCustomerReceiptInput | UpdateCustomerReceiptInput): CustomerReceiptCalculationContext {
  return {
    sourceType: input.sourceType,
    sourceDocumentId: input.sourceDocumentId ?? null,
    sourceDocumentNumber: input.sourceDocumentNumber ?? null,
    paymentMethod: input.paymentMethod,
    currencyCode: input.currencyCode,
    exchangeRate: input.exchangeRate,
    bankCashAmount: input.bankCashAmount,
    bankCashAccountId: input.bankCashAccountId,
    customerReceivableAccountId: input.customerReceivableAccountId ?? null,
    customerTds: input.customerTds ?? null,
    bankCharges: input.bankCharges ?? null,
    otherDeductions: input.otherDeductions ?? null,
    instrumentNumber: input.instrumentNumber ?? null,
    instrumentDate: input.instrumentDate ?? null,
    bankReference: input.bankReference ?? null,
    transactionReference: input.transactionReference ?? null,
    narration: input.narration ?? null,
    notes: input.notes ?? null,
    valueDate: input.valueDate ?? null,
  }
}

export async function replaceEditableReceiptDeductions(
  tenantId: string,
  receiptId: string,
  input: UpdateCustomerReceiptInput,
  calc: CustomerReceiptCalculationResult,
  party: CustomerParty,
  updatedBy: string | undefined,
  resolvedAccounts: ResolvedReceiptAccounts,
  options?: { reopenFromReady?: boolean },
): Promise<CustomerReceiptWithDeductions> {
  const existing = await findCustomerReceiptWithDeductionsOrThrow(tenantId, receiptId)
  assertEditable(existing)
  assertUpdatedAt(existing, input.updatedAt)

  const { financialYear } = await resolvePeriodByDate(tenantId, existing.legalEntityId, input.postingDate)
  const context = buildContext(input)
  const nextStatus = options?.reopenFromReady ? 'DRAFT' : existing.status

  return prisma.$transaction(async (tx) => {
    await tx.customerReceiptDeductionLine.deleteMany({ where: { tenantId, receiptId } })

    await tx.customerReceipt.update({
      where: { id: receiptId },
      data: {
        branchId: input.branchId ?? null,
        financialYearId: financialYear.id,
        status: nextStatus,
        customerId: input.customerId,
        ...partySnapshots(party),
        sourceType: input.sourceType,
        sourceDocumentId: input.sourceDocumentId ?? null,
        sourceDocumentNumberSnapshot: input.sourceDocumentNumber ?? null,
        calculationContext: context as unknown as Prisma.InputJsonValue,
        paymentMethod: input.paymentMethod,
        receiptDate: parseDateOnly(input.receiptDate),
        postingDate: parseDateOnly(input.postingDate),
        valueDate: input.valueDate ? parseDateOnly(input.valueDate) : null,
        transactionReference: input.transactionReference ?? null,
        customerBankReference: input.bankReference ?? null,
        chequeNumber: input.instrumentNumber ?? null,
        chequeDate: input.instrumentDate ? parseDateOnly(input.instrumentDate) : null,
        currencyCode: input.currencyCode,
        exchangeRate: roundExchangeRate(input.exchangeRate),
        narration: input.narration ?? null,
        internalRemarks: input.notes ?? null,
        updatedBy: updatedBy ?? null,
        ...headerAmountsFromCalc(calc),
        ...headerAccountsFromResolved(resolvedAccounts),
      },
    })

    const lineData = mapDeductionLineData(tenantId, existing.legalEntityId, receiptId, calc, resolvedAccounts)
    if (lineData.length > 0) await tx.customerReceiptDeductionLine.createMany({ data: lineData })

    return tx.customerReceipt.findFirstOrThrow({
      where: { id: receiptId, tenantId },
      include: { deductionLines: { orderBy: { lineNumber: 'asc' } } },
    })
  })
}

export async function persistRecalculatedAmounts(
  tenantId: string,
  receiptId: string,
  calc: CustomerReceiptCalculationResult,
  context: CustomerReceiptCalculationContext,
  updatedBy?: string,
): Promise<CustomerReceiptWithDeductions> {
  await prisma.customerReceipt.update({
    where: { id: receiptId },
    data: {
      ...headerAmountsFromCalc(calc),
      calculationContext: context as unknown as Prisma.InputJsonValue,
      updatedBy: updatedBy ?? null,
    },
  })
  return findCustomerReceiptWithDeductionsOrThrow(tenantId, receiptId)
}

export async function markCustomerReceiptReady(
  tenantId: string,
  receiptId: string,
  updatedBy?: string,
): Promise<CustomerReceiptWithDeductions> {
  const receipt = await findCustomerReceiptWithDeductionsOrThrow(tenantId, receiptId)
  if (receipt.status !== 'DRAFT') throw new CustomerReceiptInvalidStatusError('Only draft receipts can be marked ready')
  await prisma.customerReceipt.update({
    where: { id: receiptId },
    data: { status: 'READY_TO_POST', updatedBy: updatedBy ?? null },
  })
  return findCustomerReceiptWithDeductionsOrThrow(tenantId, receiptId)
}

export async function cancelCustomerReceiptDraft(
  tenantId: string,
  receiptId: string,
  cancellationReason: string,
  cancelledBy?: string,
): Promise<CustomerReceiptWithDeductions> {
  const receipt = await findCustomerReceiptWithDeductionsOrThrow(tenantId, receiptId)
  if (receipt.status === 'CANCELLED') throw new CustomerReceiptAlreadyCancelledError()
  if (!EDITABLE_STATUSES.includes(receipt.status as (typeof EDITABLE_STATUSES)[number])) {
    throw new CustomerReceiptInvalidStatusError('Only draft or ready receipts can be cancelled')
  }
  await prisma.customerReceipt.update({
    where: { id: receiptId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: cancelledBy ?? null,
      cancellationReason,
      updatedBy: cancelledBy ?? null,
    },
  })
  return findCustomerReceiptWithDeductionsOrThrow(tenantId, receiptId)
}

export async function listCustomerReceiptRecords(
  tenantId: string,
  query: ListCustomerReceiptsQuery,
): Promise<{ items: CustomerReceiptWithDeductions[]; total: number; page: number; limit: number }> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const limit = query.limit ?? query.pageSize ?? 20
  const sortField = query.sort ?? 'receiptDate'
  const sortOrder = query.sortOrder ?? 'desc'
  const { skip, take, page } = getPagination({ page: query.page ?? 1, limit, sortOrder })

  const where: Prisma.CustomerReceiptWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(query.sourceType ? { sourceType: query.sourceType } : {}),
    ...(query.currencyCode ? { currencyCode: query.currencyCode } : {}),
    ...(query.createdBy ? { createdBy: query.createdBy } : {}),
    ...(query.receiptDateFrom || query.receiptDateTo
      ? {
          receiptDate: {
            ...(query.receiptDateFrom ? { gte: parseDateOnly(query.receiptDateFrom) } : {}),
            ...(query.receiptDateTo ? { lte: parseDateOnly(query.receiptDateTo) } : {}),
          },
        }
      : {}),
    ...(query.postingDateFrom || query.postingDateTo
      ? {
          postingDate: {
            ...(query.postingDateFrom ? { gte: parseDateOnly(query.postingDateFrom) } : {}),
            ...(query.postingDateTo ? { lte: parseDateOnly(query.postingDateTo) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { draftReference: { contains: query.search } },
            { receiptNumber: { contains: query.search } },
            { customerNameSnapshot: { contains: query.search } },
            { customerCodeSnapshot: { contains: query.search } },
            { chequeNumber: { contains: query.search } },
            { transactionReference: { contains: query.search } },
            { customerBankReference: { contains: query.search } },
            { sourceDocumentNumberSnapshot: { contains: query.search } },
          ],
        }
      : {}),
  }

  const orderBy: Prisma.CustomerReceiptOrderByWithRelationInput = { [sortField]: sortOrder }

  const [items, total] = await Promise.all([
    prisma.customerReceipt.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { deductionLines: { orderBy: { lineNumber: 'asc' } } },
    }),
    prisma.customerReceipt.count({ where }),
  ])

  return { items, total, page, limit }
}

/** @deprecated Use listCustomerReceiptRecords + read service — foundation-test compatibility. */
export async function listCustomerReceipts(
  tenantId: string,
  query: ListCustomerReceiptsQuery,
): Promise<{ items: CustomerReceiptDto[]; total: number; page: number; limit: number }> {
  const result = await listCustomerReceiptRecords(tenantId, query)
  return {
    ...result,
    items: result.items.map((r) => mapCustomerReceiptToDto(r, r.deductionLines)),
  }
}

/** Internal: conditional receipt allocated/unallocated update after allocation. Not HTTP-routable. */
export async function updateReceiptAfterAllocation(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string
    legalEntityId: string
    receiptId: string
    expectedAllocatedAmount: Prisma.Decimal | string
    expectedUnallocatedAmount: Prisma.Decimal | string
    expectedBaseAllocatedAmount: Prisma.Decimal | string
    expectedBaseUnallocatedAmount: Prisma.Decimal | string
    allocationAmount: Prisma.Decimal | string
    baseAllocationAmount: Prisma.Decimal | string
    updatedBy?: string | null
  },
): Promise<number> {
  const result = await tx.customerReceipt.updateMany({
    where: {
      id: input.receiptId,
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      status: 'POSTED',
      allocatedAmount: input.expectedAllocatedAmount,
      unallocatedAmount: input.expectedUnallocatedAmount,
      baseAllocatedAmount: input.expectedBaseAllocatedAmount,
      baseUnallocatedAmount: input.expectedBaseUnallocatedAmount,
    },
    data: {
      allocatedAmount: { increment: input.allocationAmount },
      unallocatedAmount: { decrement: input.allocationAmount },
      baseAllocatedAmount: { increment: input.baseAllocationAmount },
      baseUnallocatedAmount: { decrement: input.baseAllocationAmount },
      updatedBy: input.updatedBy ?? null,
    },
  })
  return result.count
}
