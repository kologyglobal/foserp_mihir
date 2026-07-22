import { Prisma } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { createAuditLog } from '../../../../../services/audit.service.js'
import { formatForPersistence, isZero, sumDecimals, toDecimal } from '../../../shared/finance-decimal.js'
import { hashPayload } from '../../../shared/payload-hash.js'
import {
  revertCreditAllocation,
  revertDebitAllocation,
} from '../../receivable-open-items/receivable-open-item.repository.js'
import { updateCreditNoteAfterAllocationReverse } from '../customer-credit-note.repository.js'
import {
  findCreditNoteAllocationBatchById,
  markCreditNoteAllocationBatchReversed,
} from './customer-credit-note-allocation-batch.repository.js'
import {
  CreditNoteAllocationBatchNotFoundError,
  CreditNoteAllocationBatchNotReversibleError,
  CreditNoteAllocationConcurrentChangeError,
  CreditNoteAllocationPayloadMismatchError,
} from './customer-credit-note-allocation.errors.js'
import { listCreditNoteAllocationsByBatchId } from './customer-credit-note-allocation.repository.js'
import { buildResult } from './customer-credit-note-allocation.service.js'
import type {
  AllocateCustomerCreditNoteResult,
  ReverseCustomerCreditNoteAllocationContext,
  ReverseCustomerCreditNoteAllocationInput,
} from './customer-credit-note-allocation.types.js'

function buildReversePayloadHash(input: { batchId: string; reason: string }): string {
  return hashPayload({ batchId: input.batchId, reason: input.reason })
}

export async function reverseCustomerCreditNoteAllocation(
  input: ReverseCustomerCreditNoteAllocationInput,
  context: ReverseCustomerCreditNoteAllocationContext,
): Promise<AllocateCustomerCreditNoteResult> {
  const payloadHash = buildReversePayloadHash({ batchId: input.batchId, reason: input.reason })

  const existing = await findCreditNoteAllocationBatchById(context.tenantId, input.creditNoteId, input.batchId)
  if (!existing) throw new CreditNoteAllocationBatchNotFoundError()

  if (existing.status === 'REVERSED') {
    if (
      existing.reverseIdempotencyKey === context.idempotencyKey &&
      existing.reversePayloadHash === payloadHash
    ) {
      return buildResult(context.tenantId, existing.id, true)
    }
    throw new CreditNoteAllocationPayloadMismatchError()
  }

  if (existing.status !== 'POSTED') {
    throw new CreditNoteAllocationBatchNotReversibleError()
  }

  const now = new Date()

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM customer_credit_notes
          WHERE id = ${existing.creditNoteId} AND tenantId = ${context.tenantId}
          FOR UPDATE
        `
        await tx.$queryRaw`
          SELECT id FROM receivable_open_items
          WHERE id = ${existing.creditNoteOpenItemId} AND tenantId = ${context.tenantId}
          FOR UPDATE
        `

        const lines = await tx.customerCreditNoteAllocation.findMany({
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
          if (debitReverted !== 1) throw new CreditNoteAllocationConcurrentChangeError()

          await tx.customerCreditNoteAllocation.update({
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
          where: { id: existing.creditNoteOpenItemId, tenantId: context.tenantId },
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
        if (creditReverted !== 1) throw new CreditNoteAllocationConcurrentChangeError()

        const lockedCreditNote = await tx.customerCreditNote.findFirstOrThrow({
          where: { id: existing.creditNoteId, tenantId: context.tenantId },
        })
        const creditNoteReverted = await updateCreditNoteAfterAllocationReverse(tx, {
          tenantId: context.tenantId,
          legalEntityId: lockedCreditNote.legalEntityId,
          creditNoteId: lockedCreditNote.id,
          expectedAllocatedAmount: lockedCreditNote.allocatedAmount,
          expectedUnallocatedAmount: lockedCreditNote.unallocatedAmount,
          expectedBaseAllocatedAmount: lockedCreditNote.baseAllocatedAmount,
          expectedBaseUnallocatedAmount: lockedCreditNote.baseUnallocatedAmount,
          allocationAmount: totalReversed,
          baseAllocationAmount: baseTotalReversed,
          updatedBy: context.userId,
        })
        if (creditNoteReverted !== 1) throw new CreditNoteAllocationConcurrentChangeError()

        await markCreditNoteAllocationBatchReversed(
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
      const raced = await findCreditNoteAllocationBatchById(context.tenantId, input.creditNoteId, input.batchId)
      if (
        raced?.status === 'REVERSED' &&
        raced.reverseIdempotencyKey === context.idempotencyKey &&
        raced.reversePayloadHash === payloadHash
      ) {
        return buildResult(context.tenantId, raced.id, true)
      }
      throw new CreditNoteAllocationPayloadMismatchError()
    }
    throw err
  }

  const reversedLines = await listCreditNoteAllocationsByBatchId(context.tenantId, input.batchId)
  await createAuditLog({
    tenantId: context.tenantId,
    userId: context.userId,
    module: 'finance',
    entity: 'customer_credit_note_allocation_batch',
    entityId: existing.id,
    action: 'CUSTOMER_CREDIT_NOTE_ALLOCATION_REVERSED',
    newValues: {
      creditNoteId: existing.creditNoteId,
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
