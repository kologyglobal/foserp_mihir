import type { CustomerCreditNote, Prisma, ReceivableOpenItem, SalesInvoice } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import {
  convertToBase,
  formatForPersistence,
  isPositive,
  isZero,
  roundAmount,
  subtract,
  sumDecimals,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import { parseDateOnly } from '../../../shared/finance.helpers.js'
import { resolvePeriodByDate } from '../../../posting/posting-period.service.js'
import {
  CREDIT_NOTE_ALLOCATION_ERROR_CODES,
  CreditNoteAllocationDuplicateOpenItemError,
  CreditNoteAllocationForexRequiredError,
  CreditNoteAllocationValidationError,
} from './customer-credit-note-allocation.errors.js'
import type { CreditNoteAllocationLineInput, CreditNoteAllocationPreviewIssue } from './customer-credit-note-allocation.types.js'

const ALLOCATABLE_STATUSES = new Set(['OPEN', 'PARTIALLY_SETTLED'])

export interface ValidatedCreditNoteAllocationLine {
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

export interface CreditNoteAllocationValidationContext {
  creditNote: CustomerCreditNote
  creditOpenItem: ReceivableOpenItem
  allocationDate: string
  allocationDateValue: Date
  currencyCode: string
  exchangeRate: Prisma.Decimal
  lines: ValidatedCreditNoteAllocationLine[]
  totalAllocated: Prisma.Decimal
  baseTotalAllocated: Prisma.Decimal
  creditNoteUnallocatedBefore: Prisma.Decimal
  creditNoteUnallocatedAfter: Prisma.Decimal
  creditOpenAfter: Prisma.Decimal
  warnings: CreditNoteAllocationPreviewIssue[]
}

export function resolveOpenItemStatusAfter(openAfter: Prisma.Decimal): 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' {
  if (isZero(openAfter)) return 'SETTLED'
  return 'PARTIALLY_SETTLED'
}

async function getRoundingTolerance(tenantId: string, legalEntityId: string) {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  return toDecimal(settings?.roundingTolerance ?? '0.01')
}

function assertNoDuplicateOpenItems(allocations: CreditNoteAllocationLineInput[]): void {
  const seen = new Set<string>()
  for (const line of allocations) {
    if (seen.has(line.invoiceOpenItemId)) throw new CreditNoteAllocationDuplicateOpenItemError()
    seen.add(line.invoiceOpenItemId)
  }
}

function assertPositiveAmounts(allocations: CreditNoteAllocationLineInput[]): void {
  for (const line of allocations) {
    if (!isPositive(toDecimal(line.allocationAmount))) {
      throw new CreditNoteAllocationValidationError(
        'Allocation amount must be greater than zero',
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_AMOUNT_INVALID,
        [{ field: 'allocationAmount', message: 'Must be greater than zero' }],
      )
    }
  }
}

export async function validateCreditNoteAllocationRequest(
  tenantId: string,
  creditNote: CustomerCreditNote,
  creditOpenItem: ReceivableOpenItem,
  input: { allocationDate: string; allocations: CreditNoteAllocationLineInput[] },
): Promise<CreditNoteAllocationValidationContext> {
  if (creditNote.status !== 'POSTED') {
    throw new CreditNoteAllocationValidationError(
      'Only POSTED credit notes can be allocated',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_NOTE_NOT_POSTED,
    )
  }
  if (!creditNote.creditOpenItemId || creditOpenItem.id !== creditNote.creditOpenItemId) {
    throw new CreditNoteAllocationValidationError(
      'Posted credit note is missing a credit open item',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_CREDIT_MISSING,
    )
  }
  if (creditOpenItem.side !== 'CREDIT' || creditOpenItem.documentType !== 'CUSTOMER_CREDIT_NOTE') {
    throw new CreditNoteAllocationValidationError(
      'Credit note credit open item is invalid',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_OPEN_ITEM_INVALID,
    )
  }

  assertNoDuplicateOpenItems(input.allocations)
  assertPositiveAmounts(input.allocations)

  const resolved = await resolvePeriodByDate(tenantId, creditNote.legalEntityId, input.allocationDate)
  if (resolved.period.status === 'CLOSED') {
    throw new CreditNoteAllocationValidationError(
      'Accounting period is closed for allocation',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_PERIOD_CLOSED,
    )
  }
  if (resolved.period.status === 'UNDER_REVIEW') {
    throw new CreditNoteAllocationValidationError(
      'Accounting period is under review and cannot accept allocations',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_PERIOD_UNDER_REVIEW,
    )
  }

  const tolerance = await getRoundingTolerance(tenantId, creditNote.legalEntityId)
  const exchangeRate = toDecimal(creditNote.exchangeRate)
  const warnings: CreditNoteAllocationPreviewIssue[] = []
  const lines: ValidatedCreditNoteAllocationLine[] = []

  for (const line of input.allocations) {
    const openItem = await prisma.receivableOpenItem.findFirst({
      where: { id: line.invoiceOpenItemId, tenantId, legalEntityId: creditNote.legalEntityId },
      include: { salesInvoice: true },
    })
    if (!openItem?.salesInvoice) {
      throw new CreditNoteAllocationValidationError(
        'Invoice debit open item not found',
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_OPEN_ITEM_INVALID,
        [{ field: 'invoiceOpenItemId', message: 'Not found' }],
      )
    }

    const invoice = openItem.salesInvoice
    if (invoice.id !== line.invoiceId) {
      throw new CreditNoteAllocationValidationError(
        'Open item does not belong to the proposed invoice',
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_OPEN_ITEM_INVALID,
      )
    }
    if (invoice.legalEntityId !== creditNote.legalEntityId || openItem.legalEntityId !== creditNote.legalEntityId) {
      throw new CreditNoteAllocationValidationError(
        'Allocation legal entity must match credit note and invoice',
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_LEGAL_ENTITY_MISMATCH,
      )
    }
    if (invoice.status !== 'POSTED') {
      throw new CreditNoteAllocationValidationError(
        'Invoice must be POSTED to allocate',
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_OPEN_ITEM_INVALID,
      )
    }
    if (
      invoice.customerId !== creditNote.customerId ||
      openItem.customerId !== creditNote.customerId ||
      creditOpenItem.customerId !== creditNote.customerId
    ) {
      throw new CreditNoteAllocationValidationError(
        'Allocation customer must match credit note and invoice',
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_CUSTOMER_MISMATCH,
      )
    }
    if (openItem.side !== 'DEBIT' || openItem.documentType !== 'SALES_INVOICE') {
      throw new CreditNoteAllocationValidationError(
        'Target open item must be a DEBIT SALES_INVOICE item',
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_OPEN_ITEM_INVALID,
      )
    }
    if (openItem.status === 'ON_HOLD' || openItem.status === 'DISPUTED' || !ALLOCATABLE_STATUSES.has(openItem.status)) {
      throw new CreditNoteAllocationValidationError(
        `Open item status ${openItem.status} does not permit allocation`,
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_OPEN_ITEM_INVALID,
      )
    }
    if (
      invoice.currencyCode !== creditNote.currencyCode ||
      openItem.currencyCode !== creditNote.currencyCode ||
      creditOpenItem.currencyCode !== creditNote.currencyCode
    ) {
      throw new CreditNoteAllocationValidationError(
        'Credit note currency must match invoice currency for allocation',
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_CURRENCY_MISMATCH,
      )
    }

    const rateDiff = toDecimal(openItem.exchangeRate).sub(exchangeRate).abs()
    if (rateDiff.gt(tolerance)) throw new CreditNoteAllocationForexRequiredError()

    const allocationAmount = roundAmount(toDecimal(line.allocationAmount), 4)
    const outstanding = toDecimal(openItem.openAmount)
    if (!isPositive(outstanding)) {
      throw new CreditNoteAllocationValidationError(
        'Invoice outstanding must be positive',
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_OPEN_ITEM_INVALID,
      )
    }
    if (allocationAmount.gt(outstanding)) {
      throw new CreditNoteAllocationValidationError(
        'Allocation amount exceeds invoice outstanding',
        CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_EXCEEDS_INVOICE,
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
  const creditNoteUnallocatedBefore = toDecimal(creditNote.unallocatedAmount)
  const creditOpen = toDecimal(creditOpenItem.openAmount)

  if (totalAllocated.gt(creditNoteUnallocatedBefore) || totalAllocated.gt(creditOpen)) {
    throw new CreditNoteAllocationValidationError(
      'Total allocation exceeds credit note unallocated amount',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_EXCEEDS_CREDIT_NOTE,
    )
  }

  const creditNoteUnallocatedAfter = roundAmount(subtract(creditNoteUnallocatedBefore, totalAllocated), 4)
  const creditOpenAfter = roundAmount(subtract(creditOpen, totalAllocated), 4)
  if (isPositive(creditNoteUnallocatedAfter)) {
    warnings.push({
      code: 'UNALLOCATED_CREDIT_NOTE_REMAINS',
      message: 'Credit note retains unallocated customer advance',
      severity: 'WARNING',
      field: 'allocations',
    })
  }

  return {
    creditNote,
    creditOpenItem,
    allocationDate: input.allocationDate,
    allocationDateValue: parseDateOnly(input.allocationDate),
    currencyCode: creditNote.currencyCode,
    exchangeRate,
    lines,
    totalAllocated,
    baseTotalAllocated,
    creditNoteUnallocatedBefore,
    creditNoteUnallocatedAfter,
    creditOpenAfter,
    warnings,
  }
}

export { formatForPersistence }
