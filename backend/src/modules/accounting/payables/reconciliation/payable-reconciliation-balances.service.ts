import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence, subtract, sumDecimals, toDecimal } from '../../shared/finance-decimal.js'
import type { ReconciledOpenItemAsOf } from './payable-reconciliation.types.js'

type DecimalLike = Prisma.Decimal

export interface AccountAggregate {
  glBalance: DecimalLike
  subledgerBalance: DecimalLike
  openItemCount: number
}

/** GL balance per control account: baseCredit − baseDebit (liability normal balance), postingDate ≤ asOfDate. */
export async function aggregateGlByAccount(
  tenantId: string,
  legalEntityId: string,
  accountIds: string[],
  asOfDate: Date,
): Promise<Map<string, DecimalLike>> {
  if (accountIds.length === 0) return new Map()
  const rows = await prisma.generalLedgerEntry.groupBy({
    by: ['accountId'],
    where: { tenantId, legalEntityId, accountId: { in: accountIds }, postingDate: { lte: asOfDate } },
    _sum: { baseCreditAmount: true, baseDebitAmount: true },
  })
  const map = new Map<string, DecimalLike>()
  for (const row of rows) {
    const credit = row._sum.baseCreditAmount ?? toDecimal(0)
    const debit = row._sum.baseDebitAmount ?? toDecimal(0)
    map.set(row.accountId, credit.sub(debit))
  }
  return map
}

/** GL balance per vendor party (partyType VENDOR) across the given control accounts. */
export async function aggregateGlByVendor(
  tenantId: string,
  legalEntityId: string,
  accountIds: string[],
  asOfDate: Date,
): Promise<Map<string, DecimalLike>> {
  if (accountIds.length === 0) return new Map()
  const rows = await prisma.generalLedgerEntry.groupBy({
    by: ['partyId'],
    where: {
      tenantId,
      legalEntityId,
      accountId: { in: accountIds },
      partyType: 'VENDOR',
      partyId: { not: null },
      postingDate: { lte: asOfDate },
    },
    _sum: { baseCreditAmount: true, baseDebitAmount: true },
  })
  const map = new Map<string, DecimalLike>()
  for (const row of rows) {
    if (!row.partyId) continue
    const credit = row._sum.baseCreditAmount ?? toDecimal(0)
    const debit = row._sum.baseDebitAmount ?? toDecimal(0)
    map.set(row.partyId, credit.sub(debit))
  }
  return map
}

/** Current-balance subledger: CREDIT outstanding − DEBIT outstanding, grouped by account. */
export async function aggregateCurrentSubledgerByAccount(
  tenantId: string,
  legalEntityId: string,
  accountIds: string[],
): Promise<Map<string, { balance: DecimalLike; count: number }>> {
  if (accountIds.length === 0) return new Map()
  const rows = await prisma.payableOpenItem.groupBy({
    by: ['vendorPayableAccountId', 'side'],
    where: { tenantId, legalEntityId, vendorPayableAccountId: { in: accountIds } },
    _sum: { baseOutstandingAmount: true },
    _count: { _all: true },
  })
  const map = new Map<string, { balance: DecimalLike; count: number }>()
  for (const row of rows) {
    const accountId = row.vendorPayableAccountId
    const existing = map.get(accountId) ?? { balance: toDecimal(0), count: 0 }
    const amount = row._sum.baseOutstandingAmount ?? toDecimal(0)
    const signed = row.side === 'CREDIT' ? amount : amount.neg()
    map.set(accountId, { balance: existing.balance.add(signed), count: existing.count + row._count._all })
  }
  return map
}

