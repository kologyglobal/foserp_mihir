import type { PayableOpenItem, Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence, min, roundExchangeRate, subtract, toDecimal } from '../../shared/finance-decimal.js'
import {
  PayableAllocationBatchNotFoundError,
  PayableAllocationPaymentNotFoundError,
} from './payable-allocation.errors.js'
import {
  findPayableAllocationBatchAnyLe,
  listAllocationLinesForSource,
  listAllocationLinesForTarget,
  mapPayableAllocationBatchToDto,
  mapPayableAllocationLineToDto,
} from './payable-allocation.repository.js'
import { resolvePaymentSourceOpenItem, resolveAdjustmentSourceOpenItem } from './payable-allocation-validation.service.js'
import type {
  AllocatableInvoiceItemDto,
  ListPayableAllocationsQuery,
  PayableAllocationHistoryRow,
} from './payable-allocation.types.js'

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

/**
 * CREDIT VENDOR_INVOICE open items eligible for allocation against a posted payment's DEBIT source.
 * Ordered dueDate asc, postingDate asc, documentNumber asc. Walks a running suggestion using the
 * remaining source outstanding (or an explicit targetAmount override).
 */
export async function getAllocatableInvoicesForPayment(
  tenantId: string,
  vendorPaymentId: string,
  query: { targetAmount?: string; page?: number; pageSize?: number; limit?: number } = {},
): Promise<{
  items: AllocatableInvoiceItemDto[]
  total: number
  sourceOutstanding: string
  sourceUpdatedAt: string | null
  currencyCode: string
}> {
  const payment = await prisma.vendorPayment.findFirst({ where: { id: vendorPaymentId, tenantId } })
  if (!payment) throw new PayableAllocationPaymentNotFoundError()

  if (payment.status !== 'POSTED') {
    return { items: [], total: 0, sourceOutstanding: '0.0000', sourceUpdatedAt: null, currencyCode: payment.currencyCode }
  }

  let source: PayableOpenItem
  try {
    source = await resolvePaymentSourceOpenItem(tenantId, payment)
  } catch {
    return { items: [], total: 0, sourceOutstanding: '0.0000', sourceUpdatedAt: null, currencyCode: payment.currencyCode }
  }

  const where: Prisma.PayableOpenItemWhereInput = {
    tenantId,
    legalEntityId: payment.legalEntityId,
    vendorId: source.vendorId,
    side: 'CREDIT',
    documentType: 'VENDOR_INVOICE',
    currencyCode: source.currencyCode,
    vendorPayableAccountId: source.vendorPayableAccountId,
    status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
    outstandingAmount: { gt: 0 },
    reversedAt: null,
  }

  const items = await prisma.payableOpenItem.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { postingDate: 'asc' }, { documentNumber: 'asc' }],
    include: {
      sourceVendorInvoice: { select: { id: true, vendorInvoiceNumber: true, supplierInvoiceNumber: true } },
    },
  })

  let remaining = query.targetAmount ? toDecimal(query.targetAmount) : toDecimal(source.outstandingAmount)
  const sourceOutstanding = formatForPersistence(source.outstandingAmount)

  const dtos: AllocatableInvoiceItemDto[] = items.map((item) => {
    const outstanding = toDecimal(item.outstandingAmount)
    const suggested = remaining.gt(0) ? min(remaining, outstanding) : toDecimal(0)
    remaining = subtract(remaining, suggested)
    return {
      vendorInvoiceId: item.sourceVendorInvoiceId,
      openItemId: item.id,
      documentNumber: item.documentNumber,
      supplierInvoiceNumber: item.sourceVendorInvoice?.supplierInvoiceNumber ?? null,
      documentDate: formatDate(item.documentDate),
      postingDate: formatDate(item.postingDate),
      dueDate: formatDate(item.dueDate),
      currencyCode: item.currencyCode,
      exchangeRate: roundExchangeRate(item.exchangeRate).toFixed(8),
      originalAmount: formatForPersistence(item.originalAmount),
      outstandingAmount: formatForPersistence(item.outstandingAmount),
      baseOutstandingAmount: formatForPersistence(item.baseOutstandingAmount),
      status: item.status,
      suggestedAllocationAmount: formatForPersistence(suggested),
      updatedAt: item.updatedAt.toISOString(),
    }
  })

  return {
    items: dtos,
    total: dtos.length,
    sourceOutstanding,
    sourceUpdatedAt: source.updatedAt.toISOString(),
    currencyCode: source.currencyCode,
  }
}

