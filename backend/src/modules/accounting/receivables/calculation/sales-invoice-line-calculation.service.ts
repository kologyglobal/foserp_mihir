import { Prisma } from '@prisma/client'
import {
  compare,
  divide,
  isNegative,
  isPositive,
  isZero,
  multiply,
  roundAmount,
  roundPercentage,
  roundQuantity,
  roundTax,
  subtract,
  toDecimal,
} from '../../shared/finance-decimal.js'
import type {
  CalculationIssue,
  LineDiscountType,
  SalesInvoiceLineCalculationInput,
} from './sales-invoice-calculation.types.js'
import { calcError, calcWarning } from './sales-invoice-calculation.errors.js'
import { SUPPORTED_GST_RATES } from './sales-invoice-calculation.schemas.js'
import { validateHsnSac } from '../validation/hsn-sac.validator.js'

export interface RawLineAmounts {
  lineNumber: number
  quantity: Prisma.Decimal
  unitPrice: Prisma.Decimal
  grossAmount: Prisma.Decimal
  lineDiscountAmount: Prisma.Decimal
  netBeforeInvoiceDiscount: Prisma.Decimal
  gstRate: Prisma.Decimal
  cessRate: Prisma.Decimal
  isTaxInclusive: boolean
  hsnCode: string | null
  description: string | null
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  uomSnapshot: string | null
  revenueAccountId: string | null
  costCentreId: string | null
}

const SUPPORTED_RATE_SET = new Set(SUPPORTED_GST_RATES)

function applyLineDiscount(
  gross: Prisma.Decimal,
  discountType: LineDiscountType | undefined,
  discountValue: string | undefined,
  lineNumber: number,
  errors: CalculationIssue[],
): Prisma.Decimal {
  if (!discountType || !discountValue || isZero(discountValue)) {
    return new Prisma.Decimal(0)
  }
  const value = toDecimal(discountValue)
  if (isNegative(value)) {
    errors.push(calcError('INVOICE_LINE_DISCOUNT_INVALID', 'Line discount cannot be negative', `lines[${lineNumber}].lineDiscountValue`))
    return new Prisma.Decimal(0)
  }
  if (discountType === 'PERCENTAGE') {
    if (compare(value, 100) > 0) {
      errors.push(calcError('INVOICE_LINE_DISCOUNT_INVALID', 'Line discount percentage cannot exceed 100', `lines[${lineNumber}].lineDiscountValue`))
      return gross
    }
    return roundTax(multiply(gross, divide(value, 100)))
  }
  if (compare(value, gross) > 0) {
    errors.push(calcError('INVOICE_LINE_DISCOUNT_INVALID', 'Line discount amount cannot exceed line gross', `lines[${lineNumber}].lineDiscountValue`))
    return gross
  }
  return roundTax(value)
}

function validateGstRate(rate: Prisma.Decimal, lineNumber: number, warnings: CalculationIssue[], errors: CalculationIssue[]): void {
  if (compare(rate, 0) < 0 || compare(rate, 100) > 0) {
    errors.push(calcError('INVOICE_TAX_RATE_INVALID', 'GST rate must be between 0 and 100', `lines[${lineNumber}].gstRate`))
    return
  }
  const rateStr = rate.toFixed(4).replace(/\.?0+$/, '') || '0'
  const normalized = SUPPORTED_GST_RATES.find((r) => r === rateStr || r === rate.toFixed(1) || r === rate.toFixed(2))
    ?? SUPPORTED_GST_RATES.find((r) => toDecimal(r).eq(rate))
  if (!normalized && !SUPPORTED_RATE_SET.has(rateStr as typeof SUPPORTED_GST_RATES[number])) {
    warnings.push(
      calcWarning(
        'CUSTOM_TAX_RATE_USED',
        `GST rate ${rate.toFixed(4)}% is not in the standard supported rate list`,
        `lines[${lineNumber}].gstRate`,
      ),
    )
  }
}

export function computeRawLineAmounts(
  lines: SalesInvoiceLineCalculationInput[],
  errors: CalculationIssue[],
  warnings: CalculationIssue[],
): RawLineAmounts[] {
  const result: RawLineAmounts[] = []

  for (const line of lines) {
    const qty = roundQuantity(line.quantity)
    const unitPrice = roundAmount(line.unitPrice, 4)

    if (!isPositive(qty)) {
      errors.push(calcError('INVOICE_QUANTITY_INVALID', 'Quantity must be greater than zero', `lines[${line.lineNumber}].quantity`))
    }
    if (isNegative(unitPrice)) {
      errors.push(calcError('INVOICE_UNIT_PRICE_INVALID', 'Unit price cannot be negative', `lines[${line.lineNumber}].unitPrice`))
    }

    const grossAmount = roundTax(multiply(qty, unitPrice))
    const lineDiscountAmount = applyLineDiscount(
      grossAmount,
      line.lineDiscountType,
      line.lineDiscountValue,
      line.lineNumber,
      errors,
    )
    const netBeforeInvoiceDiscount = roundTax(subtract(grossAmount, lineDiscountAmount))

    const gstRate = roundPercentage(line.gstRate ?? '0')
    const cessRate = roundPercentage(line.cessRate ?? '0')
    validateGstRate(gstRate, line.lineNumber, warnings, errors)
    if (compare(cessRate, 0) < 0 || compare(cessRate, 100) > 0) {
      errors.push(calcError('INVOICE_CESS_RATE_INVALID', 'Cess rate must be between 0 and 100', `lines[${line.lineNumber}].cessRate`))
    }

    const hsnCheck = validateHsnSac(line.hsnCode)
    if (!hsnCheck.valid) {
      errors.push(calcError(hsnCheck.code, hsnCheck.message ?? 'Invalid HSN/SAC', `lines[${line.lineNumber}].hsnCode`))
    } else if (hsnCheck.severity === 'warning') {
      warnings.push(calcWarning(hsnCheck.code, hsnCheck.message ?? 'HSN/SAC length warning', `lines[${line.lineNumber}].hsnCode`))
    }

    result.push({
      lineNumber: line.lineNumber,
      quantity: qty,
      unitPrice,
      grossAmount,
      lineDiscountAmount,
      netBeforeInvoiceDiscount,
      gstRate,
      cessRate,
      isTaxInclusive: line.isTaxInclusive ?? false,
      hsnCode: line.hsnCode ?? null,
      description: line.description ?? null,
      itemId: line.itemId ?? null,
      itemCodeSnapshot: line.itemCodeSnapshot ?? null,
      itemNameSnapshot: line.itemNameSnapshot ?? null,
      uomSnapshot: line.uomSnapshot ?? null,
      revenueAccountId: line.revenueAccountId ?? null,
      costCentreId: line.costCentreId ?? null,
    })
  }

  return result
}

export function formatDecimal4(value: Prisma.Decimal): string {
  return roundAmount(value, 4).toFixed(4)
}

export function formatDecimal6(value: Prisma.Decimal): string {
  return roundQuantity(value).toFixed(6)
}
