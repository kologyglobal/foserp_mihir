import { Prisma } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { createAuditLog } from '../../../../../services/audit.service.js'
import { formatForPersistence, isZero, toDecimal } from '../../../shared/finance-decimal.js'
import {
  applyCreditAllocation,
  applyDebitAllocation,
} from '../../receivable-open-items/receivable-open-item.repository.js'
import { updateCreditNoteAfterAllocation } from '../customer-credit-note.repository.js'
import {
  createCreditNoteAllocationBatch,
  findCreditNoteAllocationBatchByIdempotencyKey,
  mapCreditNoteAllocationBatchToDto,
  markCreditNoteAllocationBatchPosted,
  resetFailedCreditNoteAllocationBatchForRetry,
} from './customer-credit-note-allocation-batch.repository.js'
import {
  CreditNoteAllocationConcurrentChangeError,
  CreditNoteAllocationCreditNoteNotFoundError,
  CreditNoteAllocationFailedError,
  CreditNoteAllocationInProgressError,
  CreditNoteAllocationPayloadMismatchError,
  CREDIT_NOTE_ALLOCATION_ERROR_CODES,
  CreditNoteAllocationValidationError,
} from './customer-credit-note-allocation.errors.js'
import {
  buildCreditNoteAllocationPayloadHash,
  createCreditNoteAllocationRows,
  listCreditNoteAllocationsByBatchId,
  mapCustomerCreditNoteAllocationToDto,
} from './customer-credit-note-allocation.repository.js'
import {
  resolveOpenItemStatusAfter,
  validateCreditNoteAllocationRequest,
} from './customer-credit-note-allocation-validation.service.js'
import type {
  AllocateCustomerCreditNoteContext,
  AllocateCustomerCreditNoteInput,
  AllocateCustomerCreditNoteResult,
} from './customer-credit-note-allocation.types.js'

async function buildResult(
  tenantId: string,
  batchId: string,
  idempotentReplay: boolean,
): Promise<AllocateCustomerCreditNoteResult> {
  const batch = await prisma.customerCreditNoteAllocationBatch.findFirstOrThrow({
    where: { id: batchId, tenantId },
  })
  const creditNote = await prisma.customerCreditNote.findFirstOrThrow({
    where: { id: batch.creditNoteId, tenantId },
  })
  const credit = await prisma.receivableOpenItem.findFirstOrThrow({
    where: { id: batch.creditNoteOpenItemId, tenantId },
  })
  const allocations = await listCreditNoteAllocationsByBatchId(tenantId, batchId)

  const invoices = await Promise.all(
    allocations.map(async (row) => {
      const openItem = await prisma.receivableOpenItem.findFirstOrThrow({
        where: { id: row.invoiceOpenItemId, tenantId },
      })
      return {
        invoiceId: row.invoiceId ?? '',
        openItemId: openItem.id,
        openAmount: formatForPersistence(openItem.openAmount),
        allocatedAmount: formatForPersistence(openItem.allocatedAmount),
        status: openItem.status,
        amountPaid: formatForPersistence(openItem.allocatedAmount),
        outstandingAmount: formatForPersistence(openItem.openAmount),
      }
    }),
  )

  return {
    batch: mapCreditNoteAllocationBatchToDto(batch),
    allocations: allocations.map(mapCustomerCreditNoteAllocationToDto),
    creditNote: {
      id: creditNote.id,
      allocatedAmount: formatForPersistence(creditNote.allocatedAmount),
      unallocatedAmount: formatForPersistence(creditNote.unallocatedAmount),
      baseAllocatedAmount: formatForPersistence(creditNote.baseAllocatedAmount),
      baseUnallocatedAmount: formatForPersistence(creditNote.baseUnallocatedAmount),
    },
    creditOpenItem: {
      id: credit.id,
      openAmount: formatForPersistence(credit.openAmount),
      allocatedAmount: formatForPersistence(credit.allocatedAmount),
      status: credit.status,
    },
    invoices,
    customerAdvance: formatForPersistence(creditNote.unallocatedAmount),
    idempotentReplay,
  }
}

