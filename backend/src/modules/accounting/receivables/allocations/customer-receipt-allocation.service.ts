import { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { createAuditLog } from '../../../../services/audit.service.js'
import { formatForPersistence, isZero, toDecimal } from '../../shared/finance-decimal.js'
import {
  applyCreditAllocation,
  applyDebitAllocation,
} from '../receivable-open-items/receivable-open-item.repository.js'
import { updateReceiptAfterAllocation } from '../receipts/customer-receipt.repository.js'
import {
  createAllocationBatch,
  findBatchByIdempotencyKey,
  mapAllocationBatchToDto,
  markBatchPosted,
  resetFailedBatchForRetry,
} from './customer-receipt-allocation-batch.repository.js'
import {
  ReceiptAllocationConcurrentChangeError,
  ReceiptAllocationFailedError,
  ReceiptAllocationInProgressError,
  ReceiptAllocationPayloadMismatchError,
  ReceiptAllocationReceiptNotFoundError,
  RECEIPT_ALLOCATION_ERROR_CODES,
  ReceiptAllocationValidationError,
} from './customer-receipt-allocation.errors.js'
import {
  buildAllocationPayloadHash,
  createAllocationRows,
  listAllocationsByBatchId,
  mapCustomerReceiptAllocationToDto,
} from './customer-receipt-allocation.repository.js'
import {
  resolveOpenItemStatusAfter,
  validateAllocationRequest,
} from './customer-receipt-allocation-validation.service.js'
import type {
  AllocateCustomerReceiptContext,
  AllocateCustomerReceiptInput,
  AllocateCustomerReceiptResult,
} from './customer-receipt-allocation.types.js'

async function buildResult(
  tenantId: string,
  batchId: string,
  idempotentReplay: boolean,
): Promise<AllocateCustomerReceiptResult> {
  const batch = await prisma.customerReceiptAllocationBatch.findFirstOrThrow({
    where: { id: batchId, tenantId },
  })
  const receipt = await prisma.customerReceipt.findFirstOrThrow({
    where: { id: batch.receiptId, tenantId },
  })
  const credit = await prisma.receivableOpenItem.findFirstOrThrow({
    where: { id: batch.receiptOpenItemId, tenantId },
  })
  const allocations = await listAllocationsByBatchId(tenantId, batchId)

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
    batch: mapAllocationBatchToDto(batch),
    allocations: allocations.map(mapCustomerReceiptAllocationToDto),
    receipt: {
      id: receipt.id,
      allocatedAmount: formatForPersistence(receipt.allocatedAmount),
      unallocatedAmount: formatForPersistence(receipt.unallocatedAmount),
      baseAllocatedAmount: formatForPersistence(receipt.baseAllocatedAmount),
      baseUnallocatedAmount: formatForPersistence(receipt.baseUnallocatedAmount),
    },
    creditOpenItem: {
      id: credit.id,
      openAmount: formatForPersistence(credit.openAmount),
      allocatedAmount: formatForPersistence(credit.allocatedAmount),
      status: credit.status,
    },
    invoices,
    customerAdvance: formatForPersistence(receipt.unallocatedAmount),
    idempotentReplay,
  }
}

