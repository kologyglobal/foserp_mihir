import type { CustomerReceipt, Prisma, ReceivableOpenItem, SalesInvoice } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import {
  convertToBase,
  formatForPersistence,
  isPositive,
  isZero,
  roundAmount,
  subtract,
  sumDecimals,
  toDecimal,
} from '../../shared/finance-decimal.js'
import { parseDateOnly } from '../../shared/finance.helpers.js'
import { resolvePeriodByDate } from '../../posting/posting-period.service.js'
import {
  RECEIPT_ALLOCATION_ERROR_CODES,
  ReceiptAllocationDuplicateOpenItemError,
  ReceiptAllocationForexRequiredError,
  ReceiptAllocationValidationError,
} from './customer-receipt-allocation.errors.js'
import type { AllocationLineInput, AllocationPreviewIssue } from './customer-receipt-allocation.types.js'

const ALLOCATABLE_STATUSES = new Set(['OPEN', 'PARTIALLY_SETTLED'])

export interface ValidatedAllocationLine {
  invoiceId: string
  invoiceOpenItemId: string
  invoiceNumber: string | null
  allocationAmount: Prisma.Decimal
  baseAllocationAmount: Prisma.Decimal
  invoice: SalesInvoice
  debitOpenItem: ReceivableOpenItem
  invoiceOutstandingBefore: Prisma.Decimal
  invoiceOutstandingAfter: Prisma.Decimal
  baseInvoiceOutstandingBefore: Prisma.Decimal
  baseInvoiceOutstandingAfter: Prisma.Decimal
}

export interface AllocationValidationContext {
  receipt: CustomerReceipt
  creditOpenItem: ReceivableOpenItem
  allocationDate: string
  allocationDateValue: Date
  currencyCode: string
  exchangeRate: Prisma.Decimal
  lines: ValidatedAllocationLine[]
  totalAllocated: Prisma.Decimal
  baseTotalAllocated: Prisma.Decimal
  receiptUnallocatedBefore: Prisma.Decimal
  receiptUnallocatedAfter: Prisma.Decimal
  creditOpenAfter: Prisma.Decimal
  warnings: AllocationPreviewIssue[]
}

export function resolveOpenItemStatusAfter(openAfter: Prisma.Decimal): 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' {
  if (isZero(openAfter)) return 'SETTLED'
  return 'PARTIALLY_SETTLED'
}

async function getRoundingTolerance(tenantId: string, legalEntityId: string) {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  return toDecimal(settings?.roundingTolerance ?? '0.01')
}

function assertNoDuplicateOpenItems(allocations: AllocationLineInput[]): void {
  const seen = new Set<string>()
  for (const line of allocations) {
    if (seen.has(line.invoiceOpenItemId)) throw new ReceiptAllocationDuplicateOpenItemError()
    seen.add(line.invoiceOpenItemId)
  }
}

function assertPositiveAmounts(allocations: AllocationLineInput[]): void {
  for (const line of allocations) {
    if (!isPositive(toDecimal(line.allocationAmount))) {
      throw new ReceiptAllocationValidationError(
        'Allocation amount must be greater than zero',
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_AMOUNT_INVALID,
        [{ field: 'allocationAmount', message: 'Must be greater than zero' }],
      )
    }
  }
}

