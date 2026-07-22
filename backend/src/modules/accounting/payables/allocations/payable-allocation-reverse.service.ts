import { Prisma, type PayableAllocationLine, type PayableOpenItem } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { createAuditLog } from '../../../../services/audit.service.js'
import { resolvePeriodByDate } from '../../posting/posting-period.service.js'
import {
  formatForPersistence,
  isZero,
  sumDecimals,
  toDecimal,
} from '../../shared/finance-decimal.js'
import { parseDateOnly } from '../../shared/finance.helpers.js'
import { hashPayload } from '../../shared/payload-hash.js'
import {
  revertCreditAllocation,
  revertDebitAllocation,
} from '../open-items/payable-open-item.repository.js'
import {
  PayableAllocationAlreadyReversedError,
  PayableAllocationBatchNotFoundError,
  PayableAllocationNoActiveAmountError,
  PayableAllocationReversalConcurrentUpdateError,
  PayableAllocationReversalDateInvalidError,
  PayableAllocationReversalFailedError,
  PayableAllocationReversalLineNotFoundError,
  PayableAllocationReversalPayloadMismatchError,
  PayableAllocationReversalPeriodClosedError,
  PayableAllocationReversalPeriodUnderReviewError,
  PayableAllocationReversalStaleVersionError,
} from './payable-allocation.errors.js'
import { generatePayableAllocationReversalReference } from './payable-allocation-reference.service.js'
import type {
  ReversePayableAllocationContext,
  ReversePayableAllocationInput,
  ReversePayableAllocationResult,
} from './payable-allocation.types.js'

type Tx = Prisma.TransactionClient

function activeAmount(line: PayableAllocationLine): Prisma.Decimal {
  return toDecimal(line.amount).sub(toDecimal(line.reversedAmount))
}

function activeBaseAmount(line: PayableAllocationLine): Prisma.Decimal {
  return toDecimal(line.baseAmount).sub(toDecimal(line.baseReversedAmount))
}

function resolveStatusAfterRevert(
  outstandingAfter: Prisma.Decimal,
  allocatedAfter: Prisma.Decimal,
): 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' {
  if (isZero(outstandingAfter)) return 'SETTLED'
  if (isZero(allocatedAfter)) return 'OPEN'
  return 'PARTIALLY_SETTLED'
}

function resolveBatchStatus(
  lines: Array<{ amount: Prisma.Decimal | string; reversedAmount: Prisma.Decimal | string }>,
): 'ACTIVE' | 'PARTIALLY_REVERSED' | 'REVERSED' {
  let anyActive = false
  let anyReversed = false
  for (const line of lines) {
    const active = toDecimal(line.amount).sub(toDecimal(line.reversedAmount))
    if (active.gt(0)) anyActive = true
    if (toDecimal(line.reversedAmount).gt(0)) anyReversed = true
  }
  if (!anyActive) return 'REVERSED'
  if (anyReversed) return 'PARTIALLY_REVERSED'
  return 'ACTIVE'
}

function buildReversePayloadHash(input: {
  tenantId: string
  legalEntityId: string
  allocationBatchId: string
  lineIds: string[]
  reversalDate: string
  reason: string
}): string {
  return hashPayload({
    tenantId: input.tenantId,
    legalEntityId: input.legalEntityId,
    allocationBatchId: input.allocationBatchId,
    lineIds: [...input.lineIds].sort(),
    reversalDate: input.reversalDate,
    reason: input.reason,
  })
}

