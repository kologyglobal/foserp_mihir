import { Prisma, type PayableAllocationBatch, type PayableAllocationLine } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { formatForPersistence, roundExchangeRate, toDecimal } from '../../shared/finance-decimal.js'
import { hashPayload } from '../../shared/payload-hash.js'
import {
  PayableAllocationAmountInvalidError,
  PayableAllocationBatchNotFoundError,
  PayableAllocationDirectionError,
  PayableAllocationDuplicateReferenceError,
  PayableAllocationLineConflictError,
} from './payable-allocation.errors.js'
import type {
  CreatePayableAllocationBatchRecordInput,
  CreatePayableAllocationLineRecordInput,
  ListPayableAllocationsQuery,
  PayableAllocationBatchDto,
  PayableAllocationLineDto,
} from './payable-allocation.types.js'

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function mapPayableAllocationBatchToDto(batch: PayableAllocationBatch): PayableAllocationBatchDto {
  return {
    id: batch.id,
    tenantId: batch.tenantId,
    legalEntityId: batch.legalEntityId,
    branchId: batch.branchId,
    vendorId: batch.vendorId,
    allocationReference: batch.allocationReference,
    sourceDebitOpenItemId: batch.sourceDebitOpenItemId,
    allocationDate: formatDate(batch.allocationDate)!,
    currencyCode: batch.currencyCode,
    exchangeRate: roundExchangeRate(batch.exchangeRate).toFixed(8),
    totalAllocatedAmount: formatForPersistence(batch.totalAllocatedAmount),
    baseTotalAllocatedAmount: formatForPersistence(batch.baseTotalAllocatedAmount),
    status: batch.status,
    idempotencyKey: batch.idempotencyKey,
    payloadHash: batch.payloadHash,
    createdBy: batch.createdBy,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  }
}

export function mapPayableAllocationLineToDto(line: PayableAllocationLine): PayableAllocationLineDto {
  return {
    id: line.id,
    tenantId: line.tenantId,
    legalEntityId: line.legalEntityId,
    allocationBatchId: line.allocationBatchId,
    sourceDebitOpenItemId: line.sourceDebitOpenItemId,
    targetCreditOpenItemId: line.targetCreditOpenItemId,
    amount: formatForPersistence(line.amount),
    baseAmount: formatForPersistence(line.baseAmount),
    reversedAmount: formatForPersistence(line.reversedAmount),
    baseReversedAmount: formatForPersistence(line.baseReversedAmount),
    status: line.status,
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  }
}

export interface PayableAllocationPayloadInput {
  tenantId: string
  legalEntityId: string
  vendorPaymentId?: string
  vendorAdjustmentId?: string
  sourceDebitOpenItemId: string
  allocationDate: string
  currencyCode: string
  controlAccountId: string
  lines: Array<{ targetCreditOpenItemId: string; amount: string }>
}

/**
 * Canonical SHA-256 payload hash for allocation idempotency. Excludes tokens, timestamps,
 * names, and expected-version fields. Lines are sorted by targetCreditOpenItemId.
 */
export function buildPayableAllocationPayloadHash(input: PayableAllocationPayloadInput): string {
  return hashPayload({
    tenantId: input.tenantId,
    legalEntityId: input.legalEntityId,
    vendorPaymentId: input.vendorPaymentId ?? null,
    vendorAdjustmentId: input.vendorAdjustmentId ?? null,
    sourceDebitOpenItemId: input.sourceDebitOpenItemId,
    allocationDate: input.allocationDate,
    currencyCode: input.currencyCode,
    controlAccountId: input.controlAccountId,
    lines: [...input.lines]
      .map((l) => ({ targetCreditOpenItemId: l.targetCreditOpenItemId, amount: l.amount }))
      .sort((a, b) => (a.targetCreditOpenItemId < b.targetCreditOpenItemId ? -1 : 1)),
  })
}

