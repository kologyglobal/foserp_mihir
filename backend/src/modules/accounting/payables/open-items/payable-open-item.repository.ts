import type { PayableOpenItem } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import { PayableOpenItemDuplicateSourceError } from './payable-open-item.errors.js'
import type { CreatePayableOpenItemRecordInput } from './payable-open-item.types.js'

export async function findPayableOpenItemById(
  tenantId: string,
  legalEntityId: string,
  id: string,
): Promise<PayableOpenItem | null> {
  return prisma.payableOpenItem.findFirst({
    where: { id, tenantId, legalEntityId },
  })
}

export async function findPayableOpenItemBySourceVendorInvoice(
  tenantId: string,
  legalEntityId: string,
  sourceVendorInvoiceId: string,
): Promise<PayableOpenItem | null> {
  return prisma.payableOpenItem.findFirst({
    where: { tenantId, legalEntityId, sourceVendorInvoiceId },
  })
}

export async function findPayableOpenItemBySourceVendorPayment(
  tenantId: string,
  legalEntityId: string,
  sourceVendorPaymentId: string,
): Promise<PayableOpenItem | null> {
  return prisma.payableOpenItem.findFirst({
    where: { tenantId, legalEntityId, sourceVendorPaymentId },
  })
}

export async function findPayableOpenItemBySourceVendorAdjustment(
  tenantId: string,
  legalEntityId: string,
  sourceVendorAdjustmentId: string,
): Promise<PayableOpenItem | null> {
  return prisma.payableOpenItem.findFirst({
    where: { tenantId, legalEntityId, sourceVendorAdjustmentId },
  })
}

/**
 * Controlled create for foundation tests / future posting services.
 * Does not auto-create from VendorInvoice — callers must pass amounts explicitly.
 */