async function buildResult(
  tenantId: string,
  legalEntityId: string,
  reversalBatchId: string,
  idempotentReplay: boolean,
): Promise<ReversePayableAllocationResult> {
  const rev = await prisma.payableAllocationReversalBatch.findFirst({
    where: { id: reversalBatchId, tenantId, legalEntityId },
    include: { lines: true, allocationBatch: true },
  })
  if (!rev) throw new PayableAllocationReversalFailedError('Reversal batch missing after commit')

  const sourceAfter = await prisma.payableOpenItem.findFirstOrThrow({
    where: { id: rev.allocationBatch.sourceDebitOpenItemId, tenantId, legalEntityId },
  })

  const lines = await Promise.all(
    rev.lines.map(async (line) => {
      const target = await prisma.payableOpenItem.findFirstOrThrow({
        where: { id: line.targetCreditOpenItemId, tenantId, legalEntityId },
      })
      return {
        allocationLineId: line.allocationLineId,
        reversalLineId: line.id,
        targetCreditOpenItemId: line.targetCreditOpenItemId,
        reversedAmount: formatForPersistence(line.reversedAmount),
        baseReversedAmount: formatForPersistence(line.baseReversedAmount),
        targetAllocatedAfter: formatForPersistence(target.allocatedAmount),
        targetOutstandingAfter: formatForPersistence(target.outstandingAmount),
        targetStatusAfter: target.status,
      }
    }),
  )

  return {
    idempotentReplay,
    reversalBatchId: rev.id,
    reversalReference: rev.reversalReference,
    reversalDate: rev.reversalDate.toISOString().slice(0, 10),
    allocationBatchId: rev.allocationBatchId,
    allocationReference: rev.allocationBatch.allocationReference,
    totalReversedAmount: formatForPersistence(rev.totalReversedAmount),
    baseTotalReversedAmount: formatForPersistence(rev.baseTotalReversedAmount),
    sourceAfter: {
      openItemId: sourceAfter.id,
      allocatedAmount: formatForPersistence(sourceAfter.allocatedAmount),
      outstandingAmount: formatForPersistence(sourceAfter.outstandingAmount),
      status: sourceAfter.status,
    },
    lines,
    allocationBatchStatus: rev.allocationBatch.status,
  }
}

/**
 * Core allocation-line reverse inside an existing transaction (Phase 4C1).
 * Used by standalone reverse API and by document-reversal cascade.
 * Creates immutable reversal history; restores open-item balances; creates no GL.
 */
