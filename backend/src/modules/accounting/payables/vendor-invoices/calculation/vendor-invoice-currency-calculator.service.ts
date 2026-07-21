import { Prisma } from '@prisma/client'
import { compare, convertToBase, roundExchangeRate, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import type {
  VendorInvoiceCalculationBaseTotals,
  VendorInvoiceCalculationTotals,
  VendorInvoiceValidationIssue,
} from './vendor-invoice-calculation.types.js'
import { calcError, VENDOR_INVOICE_CALC_CODES } from './vendor-invoice-calculation.errors.js'
import { formatDecimal4 } from './vendor-invoice-decimal.js'

const RATE_UNITY_TOLERANCE = toDecimal('0.00000001')

/** Base-currency invoices (currencyCode === baseCurrencyCode) must use an exchange rate of ~1. */
export function assertBaseCurrencyRate(
  currencyCode: string | undefined,
  baseCurrencyCode: string,
  exchangeRate: Prisma.Decimal,
  errors: VendorInvoiceValidationIssue[],
): void {
  const code = currencyCode ?? baseCurrencyCode
  if (code !== baseCurrencyCode) return
  const diff = subtract(exchangeRate, 1).abs()
  if (compare(diff, RATE_UNITY_TOLERANCE) > 0) {
    errors.push(
      calcError(
        VENDOR_INVOICE_CALC_CODES.BASE_CURRENCY_RATE_INVALID,
        `Exchange rate must be 1 for base-currency (${baseCurrencyCode}) invoices`,
        'exchangeRate',
      ),
    )
  }
}

/** Converts every transaction-currency total to base currency using amount × exchangeRate. */
export function convertAllTotals(
  totals: VendorInvoiceCalculationTotals,
  exchangeRate: string,
): VendorInvoiceCalculationBaseTotals {
  const rate = roundExchangeRate(exchangeRate)
  const result = {} as VendorInvoiceCalculationBaseTotals
  for (const key of Object.keys(totals) as Array<keyof VendorInvoiceCalculationTotals>) {
    result[key] = formatDecimal4(convertToBase(toDecimal(totals[key]), rate))
  }
  return result
}