/** CREDIT payables (invoices + credit adjustments) eligible for allocation from a posted debit note DEBIT source. */
export async function getAllocatablePayablesForDebitNote(
  tenantId: string,
  vendorAdjustmentId: string,
  query: { targetAmount?: string; page?: number; pageSize?: number; limit?: number } = {},
): Promise<{
  items: AllocatableInvoiceItemDto[]
  total: number
  sourceOutstanding: string
  sourceUpdatedAt: string | null
  currencyCode: string
}> {
  const adjustment = await prisma.vendorAdjustment.findFirst({ where: { id: vendorAdjustmentId, tenantId } })
  if (!adjustment) throw new PayableAllocationPaymentNotFoundError('Vendor adjustment not found')

  if (adjustment.status !== 'POSTED' || adjustment.adjustmentType !== 'VENDOR_DEBIT_NOTE') {
    return { items: [], total: 0, sourceOutstanding: '0.0000', sourceUpdatedAt: null, currencyCode: adjustment.currencyCode }
  }

  let source: PayableOpenItem
  try {
    source = await resolveAdjustmentSourceOpenItem(tenantId, adjustment)
  } catch {
    return { items: [], total: 0, sourceOutstanding: '0.0000', sourceUpdatedAt: null, currencyCode: adjustment.currencyCode }
  }

  const where: Prisma.PayableOpenItemWhereInput = {
    tenantId,
    legalEntityId: adjustment.legalEntityId,
    vendorId: source.vendorId,
    side: 'CREDIT',
    documentType: { in: ['VENDOR_INVOICE', 'VENDOR_CREDIT_ADJUSTMENT'] },
    currencyCode: source.currencyCode,
    vendorPayableAccountId: source.vendorPayableAccountId,
    status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
    outstandingAmount: { gt: 0 },
    reversedAt: null,
  }

  const items = await prisma.payableOpenItem.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { postingDate: 'asc' }, { documentNumber: 'asc' }],
    include: {
      sourceVendorInvoice: { select: { id: true, vendorInvoiceNumber: true, supplierInvoiceNumber: true } },
      sourceVendorAdjustment: { select: { id: true, vendorAdjustmentNumber: true, supplierReferenceNumber: true } },
    },
  })

  let remaining = query.targetAmount ? toDecimal(query.targetAmount) : toDecimal(source.outstandingAmount)
  const sourceOutstanding = formatForPersistence(source.outstandingAmount)

  const dtos: AllocatableInvoiceItemDto[] = items.map((item) => {
    const outstanding = toDecimal(item.outstandingAmount)
    const suggested = remaining.gt(0) ? min(remaining, outstanding) : toDecimal(0)
    remaining = subtract(remaining, suggested)
    return {
      vendorInvoiceId: item.sourceVendorInvoiceId ?? item.sourceVendorAdjustmentId,
      openItemId: item.id,
      documentNumber: item.documentNumber,
      supplierInvoiceNumber:
        item.sourceVendorInvoice?.supplierInvoiceNumber ??
        item.sourceVendorAdjustment?.supplierReferenceNumber ??
        null,
      documentDate: formatDate(item.documentDate),
      postingDate: formatDate(item.postingDate),
      dueDate: formatDate(item.dueDate),
      currencyCode: item.currencyCode,
      exchangeRate: roundExchangeRate(item.exchangeRate).toFixed(8),
      originalAmount: formatForPersistence(item.originalAmount),
      outstandingAmount: formatForPersistence(item.outstandingAmount),
      baseOutstandingAmount: formatForPersistence(item.baseOutstandingAmount),
      status: item.status,
      suggestedAllocationAmount: formatForPersistence(suggested),
      updatedAt: item.updatedAt.toISOString(),
    }
  })

  return {
    items: dtos,
    total: dtos.length,
    sourceOutstanding,
    sourceUpdatedAt: source.updatedAt.toISOString(),
    currencyCode: source.currencyCode,
  }
}

export async function listAllocationsForPayment(
  tenantId: string,
  vendorPaymentId: string,
  query: ListPayableAllocationsQuery = {},
): Promise<{ items: PayableAllocationHistoryRow[]; total: number; page: number; pageSize: number }> {
  const payment = await prisma.vendorPayment.findFirst({ where: { id: vendorPaymentId, tenantId } })
  if (!payment) throw new PayableAllocationPaymentNotFoundError()

  const source = await prisma.payableOpenItem.findFirst({
    where: { tenantId, legalEntityId: payment.legalEntityId, sourceVendorPaymentId: payment.id },
  })
  if (!source) return { items: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? query.limit ?? 50 }

  const result = await listAllocationLinesForSource(tenantId, payment.legalEntityId, source.id, query)
  const items = await mapHistoryRows(tenantId, result.rows, payment.legalEntityId)
  return { items, total: result.total, page: result.page, pageSize: result.pageSize }
}

