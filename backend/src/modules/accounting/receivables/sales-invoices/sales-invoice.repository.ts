import type { Prisma, SalesInvoice, SalesInvoiceLine } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../../shared/finance.helpers.js'
import { formatForPersistence, roundExchangeRate, toDecimal } from '../../shared/finance-decimal.js'
import { resolvePeriodByDate } from '../../posting/posting-period.service.js'
import type { SalesInvoiceCalculationResult } from '../calculation/sales-invoice-calculation.types.js'
import type { CustomerParty } from '../customer-party/customer-party.types.js'
import type { CreateSalesInvoiceInput, UpdateSalesInvoiceInput } from './sales-invoice.schemas.js'
import {
  SalesInvoiceAlreadyCancelledError,
  SalesInvoiceInvalidStatusError,
  SalesInvoiceNotEditableError,
  SalesInvoiceNotFoundError,
  SalesInvoiceStaleUpdateError,
} from './sales-invoice.errors.js'
import type {
  ListSalesInvoicesQuery,
  SalesInvoiceCalculationContext,
  SalesInvoiceWithLines,
} from './sales-invoice.types.js'
import {
  buildCalculationContextFromRequest,
  deriveDiscountPercent,
  findLineContext,
} from './sales-invoice-validation.service.js'
import type { SalesOrderSourceSnapshot } from '../source/sales-order-source.service.js'

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
  return `AR-DRAFT-${ymd}-${randomDraftSuffix()}`
}

export async function generateUniqueDraftReference(legalEntityId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ref = draftReferenceForDate()
    const existing = await prisma.salesInvoice.findFirst({
      where: { legalEntityId, draftReference: ref },
      select: { id: true },
    })
    if (!existing) return ref
  }
  throw new Error('Could not generate unique draft reference')
}

const EDITABLE_STATUSES = ['DRAFT', 'READY_TO_POST'] as const

function mapLineData(
  tenantId: string,
  legalEntityId: string,
  salesInvoiceId: string,
  calc: SalesInvoiceCalculationResult,
  context: SalesInvoiceCalculationContext,
): Prisma.SalesInvoiceLineCreateManyInput[] {
  return calc.lines.map((line) => {
    const lineCtx = findLineContext(context, line.lineNumber)
    return {
      tenantId,
      legalEntityId,
      salesInvoiceId,
      lineNumber: line.lineNumber,
      sourceLineId: lineCtx?.sourceLineId ?? null,
      itemId: line.itemId,
      itemCodeSnapshot: line.itemCodeSnapshot,
      itemNameSnapshot: line.itemNameSnapshot,
      hsnCodeSnapshot: line.hsnCode,
      uomSnapshot: line.uomSnapshot,
      description: line.description,
      quantity: toDecimal(line.quantity),
      unitRate: toDecimal(line.unitPrice),
      grossAmount: toDecimal(line.grossAmount),
      discountPercent: toDecimal(deriveDiscountPercent(lineCtx ?? { lineNumber: line.lineNumber, quantity: line.quantity, unitPrice: line.unitPrice }, line.grossAmount, line.lineDiscountAmount)),
      discountAmount: toDecimal(line.lineDiscountAmount),
      taxableAmount: toDecimal(line.taxableAmount),
      cgstRate: toDecimal(line.cgstRate),
      cgstAmount: toDecimal(line.cgstAmount),
      sgstRate: toDecimal(line.sgstRate),
      sgstAmount: toDecimal(line.sgstAmount),
      igstRate: toDecimal(line.igstRate),
      igstAmount: toDecimal(line.igstAmount),
      cessRate: toDecimal(line.cessRate),
      cessAmount: toDecimal(line.cessAmount),
      lineTotal: toDecimal(line.lineTotal),
      revenueAccountId: line.revenueAccountId,
      costCentreId: line.costCentreId,
    }
  })
}

