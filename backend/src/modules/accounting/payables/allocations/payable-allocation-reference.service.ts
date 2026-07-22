import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'

const PREFIX_ROOT = 'APALLOC'

/** Financial-year label `YY-YY` (April–March) derived from an allocation date. */
export function buildPayableAllocationFyLabel(date: Date): string {
  const month = date.getUTCMonth() // 0 = Jan
  const year = date.getUTCFullYear()
  const fyStart = month >= 3 ? year : year - 1
  const fyEnd = fyStart + 1
  return `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`
}

export function buildPayableAllocationReferencePrefix(allocationDate: Date): string {
  return `${PREFIX_ROOT}/${buildPayableAllocationFyLabel(allocationDate)}/`
}

/**
 * Generate the next `APALLOC/YY-YY/######` reference unique per tenant.
 * Atomic best-effort (gaps allowed). Does NOT consume a FinanceNumberSeries / voucher / payment series.
 * Callers must handle a P2002 on `pay_alloc_batch_ref_key` by regenerating and retrying.
 */
export async function generatePayableAllocationReference(
  tenantId: string,
  allocationDate: Date,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const prefix = buildPayableAllocationReferencePrefix(allocationDate)
  const latest = await client.payableAllocationBatch.findFirst({
    where: { tenantId, allocationReference: { startsWith: prefix } },
    orderBy: { allocationReference: 'desc' },
    select: { allocationReference: true },
  })

  let nextSeq = 1
  if (latest?.allocationReference) {
    const tail = latest.allocationReference.slice(prefix.length)
    const parsed = Number.parseInt(tail, 10)
    if (Number.isFinite(parsed) && parsed >= 0) nextSeq = parsed + 1
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`
}

const REVERSAL_PREFIX_ROOT = 'APALLOCREV'

export function buildPayableAllocationReversalReferencePrefix(reversalDate: Date): string {
  return `${REVERSAL_PREFIX_ROOT}/${buildPayableAllocationFyLabel(reversalDate)}/`
}

/**
 * Generate the next `APALLOCREV/YY-YY/######` reference unique per tenant.
 * Does NOT consume FinanceNumberSeries / voucher series.
 */
export async function generatePayableAllocationReversalReference(
  tenantId: string,
  reversalDate: Date,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const prefix = buildPayableAllocationReversalReferencePrefix(reversalDate)
  const latest = await client.payableAllocationReversalBatch.findFirst({
    where: { tenantId, reversalReference: { startsWith: prefix } },
    orderBy: { reversalReference: 'desc' },
    select: { reversalReference: true },
  })

  let nextSeq = 1
  if (latest?.reversalReference) {
    const tail = latest.reversalReference.slice(prefix.length)
    const parsed = Number.parseInt(tail, 10)
    if (Number.isFinite(parsed) && parsed >= 0) nextSeq = parsed + 1
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`
}