/** Current-balance subledger: CREDIT outstanding − DEBIT outstanding, grouped by vendor. */
export async function aggregateCurrentSubledgerByVendor(
  tenantId: string,
  legalEntityId: string,
  accountIds: string[],
): Promise<Map<string, { balance: DecimalLike; count: number }>> {
  if (accountIds.length === 0) return new Map()
  const rows = await prisma.payableOpenItem.groupBy({
    by: ['vendorId', 'side'],
    where: { tenantId, legalEntityId, vendorPayableAccountId: { in: accountIds } },
    _sum: { baseOutstandingAmount: true },
    _count: { _all: true },
  })
  const map = new Map<string, { balance: DecimalLike; count: number }>()
  for (const row of rows) {
    const existing = map.get(row.vendorId) ?? { balance: toDecimal(0), count: 0 }
    const amount = row._sum.baseOutstandingAmount ?? toDecimal(0)
    const signed = row.side === 'CREDIT' ? amount : amount.neg()
    map.set(row.vendorId, { balance: existing.balance.add(signed), count: existing.count + row._count._all })
  }
  return map
}

/**
 * Reconstructs each open item's outstanding balance "as of" a historical date.
 *
 * Limitations (documented per Phase 4D2 scope — see task notes):
 *  - `adjustedAmount` / `writtenOffAmount` are not date-tracked anywhere in the AP pipeline
 *    today (they remain 0 for every open item as of this phase), so the reconstruction uses
 *    only `originalAmount − allocatedAsOf`. If dated adjustment/write-off tracking is added
 *    later, this function must be revisited.
 *  - An open item is excluded entirely (treated as fully settled/void) once its source
 *    document's business `reversalDate` is on or before `asOfDate` — mirroring how the
 *    reversal's own GL entries would already be included in the GL side of the comparison
 *    by that date.
 *  - Allocation "as of" amounts are derived from `PayableAllocationBatch.allocationDate` and
 *    `PayableAllocationReversalBatch.reversalDate`, not from posting/document dates.
 */
export async function reconstructOpenItemsAsOf(
  tenantId: string,
  legalEntityId: string,
  accountIds: string[],
  asOfDate: Date,
): Promise<ReconciledOpenItemAsOf[]> {
  if (accountIds.length === 0) return []

  const openItems = await prisma.payableOpenItem.findMany({
    where: {
      tenantId,
      legalEntityId,
      vendorPayableAccountId: { in: accountIds },
      postingDate: { lte: asOfDate },
    },
    select: {
      id: true,
      vendorId: true,
      vendorPayableAccountId: true,
      side: true,
      baseOriginalAmount: true,
      sourceVendorInvoiceId: true,
      sourceVendorPaymentId: true,
      sourceVendorAdjustmentId: true,
    },
  })
  if (openItems.length === 0) return []

  const invoiceIds = openItems.map((o) => o.sourceVendorInvoiceId).filter((v): v is string => Boolean(v))
  const paymentIds = openItems.map((o) => o.sourceVendorPaymentId).filter((v): v is string => Boolean(v))
  const adjustmentIds = openItems.map((o) => o.sourceVendorAdjustmentId).filter((v): v is string => Boolean(v))

  const [invoices, payments, adjustments] = await Promise.all([
    invoiceIds.length
      ? prisma.vendorInvoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, status: true, reversalDate: true } })
      : Promise.resolve([]),
    paymentIds.length
      ? prisma.vendorPayment.findMany({ where: { id: { in: paymentIds } }, select: { id: true, status: true, reversalDate: true } })
      : Promise.resolve([]),
    adjustmentIds.length
      ? prisma.vendorAdjustment.findMany({ where: { id: { in: adjustmentIds } }, select: { id: true, status: true, reversalDate: true } })
      : Promise.resolve([]),
  ])
  const invoiceReversalDate = new Map(invoices.map((i) => [i.id, i.status === 'REVERSED' ? i.reversalDate : null]))
  const paymentReversalDate = new Map(payments.map((p) => [p.id, p.status === 'REVERSED' ? p.reversalDate : null]))
  const adjustmentReversalDate = new Map(adjustments.map((a) => [a.id, a.status === 'REVERSED' ? a.reversalDate : null]))

  const openItemIds = openItems.map((o) => o.id)
  const allocationLines = await prisma.payableAllocationLine.findMany({
    where: {
      tenantId,
      legalEntityId,
      OR: [{ sourceDebitOpenItemId: { in: openItemIds } }, { targetCreditOpenItemId: { in: openItemIds } }],
      allocationBatch: { allocationDate: { lte: asOfDate } },
    },
    select: { id: true, sourceDebitOpenItemId: true, targetCreditOpenItemId: true, baseAmount: true },
  })
  const allocationLineIds = allocationLines.map((l) => l.id)
  const reversalLines = allocationLineIds.length
    ? await prisma.payableAllocationReversalLine.findMany({
        where: { allocationLineId: { in: allocationLineIds }, reversalBatch: { reversalDate: { lte: asOfDate } } },
        select: { allocationLineId: true, baseReversedAmount: true },
      })
    : []
  const reversedByLineId = new Map<string, DecimalLike>()
  for (const r of reversalLines) {
    reversedByLineId.set(r.allocationLineId, (reversedByLineId.get(r.allocationLineId) ?? toDecimal(0)).add(r.baseReversedAmount))
  }

  const allocatedAsOfByOpenItem = new Map<string, DecimalLike>()
  for (const line of allocationLines) {
    const netLineAmount = line.baseAmount.sub(reversedByLineId.get(line.id) ?? toDecimal(0))
    for (const itemId of new Set([line.sourceDebitOpenItemId, line.targetCreditOpenItemId])) {
      allocatedAsOfByOpenItem.set(itemId, (allocatedAsOfByOpenItem.get(itemId) ?? toDecimal(0)).add(netLineAmount))
    }
  }

  const result: ReconciledOpenItemAsOf[] = []
  for (const item of openItems) {
    const sourceReversalDate =
      invoiceReversalDate.get(item.sourceVendorInvoiceId ?? '') ??
      paymentReversalDate.get(item.sourceVendorPaymentId ?? '') ??
      adjustmentReversalDate.get(item.sourceVendorAdjustmentId ?? '') ??
      null
    if (sourceReversalDate && sourceReversalDate.getTime() <= asOfDate.getTime()) {
      continue
    }
    const allocatedAsOf = allocatedAsOfByOpenItem.get(item.id) ?? toDecimal(0)
    const outstandingAsOf = item.baseOriginalAmount.sub(allocatedAsOf)
    result.push({
      id: item.id,
      vendorId: item.vendorId,
      vendorPayableAccountId: item.vendorPayableAccountId,
      side: item.side,
      baseOutstandingAsOf: formatForPersistence(outstandingAsOf),
    })
  }
  return result
}

