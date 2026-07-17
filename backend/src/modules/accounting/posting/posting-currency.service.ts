import type { FinanceSettings } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import {
  convertToBase,
  formatForPersistence,
  isPositive,
  isZero,
  roundAmount,
  roundExchangeRate,
  toDecimal,
} from '../shared/finance-decimal.js'
import type { PostingRequest, PostingRequestLine, ResolvedPostingLine } from './posting.types.js'
import { PostingError } from './posting.errors.js'

export interface NormalizedLineAmounts {
  debitAmount: string
  creditAmount: string
  baseDebitAmount: string
  baseCreditAmount: string
  currencyCode: string
  exchangeRate: string
}

export async function assertFinanceActivated(tenantId: string, legalEntityId: string): Promise<FinanceSettings> {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  if (!settings?.financeActivated) {
    throw new PostingError('FINANCE_NOT_ACTIVATED', 'Finance module is not activated for this legal entity')
  }
  return settings
}

export async function isMultiCurrencyEnabled(tenantId: string, legalEntityId: string): Promise<boolean> {
  const feature = await prisma.financeFeatureControl.findFirst({
    where: { tenantId, legalEntityId, featureKey: 'MULTI_CURRENCY', isEnabled: true },
  })
  return feature != null
}

export async function normalizePostingCurrency(
  tenantId: string,
  legalEntityId: string,
  request: PostingRequest,
  settings: FinanceSettings,
  resolvedLines: ResolvedPostingLine[],
): Promise<{ voucherCurrency: string; voucherExchangeRate: string; lines: ResolvedPostingLine[] }> {
  const baseCurrency = settings.baseCurrency ?? 'INR'
  const multiCurrency = await isMultiCurrencyEnabled(tenantId, legalEntityId)
  const voucherCurrency = request.currencyCode ?? baseCurrency
  const voucherExchangeRate =
    voucherCurrency === baseCurrency ? '1' : formatForPersistence(roundExchangeRate(request.exchangeRate ?? '1'), 4)

  if (voucherCurrency !== baseCurrency && !multiCurrency) {
    throw new PostingError('MULTI_CURRENCY_NOT_ENABLED', 'Foreign currency posting requires MULTI_CURRENCY feature')
  }

  const normalizedLines = resolvedLines.map((line) => {
    const lineCurrency = line.currencyCode ?? voucherCurrency
    if (!lineCurrency?.trim()) {
      throw new PostingError('INVALID_CURRENCY', `Invalid currency on line ${line.lineNumber}`)
    }
    if (lineCurrency !== baseCurrency && !multiCurrency) {
      throw new PostingError('MULTI_CURRENCY_NOT_ENABLED', `Foreign currency on line ${line.lineNumber} requires MULTI_CURRENCY feature`)
    }

    let rate = line.exchangeRate ?? (lineCurrency === baseCurrency ? '1' : voucherExchangeRate)
    rate = formatForPersistence(roundExchangeRate(rate), 4)
    if (!isPositive(rate)) {
      throw new PostingError('INVALID_EXCHANGE_RATE', `Exchange rate must be positive on line ${line.lineNumber}`)
    }

    const debit = formatForPersistence(roundAmount(line.debitAmount))
    const credit = formatForPersistence(roundAmount(line.creditAmount))
    const baseDebit = formatForPersistence(
      roundAmount(line.baseDebitAmount ?? convertToBase(debit, rate)),
    )
    const baseCredit = formatForPersistence(
      roundAmount(line.baseCreditAmount ?? convertToBase(credit, rate)),
    )

    return {
      ...line,
      debitAmount: debit,
      creditAmount: credit,
      baseDebitAmount: baseDebit,
      baseCreditAmount: baseCredit,
      currencyCode: lineCurrency,
      exchangeRate: lineCurrency === baseCurrency ? '1' : rate,
    }
  })

  return {
    voucherCurrency,
    voucherExchangeRate: voucherCurrency === baseCurrency ? '1' : voucherExchangeRate,
    lines: normalizedLines,
  }
}

export function assertNonZeroTotals(lines: PostingRequestLine[] | ResolvedPostingLine[]): void {
  let totalDebit = toDecimal(0)
  let totalCredit = toDecimal(0)
  for (const line of lines) {
    totalDebit = totalDebit.add(toDecimal(line.debitAmount))
    totalCredit = totalCredit.add(toDecimal(line.creditAmount))
  }
  if (isZero(totalDebit) && isZero(totalCredit)) {
    throw new PostingError('ZERO_TOTAL_POSTING', 'Posting total cannot be zero')
  }
}