export async function validateAllocationRequest(
  tenantId: string,
  receipt: CustomerReceipt,
  creditOpenItem: ReceivableOpenItem,
  input: { allocationDate: string; allocations: AllocationLineInput[] },
): Promise<AllocationValidationContext> {
  if (receipt.status !== 'POSTED') {
    throw new ReceiptAllocationValidationError(
      'Only POSTED receipts can be allocated',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_RECEIPT_NOT_POSTED,
    )
  }
  if (!receipt.creditOpenItemId || creditOpenItem.id !== receipt.creditOpenItemId) {
    throw new ReceiptAllocationValidationError(
      'Posted receipt is missing a credit open item',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_CREDIT_MISSING,
    )
  }
  if (creditOpenItem.side !== 'CREDIT' || creditOpenItem.documentType !== 'CUSTOMER_RECEIPT') {
    throw new ReceiptAllocationValidationError(
      'Receipt credit open item is invalid',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
    )
  }

  assertNoDuplicateOpenItems(input.allocations)
  assertPositiveAmounts(input.allocations)

  const resolved = await resolvePeriodByDate(tenantId, receipt.legalEntityId, input.allocationDate)
  if (resolved.period.status === 'CLOSED') {
    throw new ReceiptAllocationValidationError(
      'Accounting period is closed for allocation',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_PERIOD_CLOSED,
    )
  }
  if (resolved.period.status === 'UNDER_REVIEW') {
    throw new ReceiptAllocationValidationError(
      'Accounting period is under review and cannot accept allocations',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_PERIOD_UNDER_REVIEW,
    )
  }

  const tolerance = await getRoundingTolerance(tenantId, receipt.legalEntityId)
  const exchangeRate = toDecimal(receipt.exchangeRate)
  const warnings: AllocationPreviewIssue[] = []
  const lines: ValidatedAllocationLine[] = []

  for (const line of input.allocations) {
    const openItem = await prisma.receivableOpenItem.findFirst({
      where: { id: line.invoiceOpenItemId, tenantId, legalEntityId: receipt.legalEntityId },
      include: { salesInvoice: true },
    })
    if (!openItem?.salesInvoice) {
      throw new ReceiptAllocationValidationError(
        'Invoice debit open item not found',
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
        [{ field: 'invoiceOpenItemId', message: 'Not found' }],
      )
    }

    const invoice = openItem.salesInvoice
    if (invoice.id !== line.invoiceId) {
      throw new ReceiptAllocationValidationError(
        'Open item does not belong to the proposed invoice',
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
      )
    }
    if (invoice.legalEntityId !== receipt.legalEntityId || openItem.legalEntityId !== receipt.legalEntityId) {
      throw new ReceiptAllocationValidationError(
        'Allocation legal entity must match receipt and invoice',
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_LEGAL_ENTITY_MISMATCH,
      )
    }
    if (invoice.status !== 'POSTED') {
      throw new ReceiptAllocationValidationError(
        'Invoice must be POSTED to allocate',
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
      )
    }
    if (
      invoice.customerId !== receipt.customerId ||
      openItem.customerId !== receipt.customerId ||
      creditOpenItem.customerId !== receipt.customerId
    ) {
      throw new ReceiptAllocationValidationError(
        'Allocation customer must match receipt and invoice',
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_CUSTOMER_MISMATCH,
      )
    }
    if (openItem.side !== 'DEBIT' || openItem.documentType !== 'SALES_INVOICE') {
      throw new ReceiptAllocationValidationError(
        'Target open item must be a DEBIT SALES_INVOICE item',
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
      )
    }
    if (openItem.status === 'ON_HOLD' || openItem.status === 'DISPUTED' || !ALLOCATABLE_STATUSES.has(openItem.status)) {
      throw new ReceiptAllocationValidationError(
        `Open item status ${openItem.status} does not permit allocation`,
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
      )
    }
    if (
      invoice.currencyCode !== receipt.currencyCode ||
      openItem.currencyCode !== receipt.currencyCode ||
      creditOpenItem.currencyCode !== receipt.currencyCode
    ) {
      throw new ReceiptAllocationValidationError(
        'Receipt currency must match invoice currency for allocation',
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_CURRENCY_MISMATCH,
      )
    }

    const rateDiff = toDecimal(openItem.exchangeRate).sub(exchangeRate).abs()
    if (rateDiff.gt(tolerance)) throw new ReceiptAllocationForexRequiredError()

    const allocationAmount = roundAmount(toDecimal(line.allocationAmount), 4)
    const outstanding = toDecimal(openItem.openAmount)
    if (!isPositive(outstanding)) {
      throw new ReceiptAllocationValidationError(
        'Invoice outstanding must be positive',
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_OPEN_ITEM_INVALID,
      )
    }
    if (allocationAmount.gt(outstanding)) {
      throw new ReceiptAllocationValidationError(
        'Allocation amount exceeds invoice outstanding',
        RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_EXCEEDS_INVOICE,
      )
    }
    if (allocationAmount.lt(outstanding)) {
      warnings.push({
        code: 'PARTIAL_INVOICE_ALLOCATION',
        message: 'Partial allocation against invoice outstanding',
        severity: 'WARNING',
        field: 'allocationAmount',
      })
    }

    const invoiceOutstandingAfter = roundAmount(subtract(outstanding, allocationAmount), 4)
    const baseBefore = roundAmount(toDecimal(openItem.baseOpenAmount), 4)
    const baseAlloc = roundAmount(convertToBase(allocationAmount, exchangeRate), 4)
    const baseAfter = roundAmount(subtract(baseBefore, baseAlloc), 4)

    lines.push({
      invoiceId: invoice.id,
      invoiceOpenItemId: openItem.id,
      invoiceNumber: invoice.invoiceNumber,
      allocationAmount,
      baseAllocationAmount: baseAlloc,
      invoice,
      debitOpenItem: openItem,
      invoiceOutstandingBefore: outstanding,
      invoiceOutstandingAfter,
      baseInvoiceOutstandingBefore: baseBefore,
      baseInvoiceOutstandingAfter: baseAfter,
    })
  }

  const totalAllocated = roundAmount(sumDecimals(lines.map((l) => l.allocationAmount.toString())), 4)
  const baseTotalAllocated = roundAmount(sumDecimals(lines.map((l) => l.baseAllocationAmount.toString())), 4)
  const receiptUnallocatedBefore = toDecimal(receipt.unallocatedAmount)
  const creditOpen = toDecimal(creditOpenItem.openAmount)

  if (totalAllocated.gt(receiptUnallocatedBefore) || totalAllocated.gt(creditOpen)) {
    throw new ReceiptAllocationValidationError(
      'Total allocation exceeds receipt unallocated amount',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_EXCEEDS_RECEIPT,
    )
  }

  const receiptUnallocatedAfter = roundAmount(subtract(receiptUnallocatedBefore, totalAllocated), 4)
  const creditOpenAfter = roundAmount(subtract(creditOpen, totalAllocated), 4)
  if (isPositive(receiptUnallocatedAfter)) {
    warnings.push({
      code: 'UNALLOCATED_RECEIPT_REMAINS',
      message: 'Receipt retains unallocated customer advance',
      severity: 'WARNING',
      field: 'allocations',
    })
  }

  return {
    receipt,
    creditOpenItem,
    allocationDate: input.allocationDate,
    allocationDateValue: parseDateOnly(input.allocationDate),
    currencyCode: receipt.currencyCode,
    exchangeRate,
    lines,
    totalAllocated,
    baseTotalAllocated,
    receiptUnallocatedBefore,
    receiptUnallocatedAfter,
    creditOpenAfter,
    warnings,
  }
}

export { formatForPersistence }