export function aggregateAsOfByAccount(items: ReconciledOpenItemAsOf[]): Map<string, { balance: DecimalLike; count: number }> {
  const map = new Map<string, { balance: DecimalLike; count: number }>()
  for (const item of items) {
    const existing = map.get(item.vendorPayableAccountId) ?? { balance: toDecimal(0), count: 0 }
    const amount = toDecimal(item.baseOutstandingAsOf)
    const signed = item.side === 'CREDIT' ? amount : amount.neg()
    map.set(item.vendorPayableAccountId, { balance: existing.balance.add(signed), count: existing.count + 1 })
  }
  return map
}

export function aggregateAsOfByVendor(items: ReconciledOpenItemAsOf[]): Map<string, { balance: DecimalLike; count: number }> {
  const map = new Map<string, { balance: DecimalLike; count: number }>()
  for (const item of items) {
    const existing = map.get(item.vendorId) ?? { balance: toDecimal(0), count: 0 }
    const amount = toDecimal(item.baseOutstandingAsOf)
    const signed = item.side === 'CREDIT' ? amount : amount.neg()
    map.set(item.vendorId, { balance: existing.balance.add(signed), count: existing.count + 1 })
  }
  return map
}

export function sumMapValues(map: Map<string, DecimalLike> | Map<string, { balance: DecimalLike }>): DecimalLike {
  return sumDecimals([...map.values()].map((v) => ('balance' in v ? v.balance : v).toString()))
}

export function computeVariance(glBalance: DecimalLike, subledgerBalance: DecimalLike): DecimalLike {
  return subtract(glBalance, subledgerBalance)
}