export async function createPayableOpenItemRecord(
  input: CreatePayableOpenItemRecordInput,
): Promise<PayableOpenItem> {
  await getLegalEntityOrThrow(input.tenantId, input.legalEntityId)

  try {
    return await prisma.payableOpenItem.create({
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
        currencyCode: input.currencyCode ?? 'INR',
        exchangeRate: toDecimal(input.exchangeRate ?? 1),
        originalAmount: toDecimal(input.originalAmount),
        allocatedAmount: toDecimal(input.allocatedAmount ?? 0),
        adjustedAmount: toDecimal(input.adjustedAmount ?? 0),
        writtenOffAmount: toDecimal(input.writtenOffAmount ?? 0),
        outstandingAmount: toDecimal(input.outstandingAmount),
        baseOriginalAmount: toDecimal(input.baseOriginalAmount),
        baseAllocatedAmount: toDecimal(input.baseAllocatedAmount ?? 0),
        baseAdjustedAmount: toDecimal(input.baseAdjustedAmount ?? 0),
        baseWrittenOffAmount: toDecimal(input.baseWrittenOffAmount ?? 0),
        baseOutstandingAmount: toDecimal(input.baseOutstandingAmount),
        status: input.status ?? 'OPEN',
        isDisputed: input.isDisputed ?? false,
        isOnHold: input.isOnHold ?? false,
        vendorPayableAccountId: input.vendorPayableAccountId,
        sourceVendorInvoiceId: input.sourceVendorInvoiceId ?? null,
        sourceVendorPaymentId: input.sourceVendorPaymentId ?? null,
        sourceVendorAdjustmentId: input.sourceVendorAdjustmentId ?? null,
        accountingVoucherId: input.accountingVoucherId ?? null,
        postingEventId: input.postingEventId ?? null,
        createdBy: input.createdBy ?? null,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new PayableOpenItemDuplicateSourceError()
    }
    throw err
  }
}

type AllocationTx = Prisma.TransactionClient

export interface ApplyPayableAllocationInput {
  tenantId: string
  legalEntityId: string
  openItemId: string
  expectedOutstandingAmount: Prisma.Decimal | string
  expectedAllocatedAmount: Prisma.Decimal | string
  expectedBaseOutstandingAmount: Prisma.Decimal | string
  expectedBaseAllocatedAmount: Prisma.Decimal | string
  allocationAmount: Prisma.Decimal | string
  baseAllocationAmount: Prisma.Decimal | string
  newStatus: 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED'
  settledAt: Date | null
  updatedBy?: string | null
}

/**
 * Internal: conditional DEBIT payable open-item balance update for payment allocation (Phase 4B4).
 * Increases allocatedAmount, decreases outstandingAmount. Optimistic guard on exact balances +
 * allocatable status. Creates no GL. Not HTTP-routable.
 */
export async function applyDebitAllocation(
  tx: AllocationTx,
  input: ApplyPayableAllocationInput,
): Promise<number> {
  const result = await tx.payableOpenItem.updateMany({
    where: {
      id: input.openItemId,
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      side: 'DEBIT',
      outstandingAmount: input.expectedOutstandingAmount,
      allocatedAmount: input.expectedAllocatedAmount,
      baseOutstandingAmount: input.expectedBaseOutstandingAmount,
      baseAllocatedAmount: input.expectedBaseAllocatedAmount,
      status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
      reversedAt: null,
    },
    data: {
      outstandingAmount: { decrement: input.allocationAmount },
      allocatedAmount: { increment: input.allocationAmount },
      baseOutstandingAmount: { decrement: input.baseAllocationAmount },
      baseAllocatedAmount: { increment: input.baseAllocationAmount },
      status: input.newStatus,
      settledAt: input.settledAt,
      updatedBy: input.updatedBy ?? null,
    },
  })
  return result.count
}

/**
 * Internal: conditional CREDIT payable open-item balance update for payment allocation (Phase 4B4).
 * Mirror of applyDebitAllocation for the CREDIT (vendor invoice) target side. Not HTTP-routable.
 */
export async function applyCreditAllocation(
  tx: AllocationTx,
  input: ApplyPayableAllocationInput,
): Promise<number> {
  const result = await tx.payableOpenItem.updateMany({
    where: {
      id: input.openItemId,
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      side: 'CREDIT',
      outstandingAmount: input.expectedOutstandingAmount,
      allocatedAmount: input.expectedAllocatedAmount,
      baseOutstandingAmount: input.expectedBaseOutstandingAmount,
      baseAllocatedAmount: input.expectedBaseAllocatedAmount,
      status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
      reversedAt: null,
    },
    data: {
      outstandingAmount: { decrement: input.allocationAmount },
      allocatedAmount: { increment: input.allocationAmount },
      baseOutstandingAmount: { decrement: input.baseAllocationAmount },
      baseAllocatedAmount: { increment: input.baseAllocationAmount },
      status: input.newStatus,
      settledAt: input.settledAt,
      updatedBy: input.updatedBy ?? null,
    },
  })
  return result.count
}

/**
 * Internal: conditional DEBIT open-item revert for allocation reversal (Phase 4C1).
 * Increments outstanding, decrements allocated. Creates no GL. Not HTTP-routable.
 */
export async function revertDebitAllocation(
  tx: AllocationTx,
  input: ApplyPayableAllocationInput,
): Promise<number> {
  const result = await tx.payableOpenItem.updateMany({
    where: {
      id: input.openItemId,
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      side: 'DEBIT',
      outstandingAmount: input.expectedOutstandingAmount,
      allocatedAmount: input.expectedAllocatedAmount,
      baseOutstandingAmount: input.expectedBaseOutstandingAmount,
      baseAllocatedAmount: input.expectedBaseAllocatedAmount,
      status: { in: ['OPEN', 'PARTIALLY_SETTLED', 'SETTLED'] },
      reversedAt: null,
    },
    data: {
      outstandingAmount: { increment: input.allocationAmount },
      allocatedAmount: { decrement: input.allocationAmount },
      baseOutstandingAmount: { increment: input.baseAllocationAmount },
      baseAllocatedAmount: { decrement: input.baseAllocationAmount },
      status: input.newStatus,
      settledAt: input.settledAt,
      updatedBy: input.updatedBy ?? null,
    },
  })
  return result.count
}

/**
 * Internal: conditional CREDIT open-item revert for allocation reversal (Phase 4C1).
 * Mirror of revertDebitAllocation for invoice CREDIT targets. Not HTTP-routable.
 */
export async function revertCreditAllocation(
  tx: AllocationTx,
  input: ApplyPayableAllocationInput,
): Promise<number> {
  const result = await tx.payableOpenItem.updateMany({
    where: {
      id: input.openItemId,
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      side: 'CREDIT',
      outstandingAmount: input.expectedOutstandingAmount,
      allocatedAmount: input.expectedAllocatedAmount,
      baseOutstandingAmount: input.expectedBaseOutstandingAmount,
      baseAllocatedAmount: input.expectedBaseAllocatedAmount,
      status: { in: ['OPEN', 'PARTIALLY_SETTLED', 'SETTLED'] },
      reversedAt: null,
    },
    data: {
      outstandingAmount: { increment: input.allocationAmount },
      allocatedAmount: { decrement: input.allocationAmount },
      baseOutstandingAmount: { increment: input.baseAllocationAmount },
      baseAllocatedAmount: { decrement: input.baseAllocationAmount },
      status: input.newStatus,
      settledAt: input.settledAt,
      updatedBy: input.updatedBy ?? null,
    },
  })
  return result.count
}

/**
 * Read-only aggregate of vendor CREDIT vs DEBIT outstanding (Phase 4B2).
 * No mutations. Filters OPEN / PARTIALLY_SETTLED, non-reversed items.
 */
export async function findVendorPayableOpenItemPosition(params: {
  tenantId: string
  legalEntityId: string
  vendorId: string
  currencyCode: string
}): Promise<{ creditOutstanding: string; debitOutstanding: string }> {
  const rows = await prisma.payableOpenItem.groupBy({
    by: ['side'],
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      vendorId: params.vendorId,
      currencyCode: params.currencyCode,
      reversedAt: null,
      status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
    },
    _sum: { outstandingAmount: true },
  })

  let creditOutstanding = '0.0000'
  let debitOutstanding = '0.0000'
  for (const row of rows) {
    const sum = toDecimal(row._sum.outstandingAmount ?? 0).toFixed(4)
    if (row.side === 'CREDIT') creditOutstanding = sum
    if (row.side === 'DEBIT') debitOutstanding = sum
  }
  return { creditOutstanding, debitOutstanding }
}