export async function listAllocationsForInvoice(
  tenantId: string,
  vendorInvoiceId: string,
  query: ListPayableAllocationsQuery = {},
): Promise<{ items: PayableAllocationHistoryRow[]; total: number; page: number; pageSize: number }> {
  const invoice = await prisma.vendorInvoice.findFirst({ where: { id: vendorInvoiceId, tenantId } })
  if (!invoice) throw new PayableAllocationPaymentNotFoundError('Vendor invoice not found')

  const target = await prisma.payableOpenItem.findFirst({
    where: { tenantId, legalEntityId: invoice.legalEntityId, sourceVendorInvoiceId: invoice.id },
  })
  if (!target) return { items: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? query.limit ?? 50 }

  const result = await listAllocationLinesForTarget(tenantId, invoice.legalEntityId, target.id, query)
  const items = await mapHistoryRows(tenantId, result.rows, invoice.legalEntityId)
  return { items, total: result.total, page: result.page, pageSize: result.pageSize }
}

export async function listAllocationsForVendorAdjustment(
  tenantId: string,
  vendorAdjustmentId: string,
  query: ListPayableAllocationsQuery = {},
): Promise<{ items: PayableAllocationHistoryRow[]; total: number; page: number; pageSize: number }> {
  const adjustment = await prisma.vendorAdjustment.findFirst({ where: { id: vendorAdjustmentId, tenantId } })
  if (!adjustment) throw new PayableAllocationPaymentNotFoundError('Vendor adjustment not found')

  const openItem = await prisma.payableOpenItem.findFirst({
    where: { tenantId, legalEntityId: adjustment.legalEntityId, sourceVendorAdjustmentId: adjustment.id },
  })
  if (!openItem) return { items: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? query.limit ?? 50 }

  const result =
    openItem.side === 'CREDIT'
      ? await listAllocationLinesForTarget(tenantId, adjustment.legalEntityId, openItem.id, query)
      : await listAllocationLinesForSource(tenantId, adjustment.legalEntityId, openItem.id, query)
  const items = await mapHistoryRows(tenantId, result.rows, adjustment.legalEntityId)
  return { items, total: result.total, page: result.page, pageSize: result.pageSize }
}

async function mapHistoryRows(
  tenantId: string,
  rows: Array<Prisma.PayableAllocationLineGetPayload<{ include: { allocationBatch: true } }>>,
  legalEntityId: string,
): Promise<PayableAllocationHistoryRow[]> {
  const openItemIds = new Set<string>()
  for (const row of rows) {
    openItemIds.add(row.sourceDebitOpenItemId)
    openItemIds.add(row.targetCreditOpenItemId)
  }
  const openItems = await prisma.payableOpenItem.findMany({
    where: { tenantId, legalEntityId, id: { in: [...openItemIds] } },
    select: {
      id: true,
      documentNumber: true,
      sourceVendorPaymentId: true,
      sourceVendorInvoiceId: true,
    },
  })
  const openItemMap = new Map(openItems.map((o) => [o.id, o]))
  const invoiceIds = openItems.map((o) => o.sourceVendorInvoiceId).filter((v): v is string => !!v)
  const invoices = invoiceIds.length
    ? await prisma.vendorInvoice.findMany({
        where: { tenantId, id: { in: invoiceIds } },
        select: { id: true, vendorInvoiceNumber: true, supplierInvoiceNumber: true },
      })
    : []
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]))

  return rows.map((row) => {
    const sourceItem = openItemMap.get(row.sourceDebitOpenItemId)
    const targetItem = openItemMap.get(row.targetCreditOpenItemId)
    const invoice = targetItem?.sourceVendorInvoiceId ? invoiceMap.get(targetItem.sourceVendorInvoiceId) : null
    return {
      batchId: row.allocationBatchId,
      allocationLineId: row.id,
      allocationReference: row.allocationBatch.allocationReference,
      allocationDate: formatDate(row.allocationBatch.allocationDate)!,
      vendorPaymentId: sourceItem?.sourceVendorPaymentId ?? null,
      vendorPaymentNumber: sourceItem?.documentNumber ?? null,
      sourceDebitOpenItemId: row.sourceDebitOpenItemId,
      targetCreditOpenItemId: row.targetCreditOpenItemId,
      vendorInvoiceId: targetItem?.sourceVendorInvoiceId ?? null,
      vendorInvoiceNumber: invoice?.vendorInvoiceNumber ?? targetItem?.documentNumber ?? null,
      supplierInvoiceNumber: invoice?.supplierInvoiceNumber ?? null,
      currencyCode: row.allocationBatch.currencyCode,
      amount: formatForPersistence(row.amount),
      baseAmount: formatForPersistence(row.baseAmount),
      status: row.status,
      createdBy: row.allocationBatch.createdBy,
      createdAt: row.createdAt.toISOString(),
    }
  })
}

