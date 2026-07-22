import { Prisma } from '@prisma/client'
import { compare, convertToBase, roundExchangeRate, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import { calcError, VENDOR_PAYMENT_CALC_CODES } from './vendor-payment-calculation.errors.js'
import { formatDecimal4 } from './vendor-payment-decimal.js'
import type {
  VendorPaymentCalculationBaseTotals,
  VendorPaymentCalculationTotals,
  VendorPaymentValidationIssue,
} from './vendor-payment-calculation.types.js'

const RATE_UNITY_TOLERANCE = toDecimal('0.00000001')

export function assertVendorPaymentBaseCurrencyRate(
  currencyCode: string | undefined,
  baseCurrencyCode: string,
  exchangeRate: Prisma.Decimal,
  errors: VendorPaymentValidationIssue[],
): void {
  const code = currencyCode ?? baseCurrencyCode
  if (code !== baseCurrencyCode) return
  const diff = subtract(exchangeRate, 1).abs()
  if (compare(diff, RATE_UNITY_TOLERANCE) > 0) {
    errors.push(
      calcError(
        VENDOR_PAYMENT_CALC_CODES.BASE_CURRENCY_RATE_INVALID,
        `Exchange rate must be 1 for base-currency (${baseCurrencyCode}) payments`,
        'exchangeRate',
      ),
    )
  }
}

export function validateVendorPaymentExchangeRate(
  exchangeRateInput: string,
  errors: VendorPaymentValidationIssue[],
): Prisma.Decimal {
  try {
    const rate = roundExchangeRate(exchangeRateInput)
    if (!rate.gt(0)) {
      errors.push(
        calcError(VENDOR_PAYMENT_CALC_CODES.EXCHANGE_RATE_INVALID, 'Exchange rate must be positive', 'exchangeRate'),
      )
      return toDecimal(1)
    }
    return rate
  } catch {
    errors.push(
      calcError(VENDOR_PAYMENT_CALC_CODES.EXCHANGE_RATE_INVALID, 'Exchange rate is invalid', 'exchangeRate'),
    )
    return toDecimal(1)
  }
}

/** Converts every transaction-currency total to base currency using amount × exchangeRate. */
export function convertVendorPaymentTotals(
  totals: VendorPaymentCalculationTotals,
  exchangeRate: string,
): VendorPaymentCalculationBaseTotals {
  const rate = roundExchangeRate(exchangeRate)
  return {
    basePaymentAmount: formatDecimal4(convertToBase(totals.paymentAmount, rate)),
    baseTdsAmount: formatDecimal4(convertToBase(totals.tdsAmount, rate)),
    baseDiscountAmount: formatDecimal4(convertToBase(totals.discountAmount, rate)),
    baseRetentionAmount: formatDecimal4(convertToBase(totals.retentionAmount, rate)),
    baseWithholdingAmount: formatDecimal4(convertToBase(totals.withholdingAmount, rate)),
    baseOtherSettlementCreditAmount: formatDecimal4(convertToBase(totals.otherSettlementCreditAmount, rate)),
    baseSettlementAdjustmentAmount: formatDecimal4(convertToBase(totals.settlementAdjustmentAmount, rate)),
    baseBankChargeAmount: formatDecimal4(convertToBase(totals.bankChargeAmount, rate)),
    baseProcessingChargeAmount: formatDecimal4(convertToBase(totals.processingChargeAmount, rate)),
    baseOtherPaymentExpenseAmount: formatDecimal4(convertToBase(totals.otherPaymentExpenseAmount, rate)),
    basePaymentExpenseAmount: formatDecimal4(convertToBase(totals.paymentExpenseAmount, rate)),
    baseRoundOffDebitAmount: formatDecimal4(convertToBase(totals.roundOffDebitAmount, rate)),
    baseRoundOffCreditAmount: formatDecimal4(convertToBase(totals.roundOffCreditAmount, rate)),
    baseNetRoundOffAmount: formatDecimal4(convertToBase(totals.netRoundOffAmount, rate)),
    baseVendorSettlementAmount: formatDecimal4(convertToBase(totals.vendorSettlementAmount, rate)),
    baseCashOutflowAmount: formatDecimal4(convertToBase(totals.cashOutflowAmount, rate)),
  }
}
