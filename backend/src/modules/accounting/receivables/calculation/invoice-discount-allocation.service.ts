import { Prisma } from '@prisma/client'
import {
  add,
  compare,
  divide,
  isPositive,
  isZero,
  multiply,
  roundTax,
  subtract,
  sumDecimals,
  toDecimal,
} from '../../shared/finance-decimal.js'
import type { CalculationIssue, InvoiceDiscountType } from './sales-invoice-calculation.types.js'
import { calcError } from './sales-invoice-calculation.errors.js'
import type { RawLineAmounts } from './sales-invoice-line-calculation.service.js'

export interface InvoiceDiscountAllocation {
  /** Per lineNumber → allocated invoice discount amount. */
  byLine: Map<number, Prisma.Decimal>
  totalInvoiceDiscount: Prisma.Decimal
}

/**
 * Proportional invoice discount allocation across eligible lines.
 * Remainder (rounding dust) is applied to the **last eligible line** (highest lineNumber
 * among lines with netBeforeInvoiceDiscount > 0) so allocations sum exactly.
 */
export function allocateInvoiceDiscount(
  lines: RawLineAmounts[],
  discountType: InvoiceDiscountType | undefined,
  discountValue: string | undefined,
  errors: CalculationIssue[],
): InvoiceDiscountAllocation {
  const byLine = new Map<number, Prisma.Decimal>()
  for (const line of lines) {
    byLine.set(line.lineNumber, new Prisma.Decimal(0))
  }

  if (!discountType || !discountValue || isZero(discountValue)) {
    return { byLine, totalInvoiceDiscount: new Prisma.Decimal(0) }
  }

  const value = toDecimal(discountValue)
  if (compare(value, 0) < 0) {
    errors.push(calcError('INVOICE_DISCOUNT_EXCEEDS_VALUE', 'Invoice discount cannot be negative', 'invoiceDiscountValue'))
    return { byLine, totalInvoiceDiscount: new Prisma.Decimal(0) }
  }

  const eligible = lines.filter((l) => isPositive(l.netBeforeInvoiceDiscount))
  if (eligible.length === 0) {
    errors.push(calcError('INVOICE_DISCOUNT_ALLOCATION_FAILED', 'No lines eligible for invoice discount allocation', 'invoiceDiscountValue'))
    return { byLine, totalInvoiceDiscount: new Prisma.Decimal(0) }
  }

  const eligibleTotal = sumDecimals(eligible.map((l) => l.netBeforeInvoiceDiscount))
  let totalDiscount: Prisma.Decimal

  if (discountType === 'PERCENTAGE') {
    if (compare(value, 100) > 0) {
      errors.push(calcError('INVOICE_DISCOUNT_EXCEEDS_VALUE', 'Invoice discount percentage cannot exceed 100', 'invoiceDiscountValue'))
      return { byLine, totalInvoiceDiscount: new Prisma.Decimal(0) }
    }
    totalDiscount = roundTax(multiply(eligibleTotal, divide(value, 100)))
  } else {
    totalDiscount = roundTax(value)
    if (compare(totalDiscount, eligibleTotal) > 0) {
      errors.push(
        calcError('INVOICE_DISCOUNT_EXCEEDS_VALUE', 'Invoice discount amount exceeds eligible line value', 'invoiceDiscountValue'),
      )
      return { byLine, totalInvoiceDiscount: new Prisma.Decimal(0) }
    }
  }

  if (isZero(totalDiscount)) {
    return { byLine, totalInvoiceDiscount: new Prisma.Decimal(0) }
  }

  let allocated = new Prisma.Decimal(0)
  const lastEligible = eligible.reduce((max, l) => (l.lineNumber > max.lineNumber ? l : max), eligible[0]!)

  for (const line of eligible) {
    if (line.lineNumber === lastEligible.lineNumber) continue
    const share = roundTax(multiply(totalDiscount, divide(line.netBeforeInvoiceDiscount, eligibleTotal)))
    byLine.set(line.lineNumber, share)
    allocated = add(allocated, share)
  }

  const remainder = roundTax(subtract(totalDiscount, allocated))
  byLine.set(lastEligible.lineNumber, remainder)

  const sumAllocated = sumDecimals([...byLine.values()])
  if (!sumAllocated.eq(totalDiscount)) {
    const diff = subtract(totalDiscount, sumAllocated)
    const current = byLine.get(lastEligible.lineNumber) ?? new Prisma.Decimal(0)
    byLine.set(lastEligible.lineNumber, add(current, diff))
  }

  return { byLine, totalInvoiceDiscount: totalDiscount }
}
