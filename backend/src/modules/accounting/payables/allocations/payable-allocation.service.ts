import { Prisma, type PayableOpenItem } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { createAuditLog } from '../../../../services/audit.service.js'
import { add, formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import {
  applyCreditAllocation,
  applyDebitAllocation,
} from '../open-items/payable-open-item.repository.js'
import {
  PayableAllocationConcurrentChangeError,
  PayableAllocationFailedError,
  PayableAllocationPaymentNotFoundError,
  PayableAllocationPayloadMismatchError,
} from './payable-allocation.errors.js'
import {
  buildPayableAllocationPayloadHash,
  createAllocationBatchTx,
  createAllocationLinesTx,
  findPayableAllocationBatchByIdempotencyKey,
  findPayableAllocationBatchWithLines,
  mapPayableAllocationBatchToDto,
  mapPayableAllocationLineToDto,
} from './payable-allocation.repository.js'
import { generatePayableAllocationReference } from './payable-allocation-reference.service.js'
import {
  resolveOpenItemStatusAfter,
  resolvePaymentSourceOpenItem,
  resolveAdjustmentSourceOpenItem,
  validatePayableAllocationRequest,
  validatePayableAllocationForAdjustment,
} from './payable-allocation-validation.service.js'
import type {
  AllocateVendorAdjustmentContext,
  AllocateVendorAdjustmentInput,
  AllocateVendorPaymentContext,
  AllocateVendorPaymentInput,
  CreatePayableAllocationResult,
  PayableOpenItemBalanceDto,
} from './payable-allocation.types.js'

function mapBalanceDto(item: PayableOpenItem): PayableOpenItemBalanceDto {
  return {
    id: item.id,
    side: item.side,
    documentType: item.documentType,
    documentNumber: item.documentNumber,
    currencyCode: item.currencyCode,
    originalAmount: formatForPersistence(item.originalAmount),
    allocatedAmount: formatForPersistence(item.allocatedAmount),
    adjustedAmount: formatForPersistence(item.adjustedAmount),
    writtenOffAmount: formatForPersistence(item.writtenOffAmount),
    outstandingAmount: formatForPersistence(item.outstandingAmount),
    baseOutstandingAmount: formatForPersistence(item.baseOutstandingAmount),
    status: item.status,
    settledAt: item.settledAt ? item.settledAt.toISOString() : null,
    updatedAt: item.updatedAt.toISOString(),
  }
}

/** Reconstruct the pre-allocation balance of an open item using this batch's applied amount. */
function reconstructBefore(after: PayableOpenItem, appliedAmount: string, baseAppliedAmount: string): PayableOpenItemBalanceDto {
  const dto = mapBalanceDto(after)
  const outstandingBefore = add(after.outstandingAmount, appliedAmount)
  const allocatedBefore = toDecimal(after.allocatedAmount).sub(appliedAmount)
  const baseOutstandingBefore = add(after.baseOutstandingAmount, baseAppliedAmount)
  return {
    ...dto,
    allocatedAmount: formatForPersistence(allocatedBefore),
    outstandingAmount: formatForPersistence(outstandingBefore),
    baseOutstandingAmount: formatForPersistence(baseOutstandingBefore),
    // Status before allocation was OPEN when nothing was previously allocated, else PARTIALLY_SETTLED.
    status: allocatedBefore.isZero() ? 'OPEN' : 'PARTIALLY_SETTLED',
    settledAt: null,
  }
}

async function buildResult(
  tenantId: string,
  legalEntityId: string,
  batchId: string,
  idempotentReplay: boolean,
): Promise<CreatePayableAllocationResult> {
  const batch = await findPayableAllocationBatchWithLines(tenantId, legalEntityId, batchId)
  if (!batch) throw new PayableAllocationFailedError('Allocation batch missing after creation')

  const sourceAfter = await prisma.payableOpenItem.findFirstOrThrow({
    where: { id: batch.sourceDebitOpenItemId, tenantId, legalEntityId },
  })
  const payment = sourceAfter.sourceVendorPaymentId
    ? await prisma.vendorPayment.findFirst({
        where: { id: sourceAfter.sourceVendorPaymentId, tenantId },
        select: { id: true, vendorPaymentNumber: true },
      })
    : null

  const targets = await Promise.all(
    batch.lines.map(async (line) => {
      const after = await prisma.payableOpenItem.findFirstOrThrow({
        where: { id: line.targetCreditOpenItemId, tenantId, legalEntityId },
      })
      return {
        targetCreditOpenItemId: line.targetCreditOpenItemId,
        vendorInvoiceId: after.sourceVendorInvoiceId,
        before: reconstructBefore(after, formatForPersistence(line.amount), formatForPersistence(line.baseAmount)),
        after: mapBalanceDto(after),
      }
    }),
  )

  const sourceBefore = reconstructBefore(
    sourceAfter,
    formatForPersistence(batch.totalAllocatedAmount),
    formatForPersistence(batch.baseTotalAllocatedAmount),
  )

  return {
    batch: mapPayableAllocationBatchToDto(batch),
    lines: batch.lines.map(mapPayableAllocationLineToDto),
    payment: {
      id: payment?.id ?? sourceAfter.sourceVendorPaymentId ?? '',
      vendorPaymentNumber: payment?.vendorPaymentNumber ?? null,
    },
    sourceBefore,
    sourceAfter: mapBalanceDto(sourceAfter),
    targets,
    vendorAdvanceRemaining: formatForPersistence(sourceAfter.outstandingAmount),
    idempotentReplay,
  }
}

export async function allocateVendorPayment(
  vendorPaymentId: string,
  input: Omit<AllocateVendorPaymentInput, 'vendorPaymentId'>,
  context: AllocateVendorPaymentContext,
): Promise<CreatePayableAllocationResult> {
  const payment = await prisma.vendorPayment.findFirst({
    where: { id: vendorPaymentId, tenantId: context.tenantId },
  })
  if (!payment) throw new PayableAllocationPaymentNotFoundError()

  const source = await resolvePaymentSourceOpenItem(context.tenantId, payment)

  const fullInput: AllocateVendorPaymentInput = { vendorPaymentId, ...input }

  const payloadHash = buildPayableAllocationPayloadHash({
    tenantId: context.tenantId,
    legalEntityId: payment.legalEntityId,
    vendorPaymentId,
    sourceDebitOpenItemId: source.id,
    allocationDate: input.allocationDate,
    currencyCode: source.currencyCode,
    controlAccountId: source.vendorPayableAccountId,
    lines: input.lines.map((l) => ({ targetCreditOpenItemId: l.targetCreditOpenItemId, amount: l.amount })),
  })

  const existing = await findPayableAllocationBatchByIdempotencyKey(context.tenantId, input.idempotencyKey)
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new PayableAllocationPayloadMismatchError()
    return buildResult(context.tenantId, existing.legalEntityId, existing.id, true)
  }

  const ctx = await validatePayableAllocationRequest(context.tenantId, payment, source, fullInput)
  const legalEntityId = payment.legalEntityId
  const now = new Date()

  const openItemIds = [source.id, ...ctx.lines.map((l) => l.targetCreditOpenItemId)].sort()

  const maxRefAttempts = 5
  for (let attempt = 0; attempt < maxRefAttempts; attempt += 1) {
    const allocationReference = await generatePayableAllocationReference(
      context.tenantId,
      ctx.allocationDateValue,
    )

    try {
      const batchId = await prisma.$transaction(
        async (tx) => {
          // Deterministic lock order — sorted open-item ids
          for (const id of openItemIds) {
            await tx.$queryRaw`
              SELECT id FROM payable_open_items
              WHERE id = ${id} AND tenantId = ${context.tenantId}
              FOR UPDATE
            `
          }

          const lockedSource = await tx.payableOpenItem.findFirstOrThrow({
            where: { id: source.id, tenantId: context.tenantId, legalEntityId },
          })
          if (
            !toDecimal(lockedSource.outstandingAmount).eq(ctx.sourceOutstandingBefore) ||
            !toDecimal(lockedSource.allocatedAmount).eq(source.allocatedAmount)
          ) {
            throw new PayableAllocationConcurrentChangeError()
          }

          const batch = await createAllocationBatchTx(tx, {
            tenantId: context.tenantId,
            legalEntityId,
            branchId: source.branchId,
            vendorId: source.vendorId,
            allocationReference,
            sourceDebitOpenItemId: source.id,
            allocationDate: ctx.allocationDateValue,
            currencyCode: ctx.currencyCode,
            exchangeRate: ctx.exchangeRate,
            totalAllocatedAmount: ctx.totalAllocated,
            baseTotalAllocatedAmount: ctx.baseTotalAllocated,
            idempotencyKey: input.idempotencyKey,
            payloadHash,
            createdBy: context.userId,
          })

          await createAllocationLinesTx(
            tx,
            context.tenantId,
            legalEntityId,
            batch.id,
            ctx.lines.map((l) => ({
              sourceDebitOpenItemId: source.id,
              targetCreditOpenItemId: l.targetCreditOpenItemId,
              amount: l.allocationAmount,
              baseAmount: l.baseAllocationAmount,
            })),
          )

          // Apply CREDIT target balance updates
          for (const line of ctx.lines) {
            const locked = await tx.payableOpenItem.findFirstOrThrow({
              where: { id: line.targetCreditOpenItemId, tenantId: context.tenantId, legalEntityId },
            })
            if (
              !toDecimal(locked.outstandingAmount).eq(line.targetOutstandingBefore) ||
              !toDecimal(locked.allocatedAmount).eq(line.target.allocatedAmount)
            ) {
              throw new PayableAllocationConcurrentChangeError()
            }
            const status = resolveOpenItemStatusAfter(line.targetOutstandingAfter)
            const applied = await applyCreditAllocation(tx, {
              tenantId: context.tenantId,
              legalEntityId,
              openItemId: locked.id,
              expectedOutstandingAmount: locked.outstandingAmount,
              expectedAllocatedAmount: locked.allocatedAmount,
              expectedBaseOutstandingAmount: locked.baseOutstandingAmount,
              expectedBaseAllocatedAmount: locked.baseAllocatedAmount,
              allocationAmount: line.allocationAmount,
              baseAllocationAmount: line.baseAllocationAmount,
              newStatus: status,
              settledAt: status === 'SETTLED' ? now : null,
              updatedBy: context.userId,
            })
            if (applied !== 1) throw new PayableAllocationConcurrentChangeError()
          }

          // Apply DEBIT source balance update
          const sourceStatus = resolveOpenItemStatusAfter(ctx.sourceOutstandingAfter)
          const sourceApplied = await applyDebitAllocation(tx, {
            tenantId: context.tenantId,
            legalEntityId,
            openItemId: lockedSource.id,
            expectedOutstandingAmount: lockedSource.outstandingAmount,
            expectedAllocatedAmount: lockedSource.allocatedAmount,
            expectedBaseOutstandingAmount: lockedSource.baseOutstandingAmount,
            expectedBaseAllocatedAmount: lockedSource.baseAllocatedAmount,
            allocationAmount: ctx.totalAllocated,
            baseAllocationAmount: ctx.baseTotalAllocated,
            newStatus: sourceStatus,
            settledAt: sourceStatus === 'SETTLED' ? now : null,
            updatedBy: context.userId,
          })
          if (sourceApplied !== 1) throw new PayableAllocationConcurrentChangeError()

          return batch.id
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 },
      )

      await createAuditLog({
        tenantId: context.tenantId,
        userId: context.userId,
        module: 'finance',
        entity: 'payable_allocation_batch',
        entityId: batchId,
        action: 'PAYABLE_ALLOCATION_CREATED',
        newValues: {
          allocationReference,
          vendorPaymentId,
          vendorPaymentNumber: payment.vendorPaymentNumber,
          vendorId: source.vendorId,
          sourceDebitOpenItemId: source.id,
          allocationDate: input.allocationDate,
          allocationCount: ctx.lines.length,
          totalAllocated: formatForPersistence(ctx.totalAllocated),
          remainingPaymentOutstanding: formatForPersistence(ctx.sourceOutstandingAfter),
          lines: ctx.lines.map((l) => ({
            targetCreditOpenItemId: l.targetCreditOpenItemId,
            invoiceNumber: l.invoiceNumber,
            amount: formatForPersistence(l.allocationAmount),
          })),
          createdBy: context.userId,
        },
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      })

      return buildResult(context.tenantId, legalEntityId, batchId, false)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target ?? '') as string | string[]
        const targetStr = Array.isArray(target) ? target.join(',') : target
        // Idempotency race — another request created the same batch
        if (targetStr.includes('idempotencyKey') || targetStr.includes('idempotency')) {
          const raced = await findPayableAllocationBatchByIdempotencyKey(context.tenantId, input.idempotencyKey)
          if (raced) {
            if (raced.payloadHash !== payloadHash) throw new PayableAllocationPayloadMismatchError()
            return buildResult(context.tenantId, raced.legalEntityId, raced.id, true)
          }
        }
        // Reference collision — regenerate and retry
        if (attempt < maxRefAttempts - 1) continue
      }
      throw err
    }
  }

  throw new PayableAllocationFailedError('Unable to generate a unique allocation reference')
}