export async function allocateCustomerCreditNote(
  input: AllocateCustomerCreditNoteInput,
  context: AllocateCustomerCreditNoteContext,
): Promise<AllocateCustomerCreditNoteResult> {
  const payloadHash = buildCreditNoteAllocationPayloadHash(input)
  const existing = await findCreditNoteAllocationBatchByIdempotencyKey(
    context.tenantId,
    input.creditNoteId,
    context.idempotencyKey,
  )

  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new CreditNoteAllocationPayloadMismatchError()
    if (existing.status === 'POSTED') return buildResult(context.tenantId, existing.id, true)
    if (existing.status === 'PROCESSING') throw new CreditNoteAllocationInProgressError()
  }

  const creditNote = await prisma.customerCreditNote.findFirst({
    where: { id: input.creditNoteId, tenantId: context.tenantId },
  })
  if (!creditNote) throw new CreditNoteAllocationCreditNoteNotFoundError()
  if (!creditNote.creditOpenItemId) {
    throw new CreditNoteAllocationValidationError(
      'Posted credit note is missing a credit open item',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_CREDIT_MISSING,
    )
  }
  const creditOpenItem = await prisma.receivableOpenItem.findFirst({
    where: { id: creditNote.creditOpenItemId, tenantId: context.tenantId },
  })
  if (!creditOpenItem) {
    throw new CreditNoteAllocationValidationError(
      'Posted credit note is missing a credit open item',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_CREDIT_MISSING,
    )
  }

  const ctx = await validateCreditNoteAllocationRequest(context.tenantId, creditNote, creditOpenItem, input)
  const now = new Date()

  try {
    const batchId = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM customer_credit_notes
          WHERE id = ${ctx.creditNote.id} AND tenantId = ${context.tenantId}
          FOR UPDATE
        `
        await tx.$queryRaw`
          SELECT id FROM receivable_open_items
          WHERE id = ${ctx.creditOpenItem.id} AND tenantId = ${context.tenantId}
          FOR UPDATE
        `

        const invoiceIds = [...new Set(ctx.lines.map((l) => l.invoiceId))].sort()
        for (const invoiceId of invoiceIds) {
          await tx.$queryRaw`
            SELECT id FROM sales_invoices
            WHERE id = ${invoiceId} AND tenantId = ${context.tenantId}
            FOR UPDATE
          `
        }
        const openItemIds = [...ctx.lines.map((l) => l.invoiceOpenItemId)].sort()
        for (const openItemId of openItemIds) {
          await tx.$queryRaw`
            SELECT id FROM receivable_open_items
            WHERE id = ${openItemId} AND tenantId = ${context.tenantId}
            FOR UPDATE
          `
        }

        const lockedCreditNote = await tx.customerCreditNote.findFirstOrThrow({
          where: { id: ctx.creditNote.id, tenantId: context.tenantId },
        })
        const lockedCredit = await tx.receivableOpenItem.findFirstOrThrow({
          where: { id: ctx.creditOpenItem.id, tenantId: context.tenantId },
        })

        if (
          !toDecimal(lockedCredit.openAmount).eq(ctx.creditOpenItem.openAmount) ||
          !toDecimal(lockedCreditNote.unallocatedAmount).eq(ctx.creditNote.unallocatedAmount)
        ) {
          throw new CreditNoteAllocationConcurrentChangeError()
        }

        let batch =
          existing?.status === 'FAILED'
            ? await resetFailedCreditNoteAllocationBatchForRetry(
                existing.id,
                { allocationDate: ctx.allocationDateValue, payloadHash },
                tx,
              )
            : await createCreditNoteAllocationBatch(
                {
                  tenantId: context.tenantId,
                  legalEntityId: ctx.creditNote.legalEntityId,
                  creditNoteId: ctx.creditNote.id,
                  creditNoteOpenItemId: ctx.creditOpenItem.id,
                  customerId: ctx.creditNote.customerId,
                  idempotencyKey: context.idempotencyKey,
                  payloadHash,
                  allocationDate: ctx.allocationDateValue,
                  currencyCode: ctx.currencyCode,
                  exchangeRate: ctx.exchangeRate,
                  createdBy: context.userId,
                },
                tx,
              )

        if (existing?.status === 'FAILED') {
          await tx.customerCreditNoteAllocation.deleteMany({
            where: { tenantId: context.tenantId, batchId: batch.id },
          })
        }

        const maxSeq = await tx.customerCreditNoteAllocation.aggregate({
          where: { tenantId: context.tenantId, creditNoteId: ctx.creditNote.id },
          _max: { allocationSequence: true },
        })
        let nextSequence = (maxSeq._max.allocationSequence ?? 0) + 1

        const rowInputs = []
        for (const line of ctx.lines) {
          const lockedDebit = await tx.receivableOpenItem.findFirstOrThrow({
            where: { id: line.invoiceOpenItemId, tenantId: context.tenantId },
          })
          if (
            !toDecimal(lockedDebit.openAmount).eq(line.invoiceOutstandingBefore) ||
            !toDecimal(lockedDebit.allocatedAmount).eq(line.debitOpenItem.allocatedAmount)
          ) {
            throw new CreditNoteAllocationConcurrentChangeError()
          }

          const debitStatus = resolveOpenItemStatusAfter(line.invoiceOutstandingAfter)
          const debitUpdated = await applyDebitAllocation(tx, {
            tenantId: context.tenantId,
            legalEntityId: ctx.creditNote.legalEntityId,
            openItemId: lockedDebit.id,
            expectedOpenAmount: lockedDebit.openAmount,
            expectedAllocatedAmount: lockedDebit.allocatedAmount,
            expectedBaseOpenAmount: lockedDebit.baseOpenAmount,
            expectedBaseAllocatedAmount: lockedDebit.baseAllocatedAmount,
            allocationAmount: line.allocationAmount,
            baseAllocationAmount: line.baseAllocationAmount,
            newStatus: debitStatus,
            settledAt: debitStatus === 'SETTLED' ? now : null,
            updatedBy: context.userId,
          })
          if (debitUpdated !== 1) throw new CreditNoteAllocationConcurrentChangeError()

          rowInputs.push({
            tenantId: context.tenantId,
            legalEntityId: ctx.creditNote.legalEntityId,
            customerId: ctx.creditNote.customerId,
            batchId: batch.id,
            creditNoteId: ctx.creditNote.id,
            creditNoteOpenItemId: ctx.creditOpenItem.id,
            invoiceId: line.invoiceId,
            invoiceOpenItemId: line.invoiceOpenItemId,
            allocationDate: ctx.allocationDateValue,
            postingDate: ctx.allocationDateValue,
            currencyCode: ctx.currencyCode,
            exchangeRate: ctx.exchangeRate,
            allocatedAmount: line.allocationAmount,
            baseAllocatedAmount: line.baseAllocationAmount,
            invoiceOutstandingBefore: line.invoiceOutstandingBefore,
            invoiceOutstandingAfter: line.invoiceOutstandingAfter,
            baseInvoiceOutstandingBefore: line.baseInvoiceOutstandingBefore,
            baseInvoiceOutstandingAfter: line.baseInvoiceOutstandingAfter,
            allocationSequence: nextSequence,
            createdBy: context.userId,
          })
          nextSequence += 1
        }

        await createCreditNoteAllocationRows(rowInputs, tx)

        const creditStatus = isZero(ctx.totalAllocated)
          ? 'OPEN'
          : resolveOpenItemStatusAfter(ctx.creditOpenAfter)

        const creditUpdated = await applyCreditAllocation(tx, {
          tenantId: context.tenantId,
          legalEntityId: ctx.creditNote.legalEntityId,
          openItemId: lockedCredit.id,
          expectedOpenAmount: lockedCredit.openAmount,
          expectedAllocatedAmount: lockedCredit.allocatedAmount,
          expectedBaseOpenAmount: lockedCredit.baseOpenAmount,
          expectedBaseAllocatedAmount: lockedCredit.baseAllocatedAmount,
          allocationAmount: ctx.totalAllocated,
          baseAllocationAmount: ctx.baseTotalAllocated,
          newStatus: creditStatus,
          settledAt: creditStatus === 'SETTLED' ? now : null,
          updatedBy: context.userId,
        })
        if (creditUpdated !== 1) throw new CreditNoteAllocationConcurrentChangeError()

        const creditNoteUpdated = await updateCreditNoteAfterAllocation(tx, {
          tenantId: context.tenantId,
          legalEntityId: ctx.creditNote.legalEntityId,
          creditNoteId: lockedCreditNote.id,
          expectedAllocatedAmount: lockedCreditNote.allocatedAmount,
          expectedUnallocatedAmount: lockedCreditNote.unallocatedAmount,
          expectedBaseAllocatedAmount: lockedCreditNote.baseAllocatedAmount,
          expectedBaseUnallocatedAmount: lockedCreditNote.baseUnallocatedAmount,
          allocationAmount: ctx.totalAllocated,
          baseAllocationAmount: ctx.baseTotalAllocated,
          updatedBy: context.userId,
        })
        if (creditNoteUpdated !== 1) throw new CreditNoteAllocationConcurrentChangeError()

        await markCreditNoteAllocationBatchPosted(
          batch.id,
          {
            totalAllocatedAmount: ctx.totalAllocated,
            baseTotalAllocatedAmount: ctx.baseTotalAllocated,
            allocationCount: ctx.lines.length,
          },
          tx,
        )

        return batch.id
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 },
    )

    await createAuditLog({
      tenantId: context.tenantId,
      userId: context.userId,
      module: 'finance',
      entity: 'customer_credit_note_allocation_batch',
      entityId: batchId,
      action: 'CUSTOMER_CREDIT_NOTE_ALLOCATION_POSTED',
      newValues: {
        creditNoteId: ctx.creditNote.id,
        creditNoteNumber: ctx.creditNote.creditNoteNumber,
        customerId: ctx.creditNote.customerId,
        allocationDate: input.allocationDate,
        allocationCount: ctx.lines.length,
        totalAllocated: formatForPersistence(ctx.totalAllocated),
        remainingCredit: formatForPersistence(ctx.creditOpenAfter),
        invoices: ctx.lines.map((l) => ({
          invoiceNumber: l.invoiceNumber,
          amount: formatForPersistence(l.allocationAmount),
        })),
        createdBy: context.userId,
      },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    })

    return buildResult(context.tenantId, batchId, false)
  } catch (err) {
    if (
      err instanceof CreditNoteAllocationConcurrentChangeError ||
      err instanceof CreditNoteAllocationPayloadMismatchError ||
      err instanceof CreditNoteAllocationInProgressError ||
      err instanceof CreditNoteAllocationValidationError
    ) {
      throw err
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await findCreditNoteAllocationBatchByIdempotencyKey(
        context.tenantId,
        input.creditNoteId,
        context.idempotencyKey,
      )
      if (raced?.status === 'POSTED' && raced.payloadHash === payloadHash) {
        return buildResult(context.tenantId, raced.id, true)
      }
      if (raced && raced.payloadHash !== payloadHash) throw new CreditNoteAllocationPayloadMismatchError()
      throw new CreditNoteAllocationInProgressError()
    }
    throw err instanceof Error ? err : new CreditNoteAllocationFailedError()
  }
}
