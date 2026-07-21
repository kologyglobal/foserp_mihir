import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import {
  RECEIPT_ALLOCATION_ERROR_CODES,
  ReceiptAllocationReceiptNotFoundError,
  ReceiptAllocationValidationError,
} from './customer-receipt-allocation.errors.js'
import type {
  AllocateCustomerReceiptBodyInput,
} from './customer-receipt-allocation.schemas.js'
import type { CustomerReceiptAllocationPreview } from './customer-receipt-allocation.types.js'
import { validateAllocationRequest } from './customer-receipt-allocation-validation.service.js'

/** Read-only allocation preview — never writes batch/allocation/open-item rows. */
export async function previewAllocateCustomerReceipt(
  tenantId: string,
  receiptId: string,
  body: AllocateCustomerReceiptBodyInput,
): Promise<CustomerReceiptAllocationPreview> {
  const receipt = await prisma.customerReceipt.findFirst({ where: { id: receiptId, tenantId } })
  if (!receipt) throw new ReceiptAllocationReceiptNotFoundError()

  if (receipt.status !== 'POSTED') {
    throw new ReceiptAllocationValidationError(
      'Only POSTED receipts can be allocated',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_RECEIPT_NOT_POSTED,
    )
  }
  if (!receipt.creditOpenItemId) {
    throw new ReceiptAllocationValidationError(
      'Posted receipt is missing a credit open item',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_CREDIT_MISSING,
    )
  }

  const creditOpenItem = await prisma.receivableOpenItem.findFirst({
    where: { id: receipt.creditOpenItemId, tenantId },
  })
  if (!creditOpenItem) {
    throw new ReceiptAllocationValidationError(
      'Posted receipt is missing a credit open item',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_CREDIT_MISSING,
    )
  }

  const ctx = await validateAllocationRequest(tenantId, receipt, creditOpenItem, body)

  return {
    receiptId: receipt.id,
    creditOpenItemId: creditOpenItem.id,
    currencyCode: ctx.currencyCode,
    exchangeRate: ctx.exchangeRate.toFixed(8),
    receiptUnallocatedBefore: formatForPersistence(ctx.receiptUnallocatedBefore),
    totalProposedAllocation: formatForPersistence(ctx.totalAllocated),
    receiptUnallocatedAfter: formatForPersistence(ctx.receiptUnallocatedAfter),
    customerAdvanceAfter: formatForPersistence(ctx.receiptUnallocatedAfter),
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