export async function allocateCustomerReceipt(
  input: AllocateCustomerReceiptInput,
  context: AllocateCustomerReceiptContext,
): Promise<AllocateCustomerReceiptResult> {
  const payloadHash = buildAllocationPayloadHash(input)
  const existing = await findBatchByIdempotencyKey(context.tenantId, input.receiptId, context.idempotencyKey)

  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new ReceiptAllocationPayloadMismatchError()
    if (existing.status === 'POSTED') return buildResult(context.tenantId, existing.id, true)
    if (existing.status === 'PROCESSING') throw new ReceiptAllocationInProgressError()
  }

  const receipt = await prisma.customerReceipt.findFirst({
    where: { id: input.receiptId, tenantId: context.tenantId },
  })
  if (!receipt) throw new ReceiptAllocationReceiptNotFoundError()
  if (!receipt.creditOpenItemId) {
    throw new ReceiptAllocationValidationError(
      'Posted receipt is missing a credit open item',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_CREDIT_MISSING,
    )
  }
  const creditOpenItem = await prisma.receivableOpenItem.findFirst({
    where: { id: receipt.creditOpenItemId, tenantId: context.tenantId },
  })
  if (!creditOpenItem) {
    throw new ReceiptAllocationValidationError(
      'Posted receipt is missing a credit open item',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_CREDIT_MISSING,
    )
  }

  const ctx = await validateAllocationRequest(context.tenantId, receipt, creditOpenItem, input)
  const now = new Date()

  try {
    const batchId = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM customer_receipts
          WHERE id = ${ctx.receipt.id} AND tenantId = ${context.tenantId}
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

        const lockedReceipt = await tx.customerReceipt.findFirstOrThrow({
          where: { id: ctx.receipt.id, tenantId: context.tenantId },
        })
        const lockedCredit = await tx.receivableOpenItem.findFirstOrThrow({
          where: { id: ctx.creditOpenItem.id, tenantId: context.tenantId },
        })

        if (
          !toDecimal(lockedCredit.openAmount).eq(ctx.creditOpenItem.openAmount) ||
          !toDecimal(lockedReceipt.unallocatedAmount).eq(ctx.receipt.unallocatedAmount)
        ) {
          throw new ReceiptAllocationConcurrentChangeError()
        }

        let batch =
          existing?.status === 'FAILED'
            ? await resetFailedBatchForRetry(
                existing.id,
                { allocationDate: ctx.allocationDateValue, payloadHash },
                tx,
              )
            : await createAllocationBatch(
                {
                  tenantId: context.tenantId,
                  legalEntityId: ctx.receipt.legalEntityId,
                  receiptId: ctx.receipt.id,
                  receiptOpenItemId: ctx.creditOpenItem.id,
                  customerId: ctx.receipt.customerId,
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
          await tx.customerReceiptAllocation.deleteMany({
            where: { tenantId: context.tenantId, batchId: batch.id },
          })
        }

        const maxSeq = await tx.customerReceiptAllocation.aggregate({
          where: { tenantId: context.tenantId, receiptId: ctx.receipt.id },
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
            throw new ReceiptAllocationConcurrentChangeError()
          }

          const debitStatus = resolveOpenItemStatusAfter(line.invoiceOutstandingAfter)
          const debitUpdated = await applyDebitAllocation(tx, {
            tenantId: context.tenantId,
            legalEntityId: ctx.receipt.legalEntityId,
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
          if (debitUpdated !== 1) throw new ReceiptAllocationConcurrentChangeError()

          rowInputs.push({
            tenantId: context.tenantId,
            legalEntityId: ctx.receipt.legalEntityId,
            customerId: ctx.receipt.customerId,
            batchId: batch.id,
            receiptId: ctx.receipt.id,
            receiptOpenItemId: ctx.creditOpenItem.id,
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

        await createAllocationRows(rowInputs, tx)

        const creditStatus = isZero(ctx.totalAllocated)
          ? 'OPEN'
          : resolveOpenItemStatusAfter(ctx.creditOpenAfter)

        const creditUpdated = await applyCreditAllocation(tx, {
          tenantId: context.tenantId,
          legalEntityId: ctx.receipt.legalEntityId,
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
        if (creditUpdated !== 1) throw new ReceiptAllocationConcurrentChangeError()

        const receiptUpdated = await updateReceiptAfterAllocation(tx, {
          tenantId: context.tenantId,
          legalEntityId: ctx.receipt.legalEntityId,
          receiptId: lockedReceipt.id,
          expectedAllocatedAmount: lockedReceipt.allocatedAmount,
          expectedUnallocatedAmount: lockedReceipt.unallocatedAmount,
          expectedBaseAllocatedAmount: lockedReceipt.baseAllocatedAmount,
          expectedBaseUnallocatedAmount: lockedReceipt.baseUnallocatedAmount,
          allocationAmount: ctx.totalAllocated,
          baseAllocationAmount: ctx.baseTotalAllocated,
          updatedBy: context.userId,
        })
        if (receiptUpdated !== 1) throw new ReceiptAllocationConcurrentChangeError()

        await markBatchPosted(
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
      entity: 'customer_receipt_allocation_batch',
      entityId: batchId,
      action: 'CUSTOMER_RECEIPT_ALLOCATION_POSTED',
      newValues: {
        receiptId: ctx.receipt.id,
        receiptNumber: ctx.receipt.receiptNumber,
        customerId: ctx.receipt.customerId,
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
      err instanceof ReceiptAllocationConcurrentChangeError ||
      err instanceof ReceiptAllocationPayloadMismatchError ||
      err instanceof ReceiptAllocationInProgressError ||
      err instanceof ReceiptAllocationValidationError
    ) {
      throw err
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await findBatchByIdempotencyKey(
        context.tenantId,
        input.receiptId,
        context.idempotencyKey,
      )
      if (raced?.status === 'POSTED' && raced.payloadHash === payloadHash) {
        return buildResult(context.tenantId, raced.id, true)
      }
      if (raced && raced.payloadHash !== payloadHash) throw new ReceiptAllocationPayloadMismatchError()
      throw new ReceiptAllocationInProgressError()
    }
    throw err instanceof Error ? err : new ReceiptAllocationFailedError()
  }
}
