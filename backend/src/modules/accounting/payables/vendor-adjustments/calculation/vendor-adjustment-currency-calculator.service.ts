import { Prisma } from '@prisma/client'
import { compare, convertToBase, roundExchangeRate, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import type {
  VendorAdjustmentCalculationBaseTotals,
  VendorAdjustmentCalculationTotals,
  VendorAdjustmentValidationIssue,
} from './vendor-adjustment-calculation.types.js'
import { calcError, VENDOR_ADJUSTMENT_CALC_CODES } from './vendor-adjustment-calculation.errors.js'
import { formatDecimal4 } from './vendor-adjustment-decimal.js'

const RATE_UNITY_TOLERANCE = toDecimal('0.00000001')

/** Base-currency invoices (currencyCode === baseCurrencyCode) must use an exchange rate of ~1. */
export function assertBaseCurrencyRate(
  currencyCode: string | undefined,
  baseCurrencyCode: string,
  exchangeRate: Prisma.Decimal,
  errors: VendorAdjustmentValidationIssue[],
): void {
  const code = currencyCode ?? baseCurrencyCode
  if (code !== baseCurrencyCode) return
  const diff = subtract(exchangeRate, 1).abs()
  if (compare(diff, RATE_UNITY_TOLERANCE) > 0) {
    errors.push(
      calcError(
        VENDOR_ADJUSTMENT_CALC_CODES.BASE_CURRENCY_RATE_INVALID,
        `Exchange rate must be 1 for base-currency (${baseCurrencyCode}) invoices`,
        'exchangeRate',
      ),
    )
  }
}

/** Converts every transaction-currency total to base currency using amount × exchangeRate. */
export function convertAllTotals(
  totals: VendorAdjustmentCalculationTotals,
  exchangeRate: string,
): VendorAdjustmentCalculationBaseTotals {
  const rate = roundExchangeRate(exchangeRate)
  const result = {} as VendorAdjustmentCalculationBaseTotals
  for (const key of Object.keys(totals) as Array<keyof VendorAdjustmentCalculationTotals>) {
    result[key] = formatDecimal4(convertToBase(toDecimal(totals[key]), rate))
  }
  return result
}