function headerAmountsFromCalc(calc: SalesInvoiceCalculationResult) {
  const discountAmount = toDecimal(calc.lineDiscountTotal).add(toDecimal(calc.invoiceDiscountAmount))
  return {
    supplyType: calc.supplyType,
    subtotalAmount: toDecimal(calc.subtotalAmount),
    discountAmount,
    taxableAmount: toDecimal(calc.taxableAmount),
    cgstAmount: toDecimal(calc.cgstAmount),
    sgstAmount: toDecimal(calc.sgstAmount),
    igstAmount: toDecimal(calc.igstAmount),
    cessAmount: toDecimal(calc.cessAmount),
    totalTaxAmount: toDecimal(calc.totalTaxAmount),
    roundOffAmount: toDecimal(calc.roundOffAmount),
    totalAmount: toDecimal(calc.totalAmount),
    freightAmount: toDecimal(calc.freightAmount),
    otherChargesAmount: toDecimal(calc.otherChargesAmount),
    baseSubtotalAmount: toDecimal(calc.baseSubtotalAmount),
    baseDiscountAmount: toDecimal(calc.baseDiscountAmount),
    baseTaxableAmount: toDecimal(calc.baseTaxableAmount),
    baseCgstAmount: toDecimal(calc.baseCgstAmount),
    baseSgstAmount: toDecimal(calc.baseSgstAmount),
    baseIgstAmount: toDecimal(calc.baseIgstAmount),
    baseCessAmount: toDecimal(calc.baseCessAmount),
    baseTotalTaxAmount: toDecimal(calc.baseTotalTaxAmount),
    baseRoundOffAmount: toDecimal(calc.baseRoundOffAmount),
    baseTotalAmount: toDecimal(calc.baseTotalAmount),
  }
}

function partySnapshots(party: CustomerParty) {
  return {
    customerCodeSnapshot: party.code,
    customerNameSnapshot: party.name,
    customerGstinSnapshot: party.gstin,
    customerPanSnapshot: party.pan,
    customerStateCodeSnapshot: party.stateCode,
    customerBillingAddressSnapshot: party.billingAddress as unknown as Prisma.InputJsonValue,
    customerShippingAddressSnapshot: party.shippingAddress as unknown as Prisma.InputJsonValue,
  }
}

export async function findSalesInvoiceWithLinesOrThrow(
  tenantId: string,
  id: string,
): Promise<SalesInvoiceWithLines> {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, tenantId },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
  if (!invoice) throw new SalesInvoiceNotFoundError()
  return invoice
}

