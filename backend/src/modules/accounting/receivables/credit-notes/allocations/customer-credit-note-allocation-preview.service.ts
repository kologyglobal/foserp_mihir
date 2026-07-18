import { prisma } from '../../../../../config/database.js'
import { formatForPersistence } from '../../../shared/finance-decimal.js'
import {
  CREDIT_NOTE_ALLOCATION_ERROR_CODES,
  CreditNoteAllocationCreditNoteNotFoundError,
  CreditNoteAllocationValidationError,
} from './customer-credit-note-allocation.errors.js'
import type {
  AllocateCustomerCreditNoteBodyInput,
} from './customer-credit-note-allocation.schemas.js'
import type { CustomerCreditNoteAllocationPreview } from './customer-credit-note-allocation.types.js'
import { validateCreditNoteAllocationRequest } from './customer-credit-note-allocation-validation.service.js'

/** Read-only allocation preview — never writes batch/allocation/open-item rows. */
export async function previewAllocateCustomerCreditNote(
  tenantId: string,
  creditNoteId: string,
  body: AllocateCustomerCreditNoteBodyInput,
): Promise<CustomerCreditNoteAllocationPreview> {
  const creditNote = await prisma.customerCreditNote.findFirst({ where: { id: creditNoteId, tenantId } })
  if (!creditNote) throw new CreditNoteAllocationCreditNoteNotFoundError()

  if (creditNote.status !== 'POSTED') {
    throw new CreditNoteAllocationValidationError(
      'Only POSTED credit notes can be allocated',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_NOTE_NOT_POSTED,
    )
  }
  if (!creditNote.creditOpenItemId) {
    throw new CreditNoteAllocationValidationError(
      'Posted credit note is missing a credit open item',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_CREDIT_MISSING,
    )
  }

  const creditOpenItem = await prisma.receivableOpenItem.findFirst({
    where: { id: creditNote.creditOpenItemId, tenantId },
  })
  if (!creditOpenItem) {
    throw new CreditNoteAllocationValidationError(
      'Posted credit note is missing a credit open item',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_CREDIT_MISSING,
    )
  }

  const ctx = await validateCreditNoteAllocationRequest(tenantId, creditNote, creditOpenItem, body)

  return {
    creditNoteId: creditNote.id,
    creditOpenItemId: creditOpenItem.id,
    currencyCode: ctx.currencyCode,
    exchangeRate: ctx.exchangeRate.toFixed(8),
    creditNoteUnallocatedBefore: formatForPersistence(ctx.creditNoteUnallocatedBefore),
    totalProposedAllocation: formatForPersistence(ctx.totalAllocated),
    creditNoteUnallocatedAfter: formatForPersistence(ctx.creditNoteUnallocatedAfter),
    customerAdvanceAfter: formatForPersistence(ctx.creditNoteUnallocatedAfter),
    valid: true,
    lines: ctx.lines.map((line) => ({
      invoiceId: line.invoiceId,
      invoiceOpenItemId: line.invoiceOpenItemId,
      invoiceNumber: line.invoiceNumber,
      currencyCode: line.invoice.currencyCode,
      invoiceOutstandingBefore: formatForPersistence(line.invoiceOutstandingBefore),
      proposedAllocationAmount: formatForPersistence(line.allocationAmount),
      invoiceOutstandingAfter: formatForPersistence(line.invoiceOutstandingAfter),
      baseInvoiceOutstandingBefore: formatForPersistence(line.baseInvoiceOutstandingBefore),
      baseProposedAllocationAmount: formatForPersistence(line.baseAllocationAmount),
      baseInvoiceOutstandingAfter: formatForPersistence(line.baseInvoiceOutstandingAfter),
      status: 'VALID' as const,
      issues: [],
    })),
    errors: [],
    warnings: ctx.warnings,
  }
}
