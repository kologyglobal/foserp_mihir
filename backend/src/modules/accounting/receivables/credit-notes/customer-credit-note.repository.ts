import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { parseDateOnly } from '../../shared/finance.helpers.js'
import { roundExchangeRate, toDecimal } from '../../shared/finance-decimal.js'
import type { CustomerParty } from '../customer-party/customer-party.types.js'
import type { CreateCustomerCreditNoteInput, ListCustomerCreditNotesQuery, UpdateCustomerCreditNoteInput } from './customer-credit-note.schemas.js'
import type { CustomerCreditNoteCalculation, CustomerCreditNoteWithLines } from './customer-credit-note.types.js'
import { CustomerCreditNoteInvalidStatusError, CustomerCreditNoteNotFoundError, CustomerCreditNoteStaleUpdateError } from './customer-credit-note.errors.js'

export async function findWithLinesOrThrow(tenantId: string, id: string): Promise<CustomerCreditNoteWithLines> {
  const note = await prisma.customerCreditNote.findFirst({
    where: { id, tenantId },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
  if (!note) throw new CustomerCreditNoteNotFoundError()
  return note
}

function snapshots(party: CustomerParty) {
  return {
    customerCodeSnapshot: party.code,
    customerNameSnapshot: party.name,
    customerGstinSnapshot: party.gstin,
    customerPanSnapshot: party.pan,
    customerStateCodeSnapshot: party.stateCode,
    customerBillingAddressSnapshot: party.billingAddress as unknown as Prisma.InputJsonValue,
  }
}

function amounts(calc: CustomerCreditNoteCalculation) {
  return {
    taxableAmount: toDecimal(calc.taxableAmount),
    cgstAmount: toDecimal(calc.cgstAmount),
    sgstAmount: toDecimal(calc.sgstAmount),
    igstAmount: toDecimal(calc.igstAmount),
    cessAmount: toDecimal(calc.cessAmount),
    totalTaxAmount: toDecimal(calc.totalTaxAmount),
    discountAmount: toDecimal(calc.discountAmount),
    freightAmount: toDecimal(calc.freightAmount),
    otherChargesAmount: toDecimal(calc.otherChargesAmount),
    roundOffAmount: toDecimal(calc.roundOffAmount),
    grandTotal: toDecimal(calc.grandTotal),
    baseTaxableAmount: toDecimal(calc.baseTaxableAmount),
    baseCgstAmount: toDecimal(calc.baseCgstAmount),
    baseSgstAmount: toDecimal(calc.baseSgstAmount),
    baseIgstAmount: toDecimal(calc.baseIgstAmount),
    baseCessAmount: toDecimal(calc.baseCessAmount),
    baseTotalTaxAmount: toDecimal(calc.baseTotalTaxAmount),
    baseDiscountAmount: toDecimal(calc.baseDiscountAmount),
    baseFreightAmount: toDecimal(calc.baseFreightAmount),
    baseOtherChargesAmount: toDecimal(calc.baseOtherChargesAmount),
    baseRoundOffAmount: toDecimal(calc.baseRoundOffAmount),
    baseGrandTotal: toDecimal(calc.baseGrandTotal),
  }
}

function lineData(tenantId: string, legalEntityId: string, noteId: string, calc: CustomerCreditNoteCalculation) {
  return calc.lines.map((line) => ({
    tenantId,
    legalEntityId,
    customerCreditNoteId: noteId,
    lineNumber: line.lineNumber,
    originalInvoiceLineId: line.originalInvoiceLineId,
    itemId: line.itemId,
    itemCodeSnapshot: line.itemCodeSnapshot,
    itemNameSnapshot: line.itemNameSnapshot,
    hsnCodeSnapshot: line.hsnCodeSnapshot,
    uomSnapshot: line.uomSnapshot,
    description: line.description,
    adjustmentMode: line.adjustmentMode,
    quantity: toDecimal(line.quantity),
    unitRate: toDecimal(line.unitRate),
    revisedUnitRate: line.revisedUnitRate ? toDecimal(line.revisedUnitRate) : null,
    grossAmount: toDecimal(line.grossAmount),
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
    lineTotal: toDecimal(line.lineTotal),
    revenueReversalAccountId: line.revenueReversalAccountId,
    costCentreId: line.costCentreId,
  }))
}

function draftReference() {
  return `CN-DRAFT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

export async function createDraft(
  tenantId: string,
  input: CreateCustomerCreditNoteInput,
  calc: CustomerCreditNoteCalculation,
  party: CustomerParty,
  source: { invoiceNumber: string | null; supplyType: CustomerCreditNoteWithLines['supplyType']; taxTreatment: CustomerCreditNoteWithLines['taxTreatment'] } | null,
  reason: { id: string; code: string; name: string } | null,
  financialYearId: string,
  userId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const note = await tx.customerCreditNote.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId ?? null,
        financialYearId,
        draftReference: draftReference(),
        purpose: input.purpose,
        reasonId: reason?.id ?? null,
        reasonCodeSnapshot: reason?.code ?? null,
        reasonNameSnapshot: reason?.name ?? null,
        sourceType: input.sourceType,
        originalInvoiceId: input.originalInvoiceId ?? null,
        originalInvoiceNumberSnapshot: source?.invoiceNumber ?? null,
        customerId: input.customerId,
        ...snapshots(party),
        creditNoteDate: parseDateOnly(input.creditNoteDate),
        postingDate: parseDateOnly(input.postingDate),
        supplyType: input.supplyType ?? source?.supplyType ?? 'INTRA_STATE',
        taxTreatment: input.taxTreatment ?? source?.taxTreatment ?? 'REGISTERED',
        currencyCode: input.currencyCode,
        exchangeRate: roundExchangeRate(input.exchangeRate),
        calculationContext: input as unknown as Prisma.InputJsonValue,
        inventoryReturnRequired: input.inventoryReturnRequired,
        inventoryReturnMetadata: input.inventoryReturnMetadata as Prisma.InputJsonValue | undefined,
        approvalRequired: input.approvalRequired,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        ...amounts(calc),
      },
    })
    await tx.customerCreditNoteLine.createMany({ data: lineData(tenantId, input.legalEntityId, note.id, calc) })
    return tx.customerCreditNote.findFirstOrThrow({ where: { id: note.id, tenantId }, include: { lines: true } })
  })
}

export async function replaceDraft(
  tenantId: string,
  id: string,
  input: UpdateCustomerCreditNoteInput,
  calc: CustomerCreditNoteCalculation,
  party: CustomerParty,
  source: { invoiceNumber: string | null; supplyType: CustomerCreditNoteWithLines['supplyType']; taxTreatment: CustomerCreditNoteWithLines['taxTreatment'] } | null,
  reason: { id: string; code: string; name: string } | null,
  financialYearId: string,
  userId?: string,
) {
  const existing = await findWithLinesOrThrow(tenantId, id)
  if (!['DRAFT', 'READY_TO_POST', 'REJECTED'].includes(existing.status)) throw new CustomerCreditNoteInvalidStatusError('Credit note is not editable')
  if (existing.updatedAt.getTime() !== new Date(input.updatedAt).getTime()) throw new CustomerCreditNoteStaleUpdateError()
  return prisma.$transaction(async (tx) => {
    await tx.customerCreditNoteLine.deleteMany({ where: { tenantId, customerCreditNoteId: id } })
    await tx.customerCreditNote.update({
      where: { id, tenantId },
      data: {
        branchId: input.branchId ?? null,
        financialYearId,
        status: 'DRAFT',
        purpose: input.purpose,
        reasonId: reason?.id ?? null,
        reasonCodeSnapshot: reason?.code ?? null,
        reasonNameSnapshot: reason?.name ?? null,
        sourceType: input.sourceType,
        originalInvoiceId: input.originalInvoiceId ?? null,
        originalInvoiceNumberSnapshot: source?.invoiceNumber ?? null,
        customerId: input.customerId,
        ...snapshots(party),
        creditNoteDate: parseDateOnly(input.creditNoteDate),
        postingDate: parseDateOnly(input.postingDate),
        supplyType: input.supplyType ?? source?.supplyType ?? 'INTRA_STATE',
        taxTreatment: input.taxTreatment ?? source?.taxTreatment ?? 'REGISTERED',
        currencyCode: input.currencyCode,
        exchangeRate: roundExchangeRate(input.exchangeRate),
        calculationContext: input as unknown as Prisma.InputJsonValue,
        inventoryReturnRequired: input.inventoryReturnRequired,
        inventoryReturnMetadata: input.inventoryReturnMetadata as Prisma.InputJsonValue | undefined,
        approvalRequired: input.approvalRequired,
        approvalRequestId: null,
        updatedBy: userId ?? null,
        ...amounts(calc),
      },
    })
    await tx.customerCreditNoteLine.createMany({ data: lineData(tenantId, existing.legalEntityId, id, calc) })
    return tx.customerCreditNote.findFirstOrThrow({ where: { id, tenantId }, include: { lines: true } })
  })
}

export async function list(tenantId: string, query: ListCustomerCreditNotesQuery) {
  const { skip, take, page } = getPagination(query)
  const where: Prisma.CustomerCreditNoteWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.originalInvoiceId ? { originalInvoiceId: query.originalInvoiceId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.purpose ? { purpose: query.purpose } : {}),
    ...(query.search ? { OR: [
      { creditNoteNumber: { contains: query.search } },
      { draftReference: { contains: query.search } },
      { customerNameSnapshot: { contains: query.search } },
      { originalInvoiceNumberSnapshot: { contains: query.search } },
    ] } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.customerCreditNote.findMany({ where, include: { lines: { orderBy: { lineNumber: 'asc' } } }, skip, take, orderBy: { createdAt: query.sortOrder } }),
    prisma.customerCreditNote.count({ where }),
  ])
  return { items, total, page, limit: query.limit }
}

/** Internal: conditional credit-note allocation balance update (Phase 3C5). Not HTTP-routable. */
export async function updateCreditNoteAfterAllocation(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string
    legalEntityId: string
    creditNoteId: string
    expectedAllocatedAmount: Prisma.Decimal | string
    expectedUnallocatedAmount: Prisma.Decimal | string
    expectedBaseAllocatedAmount: Prisma.Decimal | string
    expectedBaseUnallocatedAmount: Prisma.Decimal | string
    allocationAmount: Prisma.Decimal | string
    baseAllocationAmount: Prisma.Decimal | string
    updatedBy?: string | null
  },
): Promise<number> {
  const result = await tx.customerCreditNote.updateMany({
    where: {
      id: input.creditNoteId,
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

/** Internal: conditional credit-note allocated/unallocated revert after allocation reverse. Not HTTP-routable. */
export async function updateCreditNoteAfterAllocationReverse(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string
    legalEntityId: string
    creditNoteId: string
    expectedAllocatedAmount: Prisma.Decimal | string
    expectedUnallocatedAmount: Prisma.Decimal | string
    expectedBaseAllocatedAmount: Prisma.Decimal | string
    expectedBaseUnallocatedAmount: Prisma.Decimal | string
    allocationAmount: Prisma.Decimal | string
    baseAllocationAmount: Prisma.Decimal | string
    updatedBy?: string | null
  },
): Promise<number> {
  const result = await tx.customerCreditNote.updateMany({
    where: {
      id: input.creditNoteId,
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      status: 'POSTED',
      allocatedAmount: input.expectedAllocatedAmount,
      unallocatedAmount: input.expectedUnallocatedAmount,
      baseAllocatedAmount: input.expectedBaseAllocatedAmount,
      baseUnallocatedAmount: input.expectedBaseUnallocatedAmount,
    },
    data: {
      allocatedAmount: { decrement: input.allocationAmount },
      unallocatedAmount: { increment: input.allocationAmount },
      baseAllocatedAmount: { decrement: input.baseAllocationAmount },
      baseUnallocatedAmount: { increment: input.baseAllocationAmount },
      updatedBy: input.updatedBy ?? null,
    },
  })
  return result.count
}