export async function findSalesInvoiceWithLines(
  tenantId: string,
  id: string,
): Promise<SalesInvoiceWithLines | null> {
  return prisma.salesInvoice.findFirst({
    where: { id, tenantId },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

function assertEditable(invoice: SalesInvoice): void {
  if (invoice.status === 'CANCELLED') throw new SalesInvoiceAlreadyCancelledError()
  if (!EDITABLE_STATUSES.includes(invoice.status as (typeof EDITABLE_STATUSES)[number])) {
    throw new SalesInvoiceNotEditableError()
  }
}

function assertUpdatedAt(invoice: SalesInvoice, updatedAt: string): void {
  const expected = new Date(updatedAt).getTime()
  if (invoice.updatedAt.getTime() !== expected) {
    throw new SalesInvoiceStaleUpdateError()
  }
}

export async function createSalesInvoiceDraft(
  tenantId: string,
  input: CreateSalesInvoiceInput,
  calc: SalesInvoiceCalculationResult,
  party: CustomerParty,
  createdBy: string | undefined,
  options?: {
    sourceDocumentSnapshot?: SalesOrderSourceSnapshot | null
  },
): Promise<SalesInvoiceWithLines> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const { financialYear } = await resolvePeriodByDate(tenantId, input.legalEntityId, input.postingDate)
  const draftReference = await generateUniqueDraftReference(input.legalEntityId)
  const context = buildCalculationContextFromRequest(input)

  return prisma.$transaction(async (tx) => {
    const header = await tx.salesInvoice.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId ?? null,
        financialYearId: financialYear.id,
        invoiceNumber: null,
        draftReference,
        status: 'DRAFT',
        customerId: input.customerId,
        ...partySnapshots(party),
        sourceType: input.sourceType,
        sourceDocumentId: input.sourceDocumentId ?? null,
        sourceDocumentSnapshot: options?.sourceDocumentSnapshot
          ? (options.sourceDocumentSnapshot as unknown as Prisma.InputJsonValue)
          : undefined,
        invoiceDate: parseDateOnly(input.invoiceDate),
        postingDate: parseDateOnly(input.postingDate),
        referenceNumber: input.referenceNumber ?? null,
        customerPoNumber: input.customerPoNumber ?? null,
        paymentTermsDays: input.paymentTermsDays ?? null,
        dueDate: input.dueDate ? parseDateOnly(input.dueDate) : null,
        placeOfSupply: input.placeOfSupply ?? null,
        taxTreatment: input.taxTreatment,
        currencyCode: input.currencyCode,
        exchangeRate: roundExchangeRate(input.exchangeRate),
        narration: input.narration ?? null,
        calculationContext: context as unknown as Prisma.InputJsonValue,
        accountingVoucherId: null,
        postingEventId: null,
        createdBy: createdBy ?? null,
        updatedBy: createdBy ?? null,
        ...headerAmountsFromCalc(calc),
      },
    })

    const lineData = mapLineData(tenantId, input.legalEntityId, header.id, calc, context)
    if (lineData.length > 0) await tx.salesInvoiceLine.createMany({ data: lineData })

    return tx.salesInvoice.findFirstOrThrow({
      where: { id: header.id, tenantId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
  })
}

export async function replaceEditableInvoiceLines(
  tenantId: string,
  invoiceId: string,
  input: UpdateSalesInvoiceInput,
  calc: SalesInvoiceCalculationResult,
  party: CustomerParty,
  updatedBy: string | undefined,
  options?: { reopenFromReady?: boolean },
): Promise<SalesInvoiceWithLines> {
  const existing = await findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
  assertEditable(existing)
  assertUpdatedAt(existing, input.updatedAt)

  const { financialYear } = await resolvePeriodByDate(tenantId, existing.legalEntityId, input.postingDate)
  const context = buildCalculationContextFromRequest(input)
  const nextStatus = options?.reopenFromReady ? 'DRAFT' : existing.status

  return prisma.$transaction(async (tx) => {
    await tx.salesInvoiceLine.deleteMany({ where: { tenantId, salesInvoiceId: invoiceId } })

    await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        branchId: input.branchId ?? null,
        financialYearId: financialYear.id,
        status: nextStatus,
        invoiceNumber: null,
        accountingVoucherId: null,
        postingEventId: null,
        customerId: input.customerId,
        ...partySnapshots(party),
        sourceType: input.sourceType,
        sourceDocumentId: input.sourceDocumentId ?? null,
        invoiceDate: parseDateOnly(input.invoiceDate),
        postingDate: parseDateOnly(input.postingDate),
        referenceNumber: input.referenceNumber ?? null,
        customerPoNumber: input.customerPoNumber ?? null,
        paymentTermsDays: input.paymentTermsDays ?? null,
        dueDate: input.dueDate ? parseDateOnly(input.dueDate) : null,
        placeOfSupply: input.placeOfSupply ?? null,
        taxTreatment: input.taxTreatment,
        currencyCode: input.currencyCode,
        exchangeRate: roundExchangeRate(input.exchangeRate),
        narration: input.narration ?? null,
        calculationContext: context as unknown as Prisma.InputJsonValue,
        updatedBy: updatedBy ?? null,
        ...headerAmountsFromCalc(calc),
      },
    })

    const lineData = mapLineData(tenantId, existing.legalEntityId, invoiceId, calc, context)
    if (lineData.length > 0) await tx.salesInvoiceLine.createMany({ data: lineData })

    return tx.salesInvoice.findFirstOrThrow({
      where: { id: invoiceId, tenantId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
  })
}

export async function persistRecalculatedAmounts(
  tenantId: string,
  invoiceId: string,
  calc: SalesInvoiceCalculationResult,
  context: SalesInvoiceCalculationContext,
  updatedBy?: string,
): Promise<SalesInvoiceWithLines> {
  return prisma.$transaction(async (tx) => {
    await tx.salesInvoiceLine.deleteMany({ where: { tenantId, salesInvoiceId: invoiceId } })
    const invoice = await tx.salesInvoice.findFirstOrThrow({ where: { id: invoiceId, tenantId } })
    await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        ...headerAmountsFromCalc(calc),
        calculationContext: context as unknown as Prisma.InputJsonValue,
        updatedBy: updatedBy ?? null,
      },
    })
    const lineData = mapLineData(tenantId, invoice.legalEntityId, invoiceId, calc, context)
    if (lineData.length > 0) await tx.salesInvoiceLine.createMany({ data: lineData })
    return tx.salesInvoice.findFirstOrThrow({
      where: { id: invoiceId, tenantId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
  })
}

export async function markSalesInvoiceReady(
  tenantId: string,
  invoiceId: string,
  updatedBy?: string,
): Promise<SalesInvoiceWithLines> {
  const invoice = await findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
  if (invoice.status !== 'DRAFT') throw new SalesInvoiceInvalidStatusError('Only draft invoices can be marked ready')
  await prisma.salesInvoice.update({
    where: { id: invoiceId },
    data: { status: 'READY_TO_POST', updatedBy: updatedBy ?? null },
  })
  return findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
}

export async function cancelSalesInvoiceDraft(
  tenantId: string,
  invoiceId: string,
  cancellationReason: string,
  cancelledBy?: string,
): Promise<SalesInvoiceWithLines> {
  const invoice = await findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
  if (invoice.status === 'CANCELLED') throw new SalesInvoiceAlreadyCancelledError()
  if (!EDITABLE_STATUSES.includes(invoice.status as (typeof EDITABLE_STATUSES)[number])) {
    throw new SalesInvoiceInvalidStatusError('Only draft or ready invoices can be cancelled')
  }
  await prisma.salesInvoice.update({
    where: { id: invoiceId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: cancelledBy ?? null,
      cancellationReason,
      updatedBy: cancelledBy ?? null,
    },
  })
  return findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
}

export async function listSalesInvoiceRecords(
  tenantId: string,
  query: ListSalesInvoicesQuery,
): Promise<{ items: SalesInvoiceWithLines[]; total: number; page: number; limit: number }> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const limit = query.limit ?? query.pageSize ?? 20
  const sortField = query.sort ?? 'invoiceDate'
  const sortOrder = query.sortOrder ?? 'desc'
  const { skip, take, page } = getPagination({ page: query.page ?? 1, limit, sortOrder })

  const where: Prisma.SalesInvoiceWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.sourceType ? { sourceType: query.sourceType } : {}),
    ...(query.currencyCode ? { currencyCode: query.currencyCode } : {}),
    ...(query.createdBy ? { createdBy: query.createdBy } : {}),
    ...(query.invoiceDateFrom || query.invoiceDateTo
      ? {
          invoiceDate: {
            ...(query.invoiceDateFrom ? { gte: parseDateOnly(query.invoiceDateFrom) } : {}),
            ...(query.invoiceDateTo ? { lte: parseDateOnly(query.invoiceDateTo) } : {}),
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
    ...(query.dueDateFrom || query.dueDateTo
      ? {
          dueDate: {
            ...(query.dueDateFrom ? { gte: parseDateOnly(query.dueDateFrom) } : {}),
            ...(query.dueDateTo ? { lte: parseDateOnly(query.dueDateTo) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { draftReference: { contains: query.search } },
            { invoiceNumber: { contains: query.search } },
            { customerNameSnapshot: { contains: query.search } },
            { customerCodeSnapshot: { contains: query.search } },
            { referenceNumber: { contains: query.search } },
            { customerPoNumber: { contains: query.search } },
          ],
        }
      : {}),
  }

  const orderBy: Prisma.SalesInvoiceOrderByWithRelationInput = { [sortField]: sortOrder }

  const [items, total] = await Promise.all([
    prisma.salesInvoice.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    }),
    prisma.salesInvoice.count({ where }),
  ])

  return { items, total, page, limit }
}

export function mapLineRecord(line: SalesInvoiceLine) {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    sourceLineId: line.sourceLineId,
    itemId: line.itemId,
    itemCodeSnapshot: line.itemCodeSnapshot,
    itemNameSnapshot: line.itemNameSnapshot,
    hsnCodeSnapshot: line.hsnCodeSnapshot,
    uomSnapshot: line.uomSnapshot,
    description: line.description,
    quantity: toDecimal(line.quantity).toFixed(6),
    unitRate: formatForPersistence(line.unitRate),
    grossAmount: formatForPersistence(line.grossAmount),
    discountPercent: formatForPersistence(line.discountPercent, 4),
    discountAmount: formatForPersistence(line.discountAmount),
    taxableAmount: formatForPersistence(line.taxableAmount),
    cgstRate: formatForPersistence(line.cgstRate, 4),
    cgstAmount: formatForPersistence(line.cgstAmount),
    sgstRate: formatForPersistence(line.sgstRate, 4),
    sgstAmount: formatForPersistence(line.sgstAmount),
    igstRate: formatForPersistence(line.igstRate, 4),
    igstAmount: formatForPersistence(line.igstAmount),
    cessRate: formatForPersistence(line.cessRate, 4),
    cessAmount: formatForPersistence(line.cessAmount),
    lineTotal: formatForPersistence(line.lineTotal),
    revenueAccountId: line.revenueAccountId,
    costCentreId: line.costCentreId,
  }
}

export function mapInvoiceRecord(invoice: SalesInvoice, lines?: SalesInvoiceLine[]) {
  const totalAmount = formatForPersistence(invoice.totalAmount)
  return {
    id: invoice.id,
    tenantId: invoice.tenantId,
    legalEntityId: invoice.legalEntityId,
    branchId: invoice.branchId,
    financialYearId: invoice.financialYearId,
    invoiceNumber: invoice.invoiceNumber,
    draftReference: invoice.draftReference,
    status: invoice.status,
    customerId: invoice.customerId,
    customerCodeSnapshot: invoice.customerCodeSnapshot,
    customerNameSnapshot: invoice.customerNameSnapshot,
    customerGstinSnapshot: invoice.customerGstinSnapshot,
    customerPanSnapshot: invoice.customerPanSnapshot,
    customerStateCodeSnapshot: invoice.customerStateCodeSnapshot,
    customerBillingAddressSnapshot: invoice.customerBillingAddressSnapshot as Record<string, unknown> | null,
    customerShippingAddressSnapshot: invoice.customerShippingAddressSnapshot as Record<string, unknown> | null,
    sourceType: invoice.sourceType,
    sourceDocumentId: invoice.sourceDocumentId,
    sourceDocumentSnapshot: invoice.sourceDocumentSnapshot as Record<string, unknown> | null,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    postingDate: invoice.postingDate ? invoice.postingDate.toISOString().slice(0, 10) : null,
    referenceNumber: invoice.referenceNumber,
    customerPoNumber: invoice.customerPoNumber,
    paymentTermsDays: invoice.paymentTermsDays,
    freightAmount: formatForPersistence(invoice.freightAmount),
    otherChargesAmount: formatForPersistence(invoice.otherChargesAmount),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
    placeOfSupply: invoice.placeOfSupply,
    supplyType: invoice.supplyType,
    taxTreatment: invoice.taxTreatment,
    currencyCode: invoice.currencyCode,
    exchangeRate: roundExchangeRate(invoice.exchangeRate).toFixed(8),
    subtotalAmount: formatForPersistence(invoice.subtotalAmount),
    discountAmount: formatForPersistence(invoice.discountAmount),
    taxableAmount: formatForPersistence(invoice.taxableAmount),
    cgstAmount: formatForPersistence(invoice.cgstAmount),
    sgstAmount: formatForPersistence(invoice.sgstAmount),
    igstAmount: formatForPersistence(invoice.igstAmount),
    cessAmount: formatForPersistence(invoice.cessAmount),
    totalTaxAmount: formatForPersistence(invoice.totalTaxAmount),
    roundOffAmount: formatForPersistence(invoice.roundOffAmount),
    totalAmount,
    outstandingAmount: totalAmount,
    amountPaid: '0.0000',
    amountAdjusted: '0.0000',
    baseSubtotalAmount: formatForPersistence(invoice.baseSubtotalAmount),
    baseDiscountAmount: formatForPersistence(invoice.baseDiscountAmount),
    baseTaxableAmount: formatForPersistence(invoice.baseTaxableAmount),
    baseCgstAmount: formatForPersistence(invoice.baseCgstAmount),
    baseSgstAmount: formatForPersistence(invoice.baseSgstAmount),
    baseIgstAmount: formatForPersistence(invoice.baseIgstAmount),
    baseCessAmount: formatForPersistence(invoice.baseCessAmount),
    baseTotalTaxAmount: formatForPersistence(invoice.baseTotalTaxAmount),
    baseRoundOffAmount: formatForPersistence(invoice.baseRoundOffAmount),
    baseTotalAmount: formatForPersistence(invoice.baseTotalAmount),
    narration: invoice.narration,
    accountingVoucherId: invoice.accountingVoucherId,
    postingEventId: invoice.postingEventId,
    postedAt: invoice.postedAt?.toISOString() ?? null,
    postedBy: invoice.postedBy,
    cancelledAt: invoice.cancelledAt?.toISOString() ?? null,
    cancelledBy: invoice.cancelledBy,
    cancellationReason: invoice.cancellationReason,
    createdBy: invoice.createdBy,
    updatedBy: invoice.updatedBy,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    ...(lines ? { lines: lines.map(mapLineRecord) } : {}),
  }
}

/** @deprecated Use findSalesInvoiceWithLines — foundation-test compatibility */
export async function findSalesInvoiceById(
  tenantId: string,
  id: string,
  options?: { includeLines?: boolean },
) {
  if (options?.includeLines) {
    const invoice = await prisma.salesInvoice.findFirst({
      where: { id, tenantId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
    if (!invoice) return null
    return mapInvoiceRecord(invoice, invoice.lines)
  }
  const invoice = await prisma.salesInvoice.findFirst({ where: { id, tenantId } })
  if (!invoice) return null
  return mapInvoiceRecord(invoice)
}

/** @deprecated Use listSalesInvoiceRecords + read service — foundation-test compatibility */
export async function listSalesInvoices(tenantId: string, query: ListSalesInvoicesQuery) {
  const result = await listSalesInvoiceRecords(tenantId, query)
  return {
    ...result,
    items: result.items.map((i) => mapInvoiceRecord(i, i.lines)),
  }
}

export async function findSalesInvoiceRecordById(tenantId: string, id: string) {
  return prisma.salesInvoice.findFirst({ where: { id, tenantId } })
}

export async function findSalesInvoiceLinesByInvoiceId(tenantId: string, salesInvoiceId: string) {
  const invoice = await prisma.salesInvoice.findFirst({ where: { id: salesInvoiceId, tenantId } })
  if (!invoice) throw new SalesInvoiceNotFoundError()
  const lines = await prisma.salesInvoiceLine.findMany({
    where: { tenantId, salesInvoiceId },
    orderBy: { lineNumber: 'asc' },
  })
  return lines.map(mapLineRecord)
}

export async function findSalesInvoiceLineById(tenantId: string, lineId: string) {
  const line = await prisma.salesInvoiceLine.findFirst({ where: { id: lineId, tenantId } })
  return line ? mapLineRecord(line) : null
}

export const mapSalesInvoiceToDto = mapInvoiceRecord
