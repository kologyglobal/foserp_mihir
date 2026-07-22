import type { CustomerReceiptAllocationBatch, Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence, roundExchangeRate } from '../../shared/finance-decimal.js'
import type { CustomerReceiptAllocationBatchDto } from './customer-receipt-allocation.types.js'

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function mapAllocationBatchToDto(batch: CustomerReceiptAllocationBatch): CustomerReceiptAllocationBatchDto {
  return {
    id: batch.id,
    tenantId: batch.tenantId,
    legalEntityId: batch.legalEntityId,
    receiptId: batch.receiptId,
    receiptOpenItemId: batch.receiptOpenItemId,
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
    reversedAt: batch.reversedAt?.toISOString() ?? null,
    reversedBy: batch.reversedBy,
    reversalReason: batch.reversalReason,
  }
}

export async function findBatchByIdempotencyKey(
  tenantId: string,
  receiptId: string,
  idempotencyKey: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerReceiptAllocationBatch | null> {
  return tx.customerReceiptAllocationBatch.findFirst({
    where: { tenantId, receiptId, idempotencyKey },
  })
}

export async function createAllocationBatch(
  data: {
    tenantId: string
    legalEntityId: string
    receiptId: string
    receiptOpenItemId: string
    customerId: string
    idempotencyKey: string
    payloadHash: string
    allocationDate: Date
    currencyCode: string
    exchangeRate: Prisma.Decimal | string
    createdBy?: string | null
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerReceiptAllocationBatch> {
  return tx.customerReceiptAllocationBatch.create({
    data: {
      tenantId: data.tenantId,
      legalEntityId: data.legalEntityId,
      receiptId: data.receiptId,
      receiptOpenItemId: data.receiptOpenItemId,
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

export async function markBatchPosted(
  batchId: string,
  totals: {
    totalAllocatedAmount: Prisma.Decimal | string
    baseTotalAllocatedAmount: Prisma.Decimal | string
    allocationCount: number
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerReceiptAllocationBatch> {
  return tx.customerReceiptAllocationBatch.update({
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

export async function findAllocationBatchById(
  tenantId: string,
  receiptId: string,
  batchId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerReceiptAllocationBatch | null> {
  return tx.customerReceiptAllocationBatch.findFirst({
    where: { id: batchId, tenantId, receiptId },
  })
}

/** Internal: flips a POSTED batch to REVERSED and stamps reverse idempotency + audit. Not HTTP-routable. */
export async function markBatchReversed(
  batchId: string,
  data: {
    reverseIdempotencyKey: string
    reversePayloadHash: string
    reversalReason: string
    reversedBy?: string | null
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerReceiptAllocationBatch> {
  return tx.customerReceiptAllocationBatch.update({
    where: { id: batchId },
    data: {
      status: 'REVERSED',
      reverseIdempotencyKey: data.reverseIdempotencyKey,
      reversePayloadHash: data.reversePayloadHash,
      reversalReason: data.reversalReason,
      reversedAt: new Date(),
      reversedBy: data.reversedBy ?? null,
    },
  })
}

export async function resetFailedBatchForRetry(
  batchId: string,
  data: { allocationDate: Date; payloadHash: string },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerReceiptAllocationBatch> {
  return tx.customerReceiptAllocationBatch.update({
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
