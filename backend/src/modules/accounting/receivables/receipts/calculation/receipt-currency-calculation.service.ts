import { Prisma } from '@prisma/client'
import {
  convertToBase,
  isPositive,
  isZero,
  roundAmount,
  roundExchangeRate,
  toDecimal,
} from '../../../shared/finance-decimal.js'
import type { ReceiptValidationIssue } from './customer-receipt-calculation.types.js'
import { RECEIPT_ERROR_CODES, receiptError } from './customer-receipt-calculation.errors.js'

function format4(value: Prisma.Decimal): string {
  return roundAmount(value, 4).toFixed(4)
}

function format8(value: Prisma.Decimal): string {
  return roundExchangeRate(value).toFixed(8)
}

export interface ReceiptCurrencyContext {
  currencyCode: string
  baseCurrencyCode: string
  exchangeRateInput: string | null | undefined
  multiCurrencyEnabled: boolean
}

export interface ReceiptCurrencyResult {
  currencyCode: string
  exchangeRate: string
  exchangeRateDecimal: Prisma.Decimal
  errors: ReceiptValidationIssue[]
}

/**
 * Resolve and validate receipt currency / exchange rate (pure except for feature flag passed in).
 * Base currency → rate forced to 1.
 * Foreign currency → requires MULTI_CURRENCY and positive rate.
 */
export function resolveReceiptCurrency(ctx: ReceiptCurrencyContext): ReceiptCurrencyResult {
  const errors: ReceiptValidationIssue[] = []
  const currencyCode = (ctx.currencyCode || 'INR').toUpperCase()
  const baseCurrencyCode = (ctx.baseCurrencyCode || 'INR').toUpperCase()

  if (!/^[A-Z]{3,8}$/.test(currencyCode)) {
    errors.push(
      receiptError(RECEIPT_ERROR_CODES.RECEIPT_CURRENCY_INVALID, 'Invalid currency code', 'currencyCode'),
    )
  }

  const isForeign = currencyCode !== baseCurrencyCode
  let rate = toDecimal(ctx.exchangeRateInput ?? '1')

  if (isForeign || (ctx.exchangeRateInput != null && !toDecimal(ctx.exchangeRateInput).eq(1))) {
    if (!ctx.multiCurrencyEnabled) {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_MULTI_CURRENCY_DISABLED,
          'Foreign currency or non-unity exchange rate requires MULTI_CURRENCY feature',
          'currencyCode',
        ),
      )
    }
  }

  if (!isForeign) {
    rate = new Prisma.Decimal(1)
  } else {
    if (ctx.exchangeRateInput == null || ctx.exchangeRateInput === '') {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_EXCHANGE_RATE_INVALID,
          'Exchange rate is required for foreign currency',
          'exchangeRate',
        ),
      )
      rate = new Prisma.Decimal(1)
    } else if (!isPositive(rate) || isZero(rate)) {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_EXCHANGE_RATE_INVALID,
          'Exchange rate must be greater than zero',
          'exchangeRate',
        ),
      )
    } else {
      rate = roundExchangeRate(rate)
    }
  }

  return {
    currencyCode,
    exchangeRate: format8(rate),
    exchangeRateDecimal: rate,
    errors,
  }
}

export function toBaseAmount(amount: Prisma.Decimal, exchangeRate: Prisma.Decimal): Prisma.Decimal {
  return roundAmount(convertToBase(amount, exchangeRate), 4)
}

export { format4, format8 }
