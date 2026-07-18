import { prisma } from '../../../../../config/database.js'
import { formatForPersistence } from '../../../shared/finance-decimal.js'
import {
  CreditNoteAllocationCreditNoteNotFoundError,
  CreditNoteAllocationInvoiceNotFoundError,
} from './customer-credit-note-allocation.errors.js'
import {
  listCreditNoteAllocationHistory,
  listInvoiceCreditNoteAllocationHistory,
} from './customer-credit-note-allocation.repository.js'
import type {
  CreditNoteAllocationHistoryRow,
  InvoiceCreditNoteAllocationHistoryRow,
  ListCreditNoteAllocationsQuery,
} from './customer-credit-note-allocation.types.js'

export async function listAllocationsForCreditNote(
  tenantId: string,
  creditNoteId: string,
  query: ListCreditNoteAllocationsQuery,
): Promise<{ items: CreditNoteAllocationHistoryRow[]; total: number; page: number; pageSize: number }> {
  const creditNote = await prisma.customerCreditNote.findFirst({ where: { id: creditNoteId, tenantId } })
  if (!creditNote) throw new CreditNoteAllocationCreditNoteNotFoundError()

  const result = await listCreditNoteAllocationHistory(tenantId, creditNoteId, query)
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

export async function listCreditNoteAllocationsForInvoice(
  tenantId: string,
  invoiceId: string,
  query: { page?: number; pageSize?: number },
): Promise<{ items: InvoiceCreditNoteAllocationHistoryRow[]; total: number; page: number; pageSize: number }> {
  const invoice = await prisma.salesInvoice.findFirst({ where: { id: invoiceId, tenantId } })
  if (!invoice) throw new CreditNoteAllocationInvoiceNotFoundError(invoiceId)

  const result = await listInvoiceCreditNoteAllocationHistory(tenantId, invoiceId, query)
  return {
    items: result.rows.map((row) => ({
      batchId: row.batchId,
      allocationId: row.id,
      creditNoteId: row.creditNoteId,
      creditNoteNumber: row.creditNote?.creditNoteNumber ?? null,
      creditNoteDate: row.creditNote?.creditNoteDate ? row.creditNote.creditNoteDate.toISOString().slice(0, 10) : null,
      allocationDate: row.allocationDate.toISOString().slice(0, 10),
      allocatedAmount: formatForPersistence(row.allocatedAmount),
      baseAllocatedAmount: formatForPersistence(row.baseAllocatedAmount),
      customerId: row.customerId,
      customerName: row.creditNote?.customerNameSnapshot ?? null,
      status: row.status,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  }
}
