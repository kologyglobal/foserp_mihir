import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../../shared/finance.helpers.js'
import { ReceiptAllocationInvoiceNotFoundError, ReceiptAllocationReceiptNotFoundError } from './customer-receipt-allocation.errors.js'
import { listInvoiceAllocationHistory, listReceiptAllocationHistory } from './customer-receipt-allocation.repository.js'
import { listInvoiceCreditNoteAllocationHistory } from '../credit-notes/allocations/customer-credit-note-allocation.repository.js'
import type {
  CustomerCreditDto,
  InvoiceAllocationHistoryRow,
  ListCustomerCreditsQuery,
  ListReceiptAllocationsQuery,
  ReceiptAllocationHistoryRow,
} from './customer-receipt-allocation.types.js'

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export async function listAllocationsForReceipt(
  tenantId: string,
  receiptId: string,
  query: ListReceiptAllocationsQuery,
): Promise<{ items: ReceiptAllocationHistoryRow[]; total: number; page: number; pageSize: number }> {
  const receipt = await prisma.customerReceipt.findFirst({ where: { id: receiptId, tenantId } })
  if (!receipt) throw new ReceiptAllocationReceiptNotFoundError()

  const result = await listReceiptAllocationHistory(tenantId, receiptId, query)
  return {
    items: result.rows.map((row) => ({
      batchId: row.batchId,
      allocationId: row.id,
      allocationDate: row.allocationDate.toISOString().slice(0, 10),
      allocationSequence: row.allocationSequence,
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoice?.invoiceNumber ?? null,
      invoiceOpenItemId: row.invoiceOpenItemId,
      allocatedAmount: formatForPersistence(row.allocatedAmount),
      baseAllocatedAmount: formatForPersistence(row.baseAllocatedAmount),
      invoiceOutstandingBefore: row.invoiceOutstandingBefore
        ? formatForPersistence(row.invoiceOutstandingBefore)
        : null,
      invoiceOutstandingAfter: row.invoiceOutstandingAfter
        ? formatForPersistence(row.invoiceOutstandingAfter)
        : null,
      status: row.status,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  }
}

/** Phase 3C5 — merges receipt-sourced and credit-note-sourced allocations for one invoice, sorted newest first. */
export async function listAllocationsForInvoice(
  tenantId: string,
  invoiceId: string,
  query: { page?: number; pageSize?: number },
): Promise<{ items: InvoiceAllocationHistoryRow[]; total: number; page: number; pageSize: number }> {
  const invoice = await prisma.salesInvoice.findFirst({ where: { id: invoiceId, tenantId } })
  if (!invoice) throw new ReceiptAllocationInvoiceNotFoundError(invoiceId)

  const pageSize = query.pageSize ?? 50
  const page = query.page ?? 1

  const [receiptResult, creditNoteResult] = await Promise.all([
    listInvoiceAllocationHistory(tenantId, invoiceId, { page: 1, pageSize: 1000 }),
    listInvoiceCreditNoteAllocationHistory(tenantId, invoiceId, { page: 1, pageSize: 1000 }),
  ])

  const receiptRows: InvoiceAllocationHistoryRow[] = receiptResult.rows.map((row) => ({
    batchId: row.batchId,
    allocationId: row.id,
    sourceType: 'CUSTOMER_RECEIPT',
    receiptId: row.receiptId,
    receiptNumber: row.receipt?.receiptNumber ?? null,
    receiptDate: formatDate(row.receipt?.receiptDate),
    creditNoteId: null,
    creditNoteNumber: null,
    creditNoteDate: null,
    allocationDate: row.allocationDate.toISOString().slice(0, 10),
    allocatedAmount: formatForPersistence(row.allocatedAmount),
    baseAllocatedAmount: formatForPersistence(row.baseAllocatedAmount),
    customerId: row.customerId,
    customerName: row.receipt?.customerNameSnapshot ?? null,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  }))

  const creditNoteRows: InvoiceAllocationHistoryRow[] = creditNoteResult.rows.map((row) => ({
    batchId: row.batchId,
    allocationId: row.id,
    sourceType: 'CUSTOMER_CREDIT_NOTE',
    receiptId: null,
    receiptNumber: null,
    receiptDate: null,
    creditNoteId: row.creditNoteId,
    creditNoteNumber: row.creditNote?.creditNoteNumber ?? null,
    creditNoteDate: formatDate(row.creditNote?.creditNoteDate),
    allocationDate: row.allocationDate.toISOString().slice(0, 10),
    allocatedAmount: formatForPersistence(row.allocatedAmount),
    baseAllocatedAmount: formatForPersistence(row.baseAllocatedAmount),
    customerId: row.customerId,
    customerName: row.creditNote?.customerNameSnapshot ?? null,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  }))

  const merged = [...receiptRows, ...creditNoteRows].sort((a, b) => {
    if (a.allocationDate !== b.allocationDate) return a.allocationDate < b.allocationDate ? 1 : -1
    return a.createdAt < b.createdAt ? 1 : -1
  })

  const total = merged.length
  const start = (page - 1) * pageSize
  const items = merged.slice(start, start + pageSize)

  return { items, total, page, pageSize }
}

export async function listCustomerCredits(
  tenantId: string,
  query: ListCustomerCreditsQuery,
): Promise<{ items: CustomerCreditDto[]; total: number; page: number; pageSize: number }> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.pageSize ?? 20,
    sortOrder: 'desc',
  })

  const where: Prisma.ReceivableOpenItemWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    side: 'CREDIT',
    /** Phase 3C5 — includes both receipt- and credit-note-sourced customer credit. */
    documentType: { in: ['CUSTOMER_RECEIPT', 'CUSTOMER_CREDIT_NOTE'] },
    openAmount: { gt: 0 },
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.currencyCode ? { currencyCode: query.currencyCode } : {}),
    ...(query.status ? { status: query.status as never } : { status: { in: ['OPEN', 'PARTIALLY_SETTLED'] } }),
    ...(query.receiptDateFrom || query.receiptDateTo
      ? {
          documentDate: {
            ...(query.receiptDateFrom ? { gte: parseDateOnly(query.receiptDateFrom) } : {}),
            ...(query.receiptDateTo ? { lte: parseDateOnly(query.receiptDateTo) } : {}),
          },
        }
      : {}),
    ...(query.search?.trim()
      ? {
          OR: [
            { documentNumberSnapshot: { contains: query.search.trim() } },
            { customerNameSnapshot: { contains: query.search.trim() } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.receivableOpenItem.findMany({
      where,
      skip,
      take,
      orderBy: { documentDate: 'desc' },
      include: {
        customerReceipt: { select: { id: true, receiptNumber: true, receiptDate: true, postingDate: true } },
        customerCreditNote: { select: { id: true, creditNoteNumber: true, creditNoteDate: true, postingDate: true } },
      },
    }),
    prisma.receivableOpenItem.count({ where }),
  ])

  return {
    items: items.map((item) => {
      const isCreditNote = item.documentType === 'CUSTOMER_CREDIT_NOTE'
      const sourceDate = isCreditNote ? item.customerCreditNote?.creditNoteDate : item.customerReceipt?.receiptDate
      const sourcePostingDate = isCreditNote ? item.customerCreditNote?.postingDate : item.customerReceipt?.postingDate
      return {
        creditOpenItemId: item.id,
        sourceType: isCreditNote ? 'CUSTOMER_CREDIT_NOTE' : 'CUSTOMER_RECEIPT',
        receiptId: isCreditNote ? null : (item.customerReceiptId ?? item.customerReceipt?.id ?? null),
        receiptNumber: isCreditNote ? null : (item.documentNumberSnapshot ?? item.customerReceipt?.receiptNumber ?? null),
        creditNoteId: isCreditNote ? (item.customerCreditNoteId ?? item.customerCreditNote?.id ?? null) : null,
        creditNoteNumber: isCreditNote ? (item.documentNumberSnapshot ?? item.customerCreditNote?.creditNoteNumber ?? null) : null,
        customerId: item.customerId,
        customerName: item.customerNameSnapshot,
        receiptDate: item.documentDate ? formatDate(item.documentDate) : formatDate(sourceDate),
        postingDate: formatDate(sourcePostingDate),
        currencyCode: item.currencyCode,
        originalAmount: formatForPersistence(item.originalAmount),
        allocatedAmount: formatForPersistence(item.allocatedAmount),
        outstandingAmount: formatForPersistence(item.openAmount),
        baseOutstandingAmount: formatForPersistence(item.baseOpenAmount),
        status: item.status,
      }
    }),
    total,
    page,
    pageSize: limit,
  }
}
