import { Prisma } from '@prisma/client'
import {
  isPositive,
  isZero,
  roundAmount,
  subtract,
  sumDecimals,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import type {
  ProposedReceiptAllocationInput,
  ReceiptAllocationPreviewRow,
  ReceiptValidationIssue,
} from './customer-receipt-calculation.types.js'
import {
  RECEIPT_ERROR_CODES,
  RECEIPT_WARNING_CODES,
  receiptError,
  receiptWarning,
} from './customer-receipt-calculation.errors.js'
import { format4, toBaseAmount } from './receipt-currency-calculation.service.js'

export interface ProposedAllocationAggregate {
  invoiceId: string
  invoiceOpenItemId: string
  allocationAmount: Prisma.Decimal
  sourceRowIndexes: number[]
}

/**
 * Duplicate strategy: combine proposal rows that share the same invoiceOpenItemId
 * into a single aggregate amount, and emit RECEIPT_ALLOCATION_DUPLICATE warning.
 */
export function aggregateProposedAllocations(
  proposals: ProposedReceiptAllocationInput[] | null | undefined,
  errors: ReceiptValidationIssue[],
  warnings: ReceiptValidationIssue[],
): ProposedAllocationAggregate[] {
  if (!proposals?.length) return []

  const map = new Map<string, ProposedAllocationAggregate>()

  proposals.forEach((row, rowIndex) => {
    const amount = toDecimal(row.allocationAmount)
    if (!isPositive(amount) || isZero(amount)) {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_AMOUNT_INVALID,
          'Proposed allocation amount must be greater than zero',
          'proposedAllocations.allocationAmount',
          {
            rowIndex,
            invoiceId: row.invoiceId,
            invoiceOpenItemId: row.invoiceOpenItemId,
          },
        ),
      )
      return
    }

    const key = row.invoiceOpenItemId
    const existing = map.get(key)
    if (existing) {
      existing.allocationAmount = existing.allocationAmount.add(amount)
      existing.sourceRowIndexes.push(rowIndex)
      warnings.push(
        receiptWarning(
          RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_DUPLICATE,
          'Duplicate proposed allocation for the same invoice open item — amounts combined',
          'proposedAllocations',
          {
            rowIndex,
            invoiceId: row.invoiceId,
            invoiceOpenItemId: row.invoiceOpenItemId,
          },
        ),
      )
    } else {
      map.set(key, {
        invoiceId: row.invoiceId,
        invoiceOpenItemId: row.invoiceOpenItemId,
        allocationAmount: amount,
        sourceRowIndexes: [rowIndex],
      })
    }
  })

  return [...map.values()].map((a) => ({
    ...a,
    allocationAmount: roundAmount(a.allocationAmount, 4),
  }))
}

export function sumProposedAllocationAmount(aggregates: ProposedAllocationAggregate[]): Prisma.Decimal {
  return roundAmount(
    sumDecimals(aggregates.map((a) => a.allocationAmount)),
    4,
  )
}

export function computeUnallocatedAmount(
  allocatable: Prisma.Decimal,
  proposedAllocated: Prisma.Decimal,
  errors: ReceiptValidationIssue[],
  warnings: ReceiptValidationIssue[],
): Prisma.Decimal {
  if (proposedAllocated.gt(allocatable)) {
    errors.push(
      receiptError(
        RECEIPT_ERROR_CODES.RECEIPT_ALLOCATION_EXCEEDS_RECEIPT,
        'Proposed allocations exceed allocatable receipt amount',
        'proposedAllocations',
      ),
    )
    return new Prisma.Decimal(0)
  }

  const unallocated = roundAmount(subtract(allocatable, proposedAllocated), 4)
  if (unallocated.isNegative()) {
    errors.push(
      receiptError(
        RECEIPT_ERROR_CODES.CUSTOMER_RECEIPT_UNALLOCATED_AMOUNT_INVALID,
        'Unallocated amount cannot be negative',
        'unallocatedAmount',
      ),
    )
    return new Prisma.Decimal(0)
  }

  if (isPositive(unallocated) && isPositive(proposedAllocated)) {
    warnings.push(
      receiptWarning(
        RECEIPT_WARNING_CODES.UNALLOCATED_RECEIPT_REMAINS,
        'Receipt remains partially unallocated',
        'unallocatedAmount',
      ),
    )
  } else if (isPositive(unallocated) && isZero(proposedAllocated)) {
    warnings.push(
      receiptWarning(
        RECEIPT_WARNING_CODES.UNALLOCATED_RECEIPT_REMAINS,
        'No allocations proposed — full amount remains unallocated',
        'unallocatedAmount',
      ),
    )
  }

  return unallocated
}

/** Build amount-only allocation preview stubs (invoice fields filled later by DB readiness). */
export function buildAmountOnlyAllocationPreview(
  aggregates: ProposedAllocationAggregate[],
  exchangeRate: Prisma.Decimal,
  currencyCode: string,
): ReceiptAllocationPreviewRow[] {
  return aggregates.map((a) => {
    const base = toBaseAmount(a.allocationAmount, exchangeRate)
    return {
      invoiceId: a.invoiceId,
      invoiceOpenItemId: a.invoiceOpenItemId,
      invoiceNumber: '',
      invoiceDate: '',
      dueDate: null,
      currencyCode,
      invoiceOutstandingBefore: '0.0000',
      proposedAllocationAmount: format4(a.allocationAmount),
      invoiceOutstandingAfter: '0.0000',
      baseInvoiceOutstandingBefore: '0.0000',
      baseProposedAllocationAmount: format4(base),
      baseInvoiceOutstandingAfter: '0.0000',
      status: 'VALID',
      issues: [],
    }
  })
}