export async function allocateVendorAdjustment(
  vendorAdjustmentId: string,
  input: Omit<AllocateVendorAdjustmentInput, 'vendorAdjustmentId'>,
  context: AllocateVendorAdjustmentContext,
): Promise<CreatePayableAllocationResult> {
  const adjustment = await prisma.vendorAdjustment.findFirst({
    where: { id: vendorAdjustmentId, tenantId: context.tenantId },
  })
  if (!adjustment) throw new PayableAllocationPaymentNotFoundError('Vendor adjustment not found')

  const source = await resolveAdjustmentSourceOpenItem(context.tenantId, adjustment)
  const fullInput: AllocateVendorAdjustmentInput = { vendorAdjustmentId, ...input }

  const payloadHash = buildPayableAllocationPayloadHash({
    tenantId: context.tenantId,
    legalEntityId: adjustment.legalEntityId,
    vendorAdjustmentId,
    sourceDebitOpenItemId: source.id,
    allocationDate: input.allocationDate,
    currencyCode: source.currencyCode,
    controlAccountId: source.vendorPayableAccountId,
    lines: input.lines.map((l) => ({ targetCreditOpenItemId: l.targetCreditOpenItemId, amount: l.amount })),
  })

  const existing = await findPayableAllocationBatchByIdempotencyKey(context.tenantId, input.idempotencyKey)
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new PayableAllocationPayloadMismatchError()
    return buildResult(context.tenantId, existing.legalEntityId, existing.id, true)
  }

  const ctx = await validatePayableAllocationForAdjustment(context.tenantId, adjustment, source, fullInput)
  const legalEntityId = adjustment.legalEntityId
  const now = new Date()
  const openItemIds = [source.id, ...ctx.lines.map((l) => l.targetCreditOpenItemId)].sort()

  const maxRefAttempts = 5
  for (let attempt = 0; attempt < maxRefAttempts; attempt += 1) {
    const allocationReference = await generatePayableAllocationReference(context.tenantId, ctx.allocationDateValue)

    try {
      const batchId = await prisma.$transaction(
        async (tx) => {
          for (const id of openItemIds) {
            await tx.$queryRaw`
              SELECT id FROM payable_open_items
              WHERE id = ${id} AND tenantId = ${context.tenantId}
              FOR UPDATE
            `
          }

          const lockedSource = await tx.payableOpenItem.findFirstOrThrow({
            where: { id: source.id, tenantId: context.tenantId, legalEntityId },
          })
          if (
            !toDecimal(lockedSource.outstandingAmount).eq(ctx.sourceOutstandingBefore) ||
            !toDecimal(lockedSource.allocatedAmount).eq(source.allocatedAmount)
          ) {
            throw new PayableAllocationConcurrentChangeError()
          }

          const batch = await createAllocationBatchTx(tx, {
            tenantId: context.tenantId,
            legalEntityId,
            branchId: source.branchId,
            vendorId: source.vendorId,
            allocationReference,
            sourceDebitOpenItemId: source.id,
            allocationDate: ctx.allocationDateValue,
            currencyCode: ctx.currencyCode,
            exchangeRate: ctx.exchangeRate,
            totalAllocatedAmount: ctx.totalAllocated,
            baseTotalAllocatedAmount: ctx.baseTotalAllocated,
            idempotencyKey: input.idempotencyKey,
            payloadHash,
            createdBy: context.userId,
          })

          await createAllocationLinesTx(
            tx,
            context.tenantId,
            legalEntityId,
            batch.id,
            ctx.lines.map((l) => ({
              sourceDebitOpenItemId: source.id,
              targetCreditOpenItemId: l.targetCreditOpenItemId,
              amount: l.allocationAmount,
              baseAmount: l.baseAllocationAmount,
            })),
          )

          for (const line of ctx.lines) {
            const locked = await tx.payableOpenItem.findFirstOrThrow({
              where: { id: line.targetCreditOpenItemId, tenantId: context.tenantId, legalEntityId },
            })
            if (
              !toDecimal(locked.outstandingAmount).eq(line.targetOutstandingBefore) ||
              !toDecimal(locked.allocatedAmount).eq(line.target.allocatedAmount)
            ) {
              throw new PayableAllocationConcurrentChangeError()
            }
            const status = resolveOpenItemStatusAfter(line.targetOutstandingAfter)
            const applied = await applyCreditAllocation(tx, {
              tenantId: context.tenantId,
              legalEntityId,
              openItemId: locked.id,
              expectedOutstandingAmount: locked.outstandingAmount,
              expectedAllocatedAmount: locked.allocatedAmount,
              expectedBaseOutstandingAmount: locked.baseOutstandingAmount,
              expectedBaseAllocatedAmount: locked.baseAllocatedAmount,
              allocationAmount: line.allocationAmount,
              baseAllocationAmount: line.baseAllocationAmount,
              newStatus: status,
              settledAt: status === 'SETTLED' ? now : null,
              updatedBy: context.userId,
            })
            if (applied !== 1) throw new PayableAllocationConcurrentChangeError()
          }

          const sourceStatus = resolveOpenItemStatusAfter(ctx.sourceOutstandingAfter)
          const sourceApplied = await applyDebitAllocation(tx, {
            tenantId: context.tenantId,
            legalEntityId,
            openItemId: lockedSource.id,
            expectedOutstandingAmount: lockedSource.outstandingAmount,
            expectedAllocatedAmount: lockedSource.allocatedAmount,
            expectedBaseOutstandingAmount: lockedSource.baseOutstandingAmount,
            expectedBaseAllocatedAmount: lockedSource.baseAllocatedAmount,
            allocationAmount: ctx.totalAllocated,
            baseAllocationAmount: ctx.baseTotalAllocated,
            newStatus: sourceStatus,
            settledAt: sourceStatus === 'SETTLED' ? now : null,
            updatedBy: context.userId,
          })
          if (sourceApplied !== 1) throw new PayableAllocationConcurrentChangeError()

          return batch.id
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 },
      )

      await createAuditLog({
        tenantId: context.tenantId,
        userId: context.userId,
        module: 'finance',
        entity: 'payable_allocation_batch',
        entityId: batchId,
        action: 'PAYABLE_ALLOCATION_CREATED',
        newValues: {
          allocationReference,
          vendorAdjustmentId,
          vendorAdjustmentNumber: adjustment.vendorAdjustmentNumber,
          vendorId: source.vendorId,
          sourceDebitOpenItemId: source.id,
          allocationDate: input.allocationDate,
          allocationCount: ctx.lines.length,
          totalAllocated: formatForPersistence(ctx.totalAllocated),
          remainingDebitNoteOutstanding: formatForPersistence(ctx.sourceOutstandingAfter),
          lines: ctx.lines.map((l) => ({
            targetCreditOpenItemId: l.targetCreditOpenItemId,
            documentNumber: l.invoiceNumber,
            amount: formatForPersistence(l.allocationAmount),
          })),
          createdBy: context.userId,
        },
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      })

      return buildResult(context.tenantId, legalEntityId, batchId, false)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target ?? '') as string | string[]
        const targetStr = Array.isArray(target) ? target.join(',') : target
        if (targetStr.includes('idempotencyKey') || targetStr.includes('idempotency')) {
          const raced = await findPayableAllocationBatchByIdempotencyKey(context.tenantId, input.idempotencyKey)
          if (raced) {
            if (raced.payloadHash !== payloadHash) throw new PayableAllocationPayloadMismatchError()
            return buildResult(context.tenantId, raced.legalEntityId, raced.id, true)
          }
        }
        if (attempt < maxRefAttempts - 1) continue
      }
      throw err
    }
  }

  throw new PayableAllocationFailedError('Unable to generate a unique allocation reference')
}