export async function getPayableAllocationById(tenantId: string, allocationId: string) {
  const batch = await findPayableAllocationBatchAnyLe(tenantId, allocationId)
  if (!batch) throw new PayableAllocationBatchNotFoundError()

  const openItemIds = new Set<string>([batch.sourceDebitOpenItemId])
  for (const line of batch.lines) openItemIds.add(line.targetCreditOpenItemId)
  const openItems = await prisma.payableOpenItem.findMany({
    where: { tenantId, legalEntityId: batch.legalEntityId, id: { in: [...openItemIds] } },
  })
  const openItemMap = new Map(openItems.map((o) => [o.id, o]))
  const source = openItemMap.get(batch.sourceDebitOpenItemId)

  return {
    batch: mapPayableAllocationBatchToDto(batch),
    lines: batch.lines.map(mapPayableAllocationLineToDto),
    payment: {
      id: source?.sourceVendorPaymentId ?? null,
      vendorPaymentNumber: source?.documentNumber ?? null,
    },
    source: source
      ? {
          openItemId: source.id,
          documentNumber: source.documentNumber,
          outstandingAmount: formatForPersistence(source.outstandingAmount),
          allocatedAmount: formatForPersistence(source.allocatedAmount),
          status: source.status,
        }
      : null,
    targets: batch.lines.map((line) => {
      const target = openItemMap.get(line.targetCreditOpenItemId)
      return {
        openItemId: line.targetCreditOpenItemId,
        vendorInvoiceId: target?.sourceVendorInvoiceId ?? null,
        documentNumber: target?.documentNumber ?? null,
        amount: formatForPersistence(line.amount),
        outstandingAmount: target ? formatForPersistence(target.outstandingAmount) : null,
        status: target?.status ?? null,
      }
    }),
  }
}

/** Payment utilisation state derived from the DEBIT source open item (Phase 4B4). */
export async function getVendorPaymentUtilisation(
  tenantId: string,
  legalEntityId: string,
  vendorPaymentId: string,
): Promise<{
  state: 'UNALLOCATED' | 'PARTIALLY_ALLOCATED' | 'FULLY_ALLOCATED'
  allocatedAmount: string
  outstandingAmount: string
  allocationCount: number
} | null> {
  const source = await prisma.payableOpenItem.findFirst({
    where: { tenantId, legalEntityId, sourceVendorPaymentId: vendorPaymentId },
  })
  if (!source) return null
  const allocated = toDecimal(source.allocatedAmount)
  const outstanding = toDecimal(source.outstandingAmount)
  const allocationCount = await prisma.payableAllocationLine.count({
    where: { tenantId, legalEntityId, sourceDebitOpenItemId: source.id, status: 'ACTIVE' },
  })
  let state: 'UNALLOCATED' | 'PARTIALLY_ALLOCATED' | 'FULLY_ALLOCATED' = 'UNALLOCATED'
  if (outstanding.isZero() && allocated.gt(0)) state = 'FULLY_ALLOCATED'
  else if (allocated.gt(0)) state = 'PARTIALLY_ALLOCATED'
  return {
    state,
    allocatedAmount: formatForPersistence(allocated),
    outstandingAmount: formatForPersistence(outstanding),
    allocationCount,
  }
}

/** Vendor invoice settlement state derived from the CREDIT open item (Phase 4B4). */
export async function getVendorInvoiceSettlement(
  tenantId: string,
  legalEntityId: string,
  vendorInvoiceId: string,
): Promise<{
  state: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
  settledAmount: string
  outstandingAmount: string
  allocationCount: number
} | null> {
  const target = await prisma.payableOpenItem.findFirst({
    where: { tenantId, legalEntityId, sourceVendorInvoiceId: vendorInvoiceId },
  })
  if (!target) return null
  const allocated = toDecimal(target.allocatedAmount)
  const outstanding = toDecimal(target.outstandingAmount)
  const allocationCount = await prisma.payableAllocationLine.count({
    where: { tenantId, legalEntityId, targetCreditOpenItemId: target.id, status: 'ACTIVE' },
  })
  let state: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID'
  if (outstanding.isZero() && allocated.gt(0)) state = 'PAID'
  else if (allocated.gt(0)) state = 'PARTIALLY_PAID'
  return {
    state,
    settledAmount: formatForPersistence(allocated),
    outstandingAmount: formatForPersistence(outstanding),
    allocationCount,
  }
}
