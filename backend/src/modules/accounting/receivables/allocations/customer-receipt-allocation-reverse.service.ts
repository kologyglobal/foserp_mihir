import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { createAuditLog } from '../../../../services/audit.service.js'
import { formatForPersistence, isZero, sumDecimals, toDecimal } from '../../shared/finance-decimal.js'
import { hashPayload } from '../../shared/payload-hash.js'
import {
  revertCreditAllocation,
  revertDebitAllocation,
} from '../receivable-open-items/receivable-open-item.repository.js'
import { updateReceiptAfterAllocationReverse } from '../receipts/customer-receipt.repository.js'
import {
  findAllocationBatchById,
  markBatchReversed,
} from './customer-receipt-allocation-batch.repository.js'
import {
  ReceiptAllocationBatchNotFoundError,
  ReceiptAllocationBatchNotReversibleError,
  ReceiptAllocationConcurrentChangeError,
  ReceiptAllocationPayloadMismatchError,
} from './customer-receipt-allocation.errors.js'
import { listAllocationsByBatchId } from './customer-receipt-allocation.repository.js'
import { buildResult } from './customer-receipt-allocation.service.js'
import type {
  AllocateCustomerReceiptResult,
  ReverseCustomerReceiptAllocationContext,
  ReverseCustomerReceiptAllocationInput,
} from './customer-receipt-allocation.types.js'

function buildReversePayloadHash(input: { batchId: string; reason: string }): string {
  return hashPayload({ batchId: input.batchId, reason: input.reason })
}

