import type { CustomerCreditNoteAllocationBatch, Prisma } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { formatForPersistence, roundExchangeRate } from '../../../shared/finance-decimal.js'
import type { CustomerCreditNoteAllocationBatchDto } from './customer-credit-note-allocation.types.js'

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function mapCreditNoteAllocationBatchToDto(
  batch: CustomerCreditNoteAllocationBatch,
): CustomerCreditNoteAllocationBatchDto {
  return {
    id: batch.id,
    tenantId: batch.tenantId,
    legalEntityId: batch.legalEntityId,
    creditNoteId: batch.creditNoteId,
    creditNoteOpenItemId: batch.creditNoteOpenItemId,
    customerId: batch.customerId,
    idempotencyKey: batch.idempotencyKey,
    payloadHash: batch.payloadHash,
    status: batch.status,
    allocationDate: formatDate(batch.allocationDate)!,
    currencyCode: batch.currencyCode,
    exchangeRate: roundExchangeRate(batch.exchangeRate).toFixed(8),
    totalAllocatedAmount: formatForPersistence(batch.totalAllocatedAmount),
    baseTotalAllocatedAmount: formatForPersistence(batch.baseTotalAllocatedAmount),
    allocationCount: batch.allocationCount,
    attemptCount: batch.attemptCount,
    createdBy: batch.createdBy,
    createdAt: batch.createdAt.toISOString(),
    completedAt: batch.completedAt?.toISOString() ?? null,
    failedAt: batch.failedAt?.toISOString() ?? null,
    failureCode: batch.failureCode,
    failureMessage: batch.failureMessage,
  }
}

export async function findCreditNoteAllocationBatchByIdempotencyKey(
  tenantId: string,
  creditNoteId: string,
  idempotencyKey: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerCreditNoteAllocationBatch | null> {
  return tx.customerCreditNoteAllocationBatch.findFirst({
    where: { tenantId, creditNoteId, idempotencyKey },
  })
}

export async function createCreditNoteAllocationBatch(
  data: {
    tenantId: string
    legalEntityId: string
    creditNoteId: string
    creditNoteOpenItemId: string
    customerId: string
    idempotencyKey: string
    payloadHash: string
    allocationDate: Date
    currencyCode: string
    exchangeRate: Prisma.Decimal | string
    createdBy?: string | null
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerCreditNoteAllocationBatch> {
  return tx.customerCreditNoteAllocationBatch.create({
    data: {
      tenantId: data.tenantId,
      legalEntityId: data.legalEntityId,
      creditNoteId: data.creditNoteId,
      creditNoteOpenItemId: data.creditNoteOpenItemId,
      customerId: data.customerId,
      idempotencyKey: data.idempotencyKey,
      payloadHash: data.payloadHash,
      status: 'PROCESSING',
      allocationDate: data.allocationDate,
      currencyCode: data.currencyCode,
      exchangeRate: data.exchangeRate,
      createdBy: data.createdBy ?? null,
    },
  })
}

export async function markCreditNoteAllocationBatchPosted(
  batchId: string,
  totals: {
    totalAllocatedAmount: Prisma.Decimal | string
    baseTotalAllocatedAmount: Prisma.Decimal | string
    allocationCount: number
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerCreditNoteAllocationBatch> {
  return tx.customerCreditNoteAllocationBatch.update({
    where: { id: batchId },
    data: {
      status: 'POSTED',
      totalAllocatedAmount: totals.totalAllocatedAmount,
      baseTotalAllocatedAmount: totals.baseTotalAllocatedAmount,
      allocationCount: totals.allocationCount,
      completedAt: new Date(),
      failedAt: null,
      failureCode: null,
      failureMessage: null,
    },
  })
}

export async function resetFailedCreditNoteAllocationBatchForRetry(
  batchId: string,
  data: { allocationDate: Date; payloadHash: string },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerCreditNoteAllocationBatch> {
  return tx.customerCreditNoteAllocationBatch.update({
    where: { id: batchId },
    data: {
      status: 'PROCESSING',
      attemptCount: { increment: 1 },
      failedAt: null,
      failureCode: null,
      failureMessage: null,
      allocationDate: data.allocationDate,
      payloadHash: data.payloadHash,
      totalAllocatedAmount: 0,
      baseTotalAllocatedAmount: 0,
      allocationCount: 0,
      completedAt: null,
    },
  })
}