export async function reversePayableAllocationLinesInTx(
  tx: Tx,
  args: {
    tenantId: string
    userId: string
    batch: {
      id: string
      tenantId: string
      legalEntityId: string
      branchId: string | null
      vendorId: string
      allocationDate: Date
      sourceDebitOpenItemId: string
      status: string
      updatedAt: Date
    }
    linesToReverse: PayableAllocationLine[]
    reversalDate: Date
    reason: string
    idempotencyKey: string
    payloadHash: string
  },
): Promise<{ reversalBatchId: string; totalReversed: Prisma.Decimal; baseTotalReversed: Prisma.Decimal }> {
  const { tenantId, userId, batch, linesToReverse, reversalDate, reason, idempotencyKey, payloadHash } = args
  const legalEntityId = batch.legalEntityId

  if (linesToReverse.length === 0) throw new PayableAllocationNoActiveAmountError()

  const openItemIds = [
    ...new Set([
      batch.sourceDebitOpenItemId,
      ...linesToReverse.map((l) => l.sourceDebitOpenItemId),
      ...linesToReverse.map((l) => l.targetCreditOpenItemId),
    ]),
  ].sort()

  for (const openItemId of openItemIds) {
    await tx.$queryRaw`
      SELECT id FROM payable_open_items
      WHERE id = ${openItemId} AND tenantId = ${tenantId} AND legalEntityId = ${legalEntityId}
      FOR UPDATE
    `
  }

  const source = await tx.payableOpenItem.findFirstOrThrow({
    where: { id: batch.sourceDebitOpenItemId, tenantId, legalEntityId },
  })
  if (source.reversedAt || source.status === 'REVERSED') {
    throw new PayableAllocationReversalFailedError('Source DEBIT open item is already reversed')
  }

  const debitRestore = sumDecimals(linesToReverse.map((l) => formatForPersistence(activeAmount(l))))
  const debitBaseRestore = sumDecimals(linesToReverse.map((l) => formatForPersistence(activeBaseAmount(l))))

  const creditById = new Map<string, { amount: Prisma.Decimal; base: Prisma.Decimal }>()
  for (const line of linesToReverse) {
    const amt = activeAmount(line)
    const base = activeBaseAmount(line)
    if (!amt.gt(0)) continue
    const prev = creditById.get(line.targetCreditOpenItemId) ?? {
      amount: toDecimal(0),
      base: toDecimal(0),
    }
    creditById.set(line.targetCreditOpenItemId, {
      amount: prev.amount.add(amt),
      base: prev.base.add(base),
    })
  }

  for (const [targetId, restore] of [...creditById.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const target = await tx.payableOpenItem.findFirstOrThrow({
      where: { id: targetId, tenantId, legalEntityId },
    })
    if (target.reversedAt || target.status === 'REVERSED') {
      throw new PayableAllocationReversalFailedError('Target CREDIT open item is already reversed')
    }
    const allocatedAfter = toDecimal(target.allocatedAmount).sub(restore.amount)
    const outstandingAfter = toDecimal(target.outstandingAmount).add(restore.amount)
    if (allocatedAfter.lt(0)) {
      throw new PayableAllocationReversalConcurrentUpdateError('Target allocated amount would go negative')
    }
    const status = resolveStatusAfterRevert(outstandingAfter, allocatedAfter)
    const count = await revertCreditAllocation(tx, {
      tenantId,
      legalEntityId,
      openItemId: target.id,
      expectedOutstandingAmount: target.outstandingAmount,
      expectedAllocatedAmount: target.allocatedAmount,
      expectedBaseOutstandingAmount: target.baseOutstandingAmount,
      expectedBaseAllocatedAmount: target.baseAllocatedAmount,
      allocationAmount: restore.amount,
      baseAllocationAmount: restore.base,
      newStatus: status,
      settledAt: status === 'SETTLED' ? target.settledAt : null,
      updatedBy: userId,
    })
    if (count !== 1) throw new PayableAllocationReversalConcurrentUpdateError()
  }

  const sourceAllocatedAfter = toDecimal(source.allocatedAmount).sub(debitRestore)
  const sourceOutstandingAfter = toDecimal(source.outstandingAmount).add(debitRestore)
  if (sourceAllocatedAfter.lt(0)) {
    throw new PayableAllocationReversalConcurrentUpdateError('Source allocated amount would go negative')
  }
  const sourceStatus = resolveStatusAfterRevert(sourceOutstandingAfter, sourceAllocatedAfter)
  const sourceCount = await revertDebitAllocation(tx, {
    tenantId,
    legalEntityId,
    openItemId: source.id,
    expectedOutstandingAmount: source.outstandingAmount,
    expectedAllocatedAmount: source.allocatedAmount,
    expectedBaseOutstandingAmount: source.baseOutstandingAmount,
    expectedBaseAllocatedAmount: source.baseAllocatedAmount,
    allocationAmount: debitRestore,
    baseAllocationAmount: debitBaseRestore,
    newStatus: sourceStatus,
    settledAt: sourceStatus === 'SETTLED' ? source.settledAt : null,
    updatedBy: userId,
  })
  if (sourceCount !== 1) throw new PayableAllocationReversalConcurrentUpdateError()

  const reversalReference = await generatePayableAllocationReversalReference(tenantId, reversalDate, tx)

  const revBatch = await tx.payableAllocationReversalBatch.create({
    data: {
      tenantId,
      legalEntityId,
      branchId: batch.branchId,
      vendorId: batch.vendorId,
      allocationBatchId: batch.id,
      reversalReference,
      reversalDate,
      reason,
      totalReversedAmount: toDecimal(debitRestore),
      baseTotalReversedAmount: toDecimal(debitBaseRestore),
      idempotencyKey,
      payloadHash,
      createdById: userId,
    },
  })

  for (const line of linesToReverse) {
    const amt = activeAmount(line)
    const base = activeBaseAmount(line)
    if (!amt.gt(0)) continue

    await tx.payableAllocationReversalLine.create({
      data: {
        tenantId,
        legalEntityId,
        reversalBatchId: revBatch.id,
        allocationLineId: line.id,
        sourceDebitOpenItemId: line.sourceDebitOpenItemId,
        targetCreditOpenItemId: line.targetCreditOpenItemId,
        reversedAmount: amt,
        baseReversedAmount: base,
      },
    })

    const newReversed = toDecimal(line.reversedAmount).add(amt)
    const newBaseReversed = toDecimal(line.baseReversedAmount).add(base)
    const lineStatus = newReversed.eq(toDecimal(line.amount))
      ? 'REVERSED'
      : newReversed.gt(0)
        ? 'PARTIALLY_REVERSED'
        : 'ACTIVE'

    const updated = await tx.payableAllocationLine.updateMany({
      where: {
        id: line.id,
        tenantId,
        legalEntityId,
        reversedAmount: line.reversedAmount,
        status: { in: ['ACTIVE', 'PARTIALLY_REVERSED'] },
      },
      data: {
        reversedAmount: newReversed,
        baseReversedAmount: newBaseReversed,
        status: lineStatus,
      },
    })
    if (updated.count !== 1) throw new PayableAllocationReversalConcurrentUpdateError()
  }

  const allLines = await tx.payableAllocationLine.findMany({
    where: { allocationBatchId: batch.id, tenantId },
    select: { amount: true, reversedAmount: true },
  })
  const batchStatus = resolveBatchStatus(allLines)
  await tx.payableAllocationBatch.update({
    where: { id: batch.id },
    data: { status: batchStatus },
  })

  return {
    reversalBatchId: revBatch.id,
    totalReversed: toDecimal(debitRestore),
    baseTotalReversed: toDecimal(debitBaseRestore),
  }
}

export async function reversePayableAllocation(
  input: ReversePayableAllocationInput,
  context: ReversePayableAllocationContext,
): Promise<ReversePayableAllocationResult> {
  // Idempotency check first — before active-line resolution (fully reversed batches have no active lines).
  const prior = await prisma.payableAllocationReversalBatch.findFirst({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (prior) {
    const expectedLineIds = input.lineIds?.length
      ? [...new Set(input.lineIds)].sort()
      : (
          await prisma.payableAllocationReversalLine.findMany({
            where: { reversalBatchId: prior.id },
            select: { allocationLineId: true },
          })
        )
          .map((l) => l.allocationLineId)
          .sort()

    const replayHash = buildReversePayloadHash({
      tenantId: context.tenantId,
      legalEntityId: prior.legalEntityId,
      allocationBatchId: prior.allocationBatchId,
      lineIds: expectedLineIds,
      reversalDate: input.reversalDate,
      reason: input.reason,
    })

    if (
      prior.payloadHash === replayHash &&
      prior.tenantId === context.tenantId &&
      prior.allocationBatchId === input.allocationBatchId
    ) {
      return buildResult(context.tenantId, prior.legalEntityId, prior.id, true)
    }
    throw new PayableAllocationReversalPayloadMismatchError()
  }

  const existing = await prisma.payableAllocationBatch.findFirst({
    where: { id: input.allocationBatchId, tenantId: context.tenantId },
    include: { lines: true },
  })
  if (!existing) throw new PayableAllocationBatchNotFoundError()

  const selectedLineIds = input.lineIds?.length
    ? [...new Set(input.lineIds)].sort()
    : existing.lines
        .filter((l) => activeAmount(l).gt(0))
        .map((l) => l.id)
        .sort()

  const payloadHash = buildReversePayloadHash({
    tenantId: context.tenantId,
    legalEntityId: existing.legalEntityId,
    allocationBatchId: existing.id,
    lineIds: selectedLineIds,
    reversalDate: input.reversalDate,
    reason: input.reason,
  })

  if (existing.status === 'REVERSED') throw new PayableAllocationAlreadyReversedError()
  if (existing.status !== 'ACTIVE' && existing.status !== 'PARTIALLY_REVERSED') {
    throw new PayableAllocationAlreadyReversedError(`Allocation batch status ${existing.status} is not reversible`)
  }

  if (existing.updatedAt.toISOString() !== input.expectedAllocationUpdatedAt) {
    throw new PayableAllocationReversalStaleVersionError('Allocation batch version mismatch')
  }

  const linesToReverse: PayableAllocationLine[] = []
  for (const lineId of selectedLineIds) {
    const line = existing.lines.find((l) => l.id === lineId)
    if (!line) throw new PayableAllocationReversalLineNotFoundError()
    if (!activeAmount(line).gt(0)) {
      throw new PayableAllocationNoActiveAmountError(`Line ${lineId} has no active amount`)
    }
    if (input.expectedLines?.length) {
      const expected = input.expectedLines.find((e) => e.allocationLineId === lineId)
      if (expected && line.updatedAt.toISOString() !== expected.expectedUpdatedAt) {
        throw new PayableAllocationReversalStaleVersionError(`Allocation line ${lineId} version mismatch`)
      }
    }
    linesToReverse.push(line)
  }
  if (linesToReverse.length === 0) throw new PayableAllocationNoActiveAmountError()

  const reversalDateValue = parseDateOnly(input.reversalDate)
  if (reversalDateValue < parseDateOnly(existing.allocationDate.toISOString().slice(0, 10))) {
    throw new PayableAllocationReversalDateInvalidError('Reversal date must be on or after allocation date')
  }

  const period = await resolvePeriodByDate(context.tenantId, existing.legalEntityId, input.reversalDate)
  if (period.period.status === 'CLOSED') throw new PayableAllocationReversalPeriodClosedError()
  if (period.period.status === 'UNDER_REVIEW') throw new PayableAllocationReversalPeriodUnderReviewError()

  const openItems = await prisma.payableOpenItem.findMany({
    where: {
      tenantId: context.tenantId,
      legalEntityId: existing.legalEntityId,
      id: {
        in: [
          existing.sourceDebitOpenItemId,
          ...linesToReverse.map((l) => l.targetCreditOpenItemId),
        ],
      },
    },
  })
  for (const oi of openItems) {
    if (reversalDateValue < parseDateOnly(oi.postingDate.toISOString().slice(0, 10))) {
      throw new PayableAllocationReversalDateInvalidError(
        'Reversal date must not precede source or target document posting dates',
      )
    }
    if (input.expectedOpenItems?.length) {
      const expected = input.expectedOpenItems.find((e) => e.openItemId === oi.id)
      if (expected && oi.updatedAt.toISOString() !== expected.expectedUpdatedAt) {
        throw new PayableAllocationReversalStaleVersionError(`Open item ${oi.id} version mismatch`)
      }
    }
  }

  let reversalBatchId: string
  try {
    const result = await prisma.$transaction(
      async (tx) =>
        reversePayableAllocationLinesInTx(tx, {
          tenantId: context.tenantId,
          userId: context.userId,
          batch: existing,
          linesToReverse,
          reversalDate: reversalDateValue,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30000 },
    )
    reversalBatchId = result.reversalBatchId
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await prisma.payableAllocationReversalBatch.findFirst({
        where: { idempotencyKey: input.idempotencyKey },
      })
      if (raced?.payloadHash === payloadHash && raced.tenantId === context.tenantId) {
        return buildResult(context.tenantId, raced.legalEntityId, raced.id, true)
      }
      throw new PayableAllocationReversalPayloadMismatchError()
    }
    throw err
  }

  await createAuditLog({
    tenantId: context.tenantId,
    userId: context.userId,
    module: 'finance',
    entity: 'payable_allocation_batch',
    entityId: existing.id,
    action: 'PAYABLE_ALLOCATION_REVERSED',
    newValues: {
      reversalBatchId,
      allocationReference: existing.allocationReference,
      reason: input.reason,
      reversalDate: input.reversalDate,
      lineCount: linesToReverse.length,
    },
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  })

  return buildResult(context.tenantId, existing.legalEntityId, reversalBatchId, false)
}

/** Detect active allocation lines for a DEBIT (payment) or CREDIT (invoice) open item. */
export async function findActivePayableAllocationLinesForOpenItem(
  tenantId: string,
  legalEntityId: string,
  openItemId: string,
  side: 'DEBIT' | 'CREDIT',
): Promise<
  Array<
    PayableAllocationLine & {
      allocationBatch: {
        id: string
        allocationReference: string
        allocationDate: Date
        status: string
      }
    }
  >
> {
  const where =
    side === 'DEBIT'
      ? {
          tenantId,
          legalEntityId,
          sourceDebitOpenItemId: openItemId,
          status: { in: ['ACTIVE', 'PARTIALLY_REVERSED'] as PayableAllocationLine['status'][] },
        }
      : {
          tenantId,
          legalEntityId,
          targetCreditOpenItemId: openItemId,
          status: { in: ['ACTIVE', 'PARTIALLY_REVERSED'] as PayableAllocationLine['status'][] },
        }

  const lines = await prisma.payableAllocationLine.findMany({
    where,
    include: {
      allocationBatch: {
        select: { id: true, allocationReference: true, allocationDate: true, status: true },
      },
    },
  })

  return lines
    .filter((l) => activeAmount(l).gt(0))
    .sort((a, b) => {
      const dateCmp = b.allocationBatch.allocationDate.getTime() - a.allocationBatch.allocationDate.getTime()
      if (dateCmp !== 0) return dateCmp
      const batchCmp = a.allocationBatchId.localeCompare(b.allocationBatchId)
      if (batchCmp !== 0) return batchCmp
      return a.id.localeCompare(b.id)
    })
}

export function lineActiveAmount(line: PayableAllocationLine): string {
  return formatForPersistence(activeAmount(line))
}

export type { PayableOpenItem }
