/**
 * Aggregated AP reversal history — vendor invoices/payments/adjustments + allocation reversals.
 */
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'

export type ApReversalDocumentType = 'payment' | 'invoice' | 'adjustment' | 'allocation'

export interface ApReversalHistoryRow {
  id: string
  documentType: ApReversalDocumentType
  documentId: string
  documentNumber: string | null
  reversalDate: string
  reason: string
  reversedBy: string | null
  reversedAt: string
  reversalVoucherNumber: string | null
}

export interface ListApReversalHistoryQuery {
  legalEntityId?: string
  page?: number
  limit?: number
}

function isoDate(d: Date | null | undefined): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

function isoTs(d: Date | null | undefined): string {
  return d?.toISOString() ?? ''
}

export async function listApReversalHistory(
  tenantId: string,
  query: ListApReversalHistoryQuery = {},
): Promise<{ items: ApReversalHistoryRow[]; total: number; page: number; limit: number }> {
  const { page, limit, skip } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 50,
    sortOrder: 'desc',
  })
  const le = query.legalEntityId

  const [invoices, payments, adjustments, allocReversals] = await Promise.all([
    prisma.vendorInvoice.findMany({
      where: {
        tenantId,
        status: 'REVERSED',
        ...(le ? { legalEntityId: le } : {}),
      },
      select: {
        id: true,
        vendorInvoiceNumber: true,
        draftReference: true,
        reversalDate: true,
        reversalReason: true,
        reversedBy: true,
        reversedAt: true,
        reversalVoucher: { select: { voucherNumber: true } },
      },
      orderBy: { reversedAt: 'desc' },
      take: 500,
    }),
    prisma.vendorPayment.findMany({
      where: {
        tenantId,
        status: 'REVERSED',
        ...(le ? { legalEntityId: le } : {}),
      },
      select: {
        id: true,
        vendorPaymentNumber: true,
        draftReference: true,
        reversalDate: true,
        reversalReason: true,
        reversedBy: true,
        reversedAt: true,
        reversalVoucher: { select: { voucherNumber: true } },
      },
      orderBy: { reversedAt: 'desc' },
      take: 500,
    }),
    prisma.vendorAdjustment.findMany({
      where: {
        tenantId,
        status: 'REVERSED',
        ...(le ? { legalEntityId: le } : {}),
      },
      select: {
        id: true,
        vendorAdjustmentNumber: true,
        draftReference: true,
        reversalDate: true,
        reversalReason: true,
        reversedBy: true,
        reversedAt: true,
        reversalVoucher: { select: { voucherNumber: true } },
      },
      orderBy: { reversedAt: 'desc' },
      take: 500,
    }),
    prisma.payableAllocationReversalBatch.findMany({
      where: {
        tenantId,
        ...(le ? { legalEntityId: le } : {}),
      },
      select: {
        id: true,
        allocationBatchId: true,
        reversalReference: true,
        reversalDate: true,
        reason: true,
        createdById: true,
        createdAt: true,
        allocationBatch: { select: { allocationReference: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
  ])

  const rows: ApReversalHistoryRow[] = [
    ...invoices.map((r) => ({
      id: `invoice:${r.id}`,
      documentType: 'invoice' as const,
      documentId: r.id,
      documentNumber: r.vendorInvoiceNumber ?? r.draftReference,
      reversalDate: isoDate(r.reversalDate ?? r.reversedAt),
      reason: r.reversalReason ?? '',
      reversedBy: r.reversedBy,
      reversedAt: isoTs(r.reversedAt),
      reversalVoucherNumber: r.reversalVoucher?.voucherNumber ?? null,
    })),
    ...payments.map((r) => ({
      id: `payment:${r.id}`,
      documentType: 'payment' as const,
      documentId: r.id,
      documentNumber: r.vendorPaymentNumber ?? r.draftReference,
      reversalDate: isoDate(r.reversalDate ?? r.reversedAt),
      reason: r.reversalReason ?? '',
      reversedBy: r.reversedBy,
      reversedAt: isoTs(r.reversedAt),
      reversalVoucherNumber: r.reversalVoucher?.voucherNumber ?? null,
    })),
    ...adjustments.map((r) => ({
      id: `adjustment:${r.id}`,
      documentType: 'adjustment' as const,
      documentId: r.id,
      documentNumber: r.vendorAdjustmentNumber ?? r.draftReference,
      reversalDate: isoDate(r.reversalDate ?? r.reversedAt),
      reason: r.reversalReason ?? '',
      reversedBy: r.reversedBy,
      reversedAt: isoTs(r.reversedAt),
      reversalVoucherNumber: r.reversalVoucher?.voucherNumber ?? null,
    })),
    ...allocReversals.map((r) => ({
      id: `allocation:${r.id}`,
      documentType: 'allocation' as const,
      documentId: r.allocationBatchId,
      documentNumber: r.allocationBatch.allocationReference ?? r.reversalReference,
      reversalDate: isoDate(r.reversalDate),
      reason: r.reason,
      reversedBy: r.createdById,
      reversedAt: isoTs(r.createdAt),
      reversalVoucherNumber: null,
    })),
  ]

  rows.sort((a, b) => (a.reversedAt < b.reversedAt ? 1 : a.reversedAt > b.reversedAt ? -1 : 0))

  const total = rows.length
  const items = rows.slice(skip, skip + limit)
  return { items, total, page, limit }
}