export async function reverseCustomerReceiptAllocation(
  input: ReverseCustomerReceiptAllocationInput,
  context: ReverseCustomerReceiptAllocationContext,
): Promise<AllocateCustomerReceiptResult> {
  const payloadHash = buildReversePayloadHash({ batchId: input.batchId, reason: input.reason })

  const existing = await findAllocationBatchById(context.tenantId, input.receiptId, input.batchId)
  if (!existing) throw new ReceiptAllocationBatchNotFoundError()

  if (existing.status === 'REVERSED') {
    if (
      existing.reverseIdempotencyKey === context.idempotencyKey &&
      existing.reversePayloadHash === payloadHash
    ) {
      return buildResult(context.tenantId, existing.id, true)
    }
    throw new ReceiptAllocationPayloadMismatchError()
  }

  if (existing.status !== 'POSTED') {
    throw new ReceiptAllocationBatchNotReversibleError()
  }

  const now = new Date()

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM customer_receipts
          WHERE id = ${existing.receiptId} AND tenantId = ${context.tenantId}
          FOR UPDATE
        `
        await tx.$queryRaw`
          SELECT id FROM receivable_open_items
          WHERE id = ${existing.receiptOpenItemId} AND tenantId = ${context.tenantId}
          FOR UPDATE
        `

        const lines = await tx.customerReceiptAllocation.findMany({
          where: { tenantId: context.tenantId, batchId: existing.id, status: 'POSTED' },
          orderBy: { allocationSequence: 'asc' },
        })

        const openItemIds = [...new Set(lines.map((l) => l.invoiceOpenItemId))].sort()
        for (const openItemId of openItemIds) {
          await tx.$queryRaw`
            SELECT id FROM receivable_open_items
            WHERE id = ${openItemId} AND tenantId = ${context.tenantId}
            FOR UPDATE
          `
        }

        for (const line of lines) {
          const lockedDebit = await tx.receivableOpenItem.findFirstOrThrow({
            where: { id: line.invoiceOpenItemId, tenantId: context.tenantId },
          })
          const newAllocated = toDecimal(lockedDebit.allocatedAmount).sub(toDecimal(line.allocatedAmount))
          const debitStatus = isZero(newAllocated) ? 'OPEN' : 'PARTIALLY_SETTLED'
          const debitReverted = await revertDebitAllocation(tx, {
            tenantId: context.tenantId,
            legalEntityId: line.legalEntityId,
            openItemId: lockedDebit.id,
            expectedOpenAmount: lockedDebit.openAmount,
            expectedAllocatedAmount: lockedDebit.allocatedAmount,
            expectedBaseOpenAmount: lockedDebit.baseOpenAmount,
            expectedBaseAllocatedAmount: lockedDebit.baseAllocatedAmount,
            allocationAmount: line.allocatedAmount,
            baseAllocationAmount: line.baseAllocatedAmount,
            newStatus: debitStatus,
            settledAt: null,
            updatedBy: context.userId,
          })
          if (debitReverted !== 1) throw new ReceiptAllocationConcurrentChangeError()

          await tx.customerReceiptAllocation.update({
            where: { id: line.id },
            data: {
              status: 'REVERSED',
              reversedAt: now,
              reversedBy: context.userId,
              reversalReason: input.reason,
            },
          })
        }

        const totalReversed = sumDecimals(lines.map((l) => l.allocatedAmount.toString()))
        const baseTotalReversed = sumDecimals(lines.map((l) => l.baseAllocatedAmount.toString()))

        const lockedCredit = await tx.receivableOpenItem.findFirstOrThrow({
          where: { id: existing.receiptOpenItemId, tenantId: context.tenantId },
        })
        const newCreditAllocated = toDecimal(lockedCredit.allocatedAmount).sub(totalReversed)
        const creditStatus = isZero(newCreditAllocated) ? 'OPEN' : 'PARTIALLY_SETTLED'
        const creditReverted = await revertCreditAllocation(tx, {
          tenantId: context.tenantId,
          legalEntityId: lockedCredit.legalEntityId,
          openItemId: lockedCredit.id,
          expectedOpenAmount: lockedCredit.openAmount,
          expectedAllocatedAmount: lockedCredit.allocatedAmount,
          expectedBaseOpenAmount: lockedCredit.baseOpenAmount,
          expectedBaseAllocatedAmount: lockedCredit.baseAllocatedAmount,
          allocationAmount: totalReversed,
          baseAllocationAmount: baseTotalReversed,
          newStatus: creditStatus,
          settledAt: null,
          updatedBy: context.userId,
        })
        if (creditReverted !== 1) throw new ReceiptAllocationConcurrentChangeError()

        const lockedReceipt = await tx.customerReceipt.findFirstOrThrow({
          where: { id: existing.receiptId, tenantId: context.tenantId },
        })
        const receiptReverted = await updateReceiptAfterAllocationReverse(tx, {
          tenantId: context.tenantId,
          legalEntityId: lockedReceipt.legalEntityId,
          receiptId: lockedReceipt.id,
          expectedAllocatedAmount: lockedReceipt.allocatedAmount,
          expectedUnallocatedAmount: lockedReceipt.unallocatedAmount,
          expectedBaseAllocatedAmount: lockedReceipt.baseAllocatedAmount,
          expectedBaseUnallocatedAmount: lockedReceipt.baseUnallocatedAmount,
          allocationAmount: totalReversed,
          baseAllocationAmount: baseTotalReversed,
          updatedBy: context.userId,
        })
        if (receiptReverted !== 1) throw new ReceiptAllocationConcurrentChangeError()

        await markBatchReversed(
          existing.id,
          {
            reverseIdempotencyKey: context.idempotencyKey,
            reversePayloadHash: payloadHash,
            reversalReason: input.reason,
            reversedBy: context.userId,
          },
          tx,
        )
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 },
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await findAllocationBatchById(context.tenantId, input.receiptId, input.batchId)
      if (
        raced?.status === 'REVERSED' &&
        raced.reverseIdempotencyKey === context.idempotencyKey &&
        raced.reversePayloadHash === payloadHash
      ) {
        return buildResult(context.tenantId, raced.id, true)
      }
      throw new ReceiptAllocationPayloadMismatchError()
    }
    throw err
  }

  const reversedLines = await listAllocationsByBatchId(context.tenantId, input.batchId)
  await createAuditLog({
    tenantId: context.tenantId,
    userId: context.userId,
    module: 'finance',
    entity: 'customer_receipt_allocation_batch',
    entityId: existing.id,
    action: 'CUSTOMER_RECEIPT_ALLOCATION_REVERSED',
    newValues: {
      receiptId: existing.receiptId,
      customerId: existing.customerId,
      reason: input.reason,
      reversedCount: reversedLines.length,
      totalReversed: formatForPersistence(
        sumDecimals(reversedLines.map((l) => l.allocatedAmount.toString())),
      ),
    },
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  })

  return buildResult(context.tenantId, input.batchId, false)
}