export async function findPayableAllocationBatchByIdempotencyKey(
  tenantId: string,
  idempotencyKey: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PayableAllocationBatch | null> {
  return client.payableAllocationBatch.findFirst({
    where: { tenantId, idempotencyKey },
  })
}

function assertPositive(value: Prisma.Decimal | number | string, label: string): void {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    throw new PayableAllocationAmountInvalidError(`${label} must be a positive amount`)
  }
}

export async function findPayableAllocationBatchById(
  tenantId: string,
  legalEntityId: string,
  id: string,
): Promise<PayableAllocationBatch | null> {
  return prisma.payableAllocationBatch.findFirst({
    where: { id, tenantId, legalEntityId },
  })
}

export async function listPayableAllocationLines(
  tenantId: string,
  legalEntityId: string,
  allocationBatchId: string,
): Promise<PayableAllocationLine[]> {
  return prisma.payableAllocationLine.findMany({
    where: { tenantId, legalEntityId, allocationBatchId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function findAllocationBatchesByDebitOpenItem(
  tenantId: string,
  legalEntityId: string,
  sourceDebitOpenItemId: string,
): Promise<PayableAllocationBatch[]> {
  return prisma.payableAllocationBatch.findMany({
    where: { tenantId, legalEntityId, sourceDebitOpenItemId },
    orderBy: { allocationDate: 'desc' },
  })
}

export async function findAllocationLinesByCreditOpenItem(
  tenantId: string,
  legalEntityId: string,
  targetCreditOpenItemId: string,
): Promise<PayableAllocationLine[]> {
  return prisma.payableAllocationLine.findMany({
    where: { tenantId, legalEntityId, targetCreditOpenItemId },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Controlled create for foundation tests / future allocation services.
 * Does not update open-item balances, create GL, or reverse allocations.
 * Enforces one-debit-to-many-credit direction rules at create time.
 */
export async function createPayableAllocationBatchRecord(
  input: CreatePayableAllocationBatchRecordInput,
): Promise<PayableAllocationBatch> {
  await getLegalEntityOrThrow(input.tenantId, input.legalEntityId)

  const debit = await prisma.payableOpenItem.findFirst({
    where: {
      id: input.sourceDebitOpenItemId,
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
    },
  })
  if (!debit) {
    throw new PayableAllocationDirectionError('Source debit open item not found in tenant/legal entity')
  }
  if (debit.side !== 'DEBIT') {
    throw new PayableAllocationDirectionError('Allocation batch source must be a DEBIT open item')
  }
  if (debit.vendorId !== input.vendorId) {
    throw new PayableAllocationDirectionError('Allocation vendor must match source debit open item vendor')
  }

  try {
    return await prisma.payableAllocationBatch.create({
      data: {
        tenantId: input.tenantId,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId ?? null,
        vendorId: input.vendorId,
        allocationReference: input.allocationReference,
        sourceDebitOpenItemId: input.sourceDebitOpenItemId,
        allocationDate: input.allocationDate,
        currencyCode: input.currencyCode ?? 'INR',
        exchangeRate: toDecimal(input.exchangeRate ?? 1),
        totalAllocatedAmount: toDecimal(input.totalAllocatedAmount ?? 0),
        baseTotalAllocatedAmount: toDecimal(input.baseTotalAllocatedAmount ?? 0),
        status: input.status ?? 'ACTIVE',
        idempotencyKey: input.idempotencyKey ?? null,
        payloadHash: input.payloadHash ?? null,
        createdBy: input.createdBy ?? null,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new PayableAllocationDuplicateReferenceError()
    }
    throw err
  }
}

/**
 * Create allocation lines for an existing batch. Does not mutate open-item outstanding.
 * No generic delete — allocation history remains for future reversal.
 */
export async function createPayableAllocationLineRecords(
  tenantId: string,
  legalEntityId: string,
  allocationBatchId: string,
  lines: CreatePayableAllocationLineRecordInput[],
): Promise<PayableAllocationLine[]> {
  const batch = await findPayableAllocationBatchById(tenantId, legalEntityId, allocationBatchId)
  if (!batch) throw new PayableAllocationBatchNotFoundError()

  const targets = new Set<string>()
  for (const line of lines) {
    assertPositive(line.amount, 'amount')
    assertPositive(line.baseAmount, 'baseAmount')
    if (targets.has(line.targetCreditOpenItemId)) {
      throw new PayableAllocationLineConflictError(
        'Each credit open item may appear only once per allocation batch',
      )
    }
    targets.add(line.targetCreditOpenItemId)

    if (line.sourceDebitOpenItemId !== batch.sourceDebitOpenItemId) {
      throw new PayableAllocationDirectionError(
        'Allocation line source must match the batch debit open item',
      )
    }

    const credit = await prisma.payableOpenItem.findFirst({
      where: {
        id: line.targetCreditOpenItemId,
        tenantId,
        legalEntityId,
      },
    })
    if (!credit) {
      throw new PayableAllocationDirectionError('Target credit open item not found in tenant/legal entity')
    }
    if (credit.side !== 'CREDIT') {
      throw new PayableAllocationDirectionError('Allocation target must be a CREDIT open item')
    }
    if (credit.vendorId !== batch.vendorId) {
      throw new PayableAllocationDirectionError('Credit open item vendor must match allocation batch vendor')
    }
    if (credit.currencyCode !== batch.currencyCode) {
      throw new PayableAllocationDirectionError(
        'Cross-currency payable allocation is not supported in Phase 4B1',
      )
    }
  }

  try {
    await prisma.payableAllocationLine.createMany({
      data: lines.map((line) => ({
        tenantId,
        legalEntityId,
        allocationBatchId,
        sourceDebitOpenItemId: line.sourceDebitOpenItemId,
        targetCreditOpenItemId: line.targetCreditOpenItemId,
        amount: toDecimal(line.amount),
        baseAmount: toDecimal(line.baseAmount),
        reversedAmount: toDecimal(line.reversedAmount ?? 0),
        baseReversedAmount: toDecimal(line.baseReversedAmount ?? 0),
        status: line.status ?? 'ACTIVE',
      })),
    })
    return listPayableAllocationLines(tenantId, legalEntityId, allocationBatchId)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new PayableAllocationLineConflictError()
    }
    throw err
  }
}

// ─── Phase 4B4 — transaction-aware create + history reads ─────────────────────

export interface CreateAllocationBatchTxInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  allocationReference: string
  sourceDebitOpenItemId: string
  allocationDate: Date
  currencyCode: string
  exchangeRate: Prisma.Decimal | string
  totalAllocatedAmount: Prisma.Decimal | string
  baseTotalAllocatedAmount: Prisma.Decimal | string
  idempotencyKey: string
  payloadHash: string
  createdBy?: string | null
}

export async function createAllocationBatchTx(
  tx: Prisma.TransactionClient,
  input: CreateAllocationBatchTxInput,
): Promise<PayableAllocationBatch> {
  return tx.payableAllocationBatch.create({
    data: {
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      vendorId: input.vendorId,
      allocationReference: input.allocationReference,
      sourceDebitOpenItemId: input.sourceDebitOpenItemId,
      allocationDate: input.allocationDate,
      currencyCode: input.currencyCode,
      exchangeRate: toDecimal(input.exchangeRate),
      totalAllocatedAmount: toDecimal(input.totalAllocatedAmount),
      baseTotalAllocatedAmount: toDecimal(input.baseTotalAllocatedAmount),
      status: 'ACTIVE',
      idempotencyKey: input.idempotencyKey,
      payloadHash: input.payloadHash,
      createdBy: input.createdBy ?? null,
    },
  })
}

export interface CreateAllocationLineTxInput {
  sourceDebitOpenItemId: string
  targetCreditOpenItemId: string
  amount: Prisma.Decimal | string
  baseAmount: Prisma.Decimal | string
}

export async function createAllocationLinesTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  legalEntityId: string,
  allocationBatchId: string,
  lines: CreateAllocationLineTxInput[],
): Promise<PayableAllocationLine[]> {
  const created: PayableAllocationLine[] = []
  for (const line of lines) {
    const row = await tx.payableAllocationLine.create({
      data: {
        tenantId,
        legalEntityId,
        allocationBatchId,
        sourceDebitOpenItemId: line.sourceDebitOpenItemId,
        targetCreditOpenItemId: line.targetCreditOpenItemId,
        amount: toDecimal(line.amount),
        baseAmount: toDecimal(line.baseAmount),
        reversedAmount: toDecimal(0),
        baseReversedAmount: toDecimal(0),
        status: 'ACTIVE',
      },
    })
    created.push(row)
  }
  return created
}

export async function findPayableAllocationBatchWithLines(
  tenantId: string,
  legalEntityId: string,
  id: string,
): Promise<(PayableAllocationBatch & { lines: PayableAllocationLine[] }) | null> {
  return prisma.payableAllocationBatch.findFirst({
    where: { id, tenantId, legalEntityId },
    include: { lines: { orderBy: { createdAt: 'asc' } } },
  })
}

export async function findPayableAllocationBatchAnyLe(
  tenantId: string,
  id: string,
): Promise<(PayableAllocationBatch & { lines: PayableAllocationLine[] }) | null> {
  return prisma.payableAllocationBatch.findFirst({
    where: { id, tenantId },
    include: { lines: { orderBy: { createdAt: 'asc' } } },
  })
}

export async function listAllocationLinesForSource(
  tenantId: string,
  legalEntityId: string,
  sourceDebitOpenItemId: string,
  query: ListPayableAllocationsQuery = {},
): Promise<{ rows: Array<PayableAllocationLine & { allocationBatch: PayableAllocationBatch }>; total: number; page: number; pageSize: number }> {
  const pageSize = query.pageSize ?? query.limit ?? 50
  const { skip, take, page, limit } = getPagination({ page: query.page ?? 1, limit: pageSize, sortOrder: 'desc' })
  const where: Prisma.PayableAllocationLineWhereInput = { tenantId, legalEntityId, sourceDebitOpenItemId }
  const [rows, total] = await Promise.all([
    prisma.payableAllocationLine.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { allocationBatch: true },
    }),
    prisma.payableAllocationLine.count({ where }),
  ])
  return { rows, total, page, pageSize: limit }
}

export async function listAllocationLinesForTarget(
  tenantId: string,
  legalEntityId: string,
  targetCreditOpenItemId: string,
  query: ListPayableAllocationsQuery = {},
): Promise<{ rows: Array<PayableAllocationLine & { allocationBatch: PayableAllocationBatch }>; total: number; page: number; pageSize: number }> {
  const pageSize = query.pageSize ?? query.limit ?? 50
  const { skip, take, page, limit } = getPagination({ page: query.page ?? 1, limit: pageSize, sortOrder: 'desc' })
  const where: Prisma.PayableAllocationLineWhereInput = { tenantId, legalEntityId, targetCreditOpenItemId }
  const [rows, total] = await Promise.all([
    prisma.payableAllocationLine.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { allocationBatch: true },
    }),
    prisma.payableAllocationLine.count({ where }),
  ])
  return { rows, total, page, pageSize: limit }
}

export async function countActiveAllocationLinesForOpenItem(
  tenantId: string,
  openItemId: string,
): Promise<number> {
  return prisma.payableAllocationLine.count({
    where: {
      tenantId,
      status: 'ACTIVE',
      OR: [{ sourceDebitOpenItemId: openItemId }, { targetCreditOpenItemId: openItemId }],
    },
  })
}
