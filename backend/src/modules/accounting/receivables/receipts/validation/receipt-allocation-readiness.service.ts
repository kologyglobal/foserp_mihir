import { prisma } from '../../../../../config/database.js'
import {
  isPositive,
  roundAmount,
  subtract,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import type {
  CustomerReceiptCalculationInput,
  CustomerReceiptCalculationResult,
  ReceiptAllocationPreviewRow,
  ReceiptValidationIssue,
} from '../calculation/customer-receipt-calculation.types.js'
import {
  RECEIPT_ERROR_CODES,
  RECEIPT_WARNING_CODES,
  receiptError,
  receiptWarning,
} from '../calculation/customer-receipt-calculation.errors.js'
import {
  aggregateProposedAllocations,
  sumProposedAllocationAmount,
} from '../calculation/receipt-allocation-preview.service.js'
import { format4, toBaseAmount } from '../calculation/receipt-currency-calculation.service.js'

const ALLOCATABLE_STATUSES = new Set(['OPEN', 'PARTIALLY_SETTLED'])

export interface ReceiptAllocationReadinessResult {
  proposedAllocationCount: number
  validAllocationCount: number
  invalidAllocationCount: number
  totalProposedAllocation: string
  unallocatedAmount: string
  allocationPreview: ReceiptAllocationPreviewRow[]
  issues: ReceiptValidationIssue[]
}

/**
 * Read-only allocation preview validation.
 * Duplicate proposals are combined (see aggregateProposedAllocations).
 * Does not mutate open items or create allocation records.
 */
export async function validateReceiptAllocationReadiness(
  tenantId: string,
  legalEntityId: string,
  input: CustomerReceiptCalculationInput,
  calculation: CustomerReceiptCalculationResult,
): Promise<ReceiptAllocationReadinessResult> {
  const issues: ReceiptValidationIssue[] = []
  const warningsBucket: ReceiptValidationIssue[] = []
  const aggregates = aggregateProposedAllocations(
    input.proposedAllocations,
    issues,
    warningsBucket,
  )
  issues.push(...warningsBucket)

  const exchangeRate = toDecimal(calculation.exchangeRate)
  const preview: ReceiptAllocationPreviewRow[] = []
  let validCount = 0
  let invalidCount = 0

  for (const agg of aggregates) {
    const rowIssues: ReceiptValidationIssue[] = []

    const openItem = await prisma.receivableOpenItem.findFirst({
      where: {
        id: agg.invoiceOpenItemId,
        tenantId,
        legalEntityId,
      },
      include: {
        salesInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            dueDate: true,
            status: true,
            customerId: true,
            currencyCode: true,
          },
        },
      },
    })

    if (!openItem || !openItem.salesInvoice) {
      rowIssues.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
          'Invoice debit open item not found',
          'invoiceOpenItemId',
          {
            invoiceId: agg.invoiceId,
            invoiceOpenItemId: agg.invoiceOpenItemId,
          },
        ),
      )
    } else {
      const invoice = openItem.salesInvoice

      if (invoice.id !== agg.invoiceId) {
        rowIssues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
            'Open item does not belong to the proposed invoice',
            'invoiceId',
            { invoiceId: agg.invoiceId, invoiceOpenItemId: agg.invoiceOpenItemId },
          ),
        )
      }

      if (invoice.status !== 'POSTED') {
        rowIssues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
            'Invoice must be POSTED to allocate',
            'invoiceId',
            { invoiceId: agg.invoiceId, invoiceOpenItemId: agg.invoiceOpenItemId },
          ),
        )
      }

      if (invoice.customerId !== input.customerId || openItem.customerId !== input.customerId) {
        rowIssues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_CUSTOMER_MISMATCH,
            'Allocation customer must match receipt and invoice',
            'customerId',
            { invoiceId: agg.invoiceId, invoiceOpenItemId: agg.invoiceOpenItemId },
          ),
        )
      }

      if (openItem.side !== 'DEBIT' || openItem.documentType !== 'SALES_INVOICE') {
        rowIssues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
            'Target open item must be a DEBIT SALES_INVOICE item',
            'invoiceOpenItemId',
            { invoiceId: agg.invoiceId, invoiceOpenItemId: agg.invoiceOpenItemId },
          ),
        )
      }

      if (!ALLOCATABLE_STATUSES.has(openItem.status)) {
        rowIssues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
            `Open item status ${openItem.status} does not permit allocation`,
            'invoiceOpenItemId',
            { invoiceId: agg.invoiceId, invoiceOpenItemId: agg.invoiceOpenItemId },
          ),
        )
      }

      if (invoice.currencyCode !== calculation.currencyCode || openItem.currencyCode !== calculation.currencyCode) {
        rowIssues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_CURRENCY_MISMATCH,
            'Receipt currency must match invoice currency for allocation',
            'currencyCode',
            { invoiceId: agg.invoiceId, invoiceOpenItemId: agg.invoiceOpenItemId },
          ),
        )
      }

      const outstanding = toDecimal(openItem.openAmount)
      if (!isPositive(outstanding)) {
        rowIssues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
            'Invoice outstanding must be positive',
            'invoiceOpenItemId',
            { invoiceId: agg.invoiceId, invoiceOpenItemId: agg.invoiceOpenItemId },
          ),
        )
      }

      if (agg.allocationAmount.gt(outstanding)) {
        rowIssues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_EXCEEDS_INVOICE,
            'Allocation amount exceeds invoice outstanding',
            'allocationAmount',
            { invoiceId: agg.invoiceId, invoiceOpenItemId: agg.invoiceOpenItemId },
          ),
        )
      }

      if (isPositive(outstanding) && agg.allocationAmount.lt(outstanding) && rowIssues.length === 0) {
        rowIssues.push(
          receiptWarning(
            RECEIPT_WARNING_CODES.PARTIAL_INVOICE_ALLOCATION,
            'Partial allocation against invoice outstanding',
            'allocationAmount',
            { invoiceId: agg.invoiceId, invoiceOpenItemId: agg.invoiceOpenItemId },
          ),
        )
      }

      const outstandingAfter = roundAmount(subtract(outstanding, agg.allocationAmount), 4)
      const baseBefore = toBaseAmount(outstanding, exchangeRate)
      const baseAlloc = toBaseAmount(agg.allocationAmount, exchangeRate)
      const baseAfter = roundAmount(subtract(baseBefore, baseAlloc), 4)

      const hasErrors = rowIssues.some((i) => i.severity === 'ERROR')
      if (hasErrors) invalidCount += 1
      else validCount += 1

      preview.push({
        invoiceId: invoice.id,
        invoiceOpenItemId: openItem.id,
        invoiceNumber: invoice.invoiceNumber ?? '',
        invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
        currencyCode: invoice.currencyCode,
        invoiceOutstandingBefore: format4(outstanding),
        proposedAllocationAmount: format4(agg.allocationAmount),
        invoiceOutstandingAfter: format4(outstandingAfter.isNegative() ? toDecimal(0) : outstandingAfter),
        baseInvoiceOutstandingBefore: format4(baseBefore),
        baseProposedAllocationAmount: format4(baseAlloc),
        baseInvoiceOutstandingAfter: format4(baseAfter.isNegative() ? toDecimal(0) : baseAfter),
        status: hasErrors ? 'INVALID' : 'VALID',
        issues: rowIssues,
      })

      issues.push(...rowIssues)
      continue
    }

    invalidCount += 1
    preview.push({
      invoiceId: agg.invoiceId,
      invoiceOpenItemId: agg.invoiceOpenItemId,
      invoiceNumber: '',
      invoiceDate: '',
      dueDate: null,
      currencyCode: calculation.currencyCode,
      invoiceOutstandingBefore: '0.0000',
      proposedAllocationAmount: format4(agg.allocationAmount),
      invoiceOutstandingAfter: '0.0000',
      baseInvoiceOutstandingBefore: '0.0000',
      baseProposedAllocationAmount: format4(toBaseAmount(agg.allocationAmount, exchangeRate)),
      baseInvoiceOutstandingAfter: '0.0000',
      status: 'INVALID',
      issues: rowIssues,
    })
    issues.push(...rowIssues)
  }

  const totalProposed = sumProposedAllocationAmount(aggregates)

  return {
    proposedAllocationCount: aggregates.length,
    validAllocationCount: validCount,
    invalidAllocationCount: invalidCount,
    totalProposedAllocation: format4(totalProposed),
    unallocatedAmount: calculation.unallocatedAmount,
    allocationPreview: preview,
    issues,
  }
}
