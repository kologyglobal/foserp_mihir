import { add, convertToBase, isPositive, isZero, roundExchangeRate, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import { calcError, VENDOR_PAYMENT_CALC_CODES } from './vendor-payment-calculation.errors.js'
import { formatDecimal4 } from './vendor-payment-decimal.js'
import type {
  VendorPaymentAccountReadiness,
  VendorPaymentAccountingPreview,
  VendorPaymentAccountingPreviewLine,
  VendorPaymentCalculatedAdjustment,
  VendorPaymentCalculationBaseTotals,
  VendorPaymentCalculationInput,
  VendorPaymentCalculationTotals,
  VendorPaymentOpenItemPreview,
  VendorPaymentResolvedAccount,
  VendorPaymentValidationIssue,
} from './vendor-payment-calculation.types.js'

function findAccount(
  readiness: VendorPaymentAccountReadiness,
  component: string,
  lineNumber?: number | null,
): VendorPaymentResolvedAccount | undefined {
  if (lineNumber != null) {
    const byLine = readiness.resolvedAccounts.find((a) => a.component === component && a.lineNumber === lineNumber)
    if (byLine) return byLine
  }
  return readiness.resolvedAccounts.find((a) => a.component === component)
}

function emptyPreview(): VendorPaymentAccountingPreview {
  const z = '0.0000'
  return {
    isBalanced: true,
    isBaseBalanced: true,
    debitTotal: z,
    creditTotal: z,
    difference: z,
    baseDebitTotal: z,
    baseCreditTotal: z,
    baseDifference: z,
    vendorPayableDebitAmount: z,
    baseVendorPayableDebitAmount: z,
    paymentAccountCreditAmount: z,
    basePaymentAccountCreditAmount: z,
    lines: [],
    issues: [],
  }
}

/**
 * Side-effect-free accounting preview — same structure Phase 4B3 should post.
 */
export function buildVendorPaymentAccountingPreview(params: {
  input: VendorPaymentCalculationInput
  totals: VendorPaymentCalculationTotals
  baseTotals: VendorPaymentCalculationBaseTotals
  adjustments: VendorPaymentCalculatedAdjustment[]
  accountReadiness: VendorPaymentAccountReadiness
}): VendorPaymentAccountingPreview {
  const { input, totals, baseTotals, adjustments, accountReadiness } = params
  const issues: VendorPaymentValidationIssue[] = []
  const rate = roundExchangeRate(input.exchangeRate)
  const currencyCode = input.currencyCode
  const lines: VendorPaymentAccountingPreviewLine[] = []
  let sequence = 0

  const pushLine = (partial: Omit<VendorPaymentAccountingPreviewLine, 'sequence'>) => {
    sequence += 1
    lines.push({ sequence, ...partial })
  }

  const vendorPayable = findAccount(accountReadiness, 'VENDOR_PAYABLE')
  const settlement = toDecimal(totals.vendorSettlementAmount)
  const baseSettlement = toDecimal(baseTotals.baseVendorSettlementAmount)

  if (isPositive(settlement)) {
    pushLine({
      component: 'VENDOR_PAYABLE',
      accountId: vendorPayable?.accountId ?? null,
      accountCode: vendorPayable?.accountCode ?? null,
      accountName: vendorPayable?.accountName ?? null,
      direction: 'DEBIT',
      debitAmount: formatDecimal4(settlement),
      creditAmount: '0.0000',
      baseDebitAmount: formatDecimal4(baseSettlement),
      baseCreditAmount: '0.0000',
      currencyCode,
      exchangeRate: formatDecimal4(rate),
      partyType: 'VENDOR',
      partyId: input.vendorId,
      narration: input.narration?.trim() || 'Vendor payment — payable debit',
    })
  }

  // Payment expense debits
  for (const adj of adjustments) {
    if (!adj.affectsCashOutflow || !isPositive(toDecimal(adj.amount))) continue
    const component =
      adj.adjustmentType === 'BANK_CHARGE'
        ? 'BANK_CHARGE'
        : adj.adjustmentType === 'PROCESSING_CHARGE'
          ? 'PROCESSING_CHARGE'
          : 'OTHER_ADJUSTMENT'
    const acct = findAccount(accountReadiness, component, adj.lineNumber) ?? findAccount(accountReadiness, component)
    const amt = toDecimal(adj.amount)
    const baseAmt = toDecimal(adj.baseAmount)
    pushLine({
      component,
      adjustmentLineId: adj.id,
      lineNumber: adj.lineNumber,
      accountId: acct?.accountId ?? adj.accountId,
      accountCode: acct?.accountCode ?? null,
      accountName: acct?.accountName ?? null,
      direction: 'DEBIT',
      debitAmount: formatDecimal4(amt),
      creditAmount: '0.0000',
      baseDebitAmount: formatDecimal4(baseAmt),
      baseCreditAmount: '0.0000',
      currencyCode,
      exchangeRate: formatDecimal4(rate),
      partyType: null,
      partyId: null,
      costCentreId: adj.costCentreId,
      narration: adj.description,
    })
  }

  // Round-off debit
  if (isPositive(toDecimal(totals.roundOffDebitAmount))) {
    const acct = findAccount(accountReadiness, 'ROUND_OFF_DEBIT')
    const amt = toDecimal(totals.roundOffDebitAmount)
    pushLine({
      component: 'ROUND_OFF_DEBIT',
      accountId: acct?.accountId ?? null,
      accountCode: acct?.accountCode ?? null,
      accountName: acct?.accountName ?? null,
      direction: 'DEBIT',
      debitAmount: formatDecimal4(amt),
      creditAmount: '0.0000',
      baseDebitAmount: formatDecimal4(toDecimal(baseTotals.baseRoundOffDebitAmount)),
      baseCreditAmount: '0.0000',
      currencyCode,
      exchangeRate: formatDecimal4(rate),
      partyType: null,
      partyId: null,
      narration: 'Round-off debit',
    })
  }

  // Payment account credit = cash outflow
  const cashOut = toDecimal(totals.cashOutflowAmount)
  const baseCashOut = toDecimal(baseTotals.baseCashOutflowAmount)
  const paymentAcct = findAccount(accountReadiness, 'PAYMENT_ACCOUNT')
  if (isPositive(cashOut)) {
    pushLine({
      component: 'PAYMENT_ACCOUNT',
      accountId: paymentAcct?.accountId ?? null,
      accountCode: paymentAcct?.accountCode ?? null,
      accountName: paymentAcct?.accountName ?? null,
      direction: 'CREDIT',
      debitAmount: '0.0000',
      creditAmount: formatDecimal4(cashOut),
      baseDebitAmount: '0.0000',
      baseCreditAmount: formatDecimal4(baseCashOut),
      currencyCode,
      exchangeRate: formatDecimal4(rate),
      partyType: null,
      partyId: null,
      narration: input.narration?.trim() || 'Vendor payment — bank/cash credit',
    })
  }

  // Settlement adjustment credits
  for (const adj of adjustments) {
    if (adj.accountingRole !== 'SETTLEMENT_CREDIT' || !isPositive(toDecimal(adj.amount))) continue
    const component =
      adj.adjustmentType === 'TDS'
        ? 'TDS_PAYABLE'
        : adj.adjustmentType === 'DISCOUNT'
          ? 'DISCOUNT_RECEIVED'
          : adj.adjustmentType === 'RETENTION'
            ? 'RETENTION_PAYABLE'
            : adj.adjustmentType === 'WITHHOLDING'
              ? 'WITHHOLDING_PAYABLE'
              : 'OTHER_ADJUSTMENT'
    const acct = findAccount(accountReadiness, component, adj.lineNumber) ?? findAccount(accountReadiness, component)
    const amt = toDecimal(adj.amount)
    const baseAmt = toDecimal(adj.baseAmount)
    pushLine({
      component,
      adjustmentLineId: adj.id,
      lineNumber: adj.lineNumber,
      accountId: acct?.accountId ?? adj.accountId,
      accountCode: acct?.accountCode ?? null,
      accountName: acct?.accountName ?? null,
      direction: 'CREDIT',
      debitAmount: '0.0000',
      creditAmount: formatDecimal4(amt),
      baseDebitAmount: '0.0000',
      baseCreditAmount: formatDecimal4(baseAmt),
      currencyCode,
      exchangeRate: formatDecimal4(rate),
      partyType: null,
      partyId: null,
      costCentreId: adj.costCentreId,
      statutorySection: adj.sectionCode,
      narration: adj.description,
    })
  }

  // Round-off credit
  if (isPositive(toDecimal(totals.roundOffCreditAmount))) {
    const acct = findAccount(accountReadiness, 'ROUND_OFF_CREDIT')
    const amt = toDecimal(totals.roundOffCreditAmount)
    pushLine({
      component: 'ROUND_OFF_CREDIT',
      accountId: acct?.accountId ?? null,
      accountCode: acct?.accountCode ?? null,
      accountName: acct?.accountName ?? null,
      direction: 'CREDIT',
      debitAmount: '0.0000',
      creditAmount: formatDecimal4(amt),
      baseDebitAmount: '0.0000',
      baseCreditAmount: formatDecimal4(toDecimal(baseTotals.baseRoundOffCreditAmount)),
      currencyCode,
      exchangeRate: formatDecimal4(rate),
      partyType: null,
      partyId: null,
      narration: 'Round-off credit',
    })
  }

  // Base residual: assign any tiny FX residual to payment account credit so base balances
  let debitTotal = toDecimal(0)
  let creditTotal = toDecimal(0)
  let baseDebitTotal = toDecimal(0)
  let baseCreditTotal = toDecimal(0)
  for (const line of lines) {
    debitTotal = add(debitTotal, line.debitAmount)
    creditTotal = add(creditTotal, line.creditAmount)
    baseDebitTotal = add(baseDebitTotal, line.baseDebitAmount)
    baseCreditTotal = add(baseCreditTotal, line.baseCreditAmount)
  }

  const baseDiff = subtract(baseDebitTotal, baseCreditTotal)
  if (!isZero(baseDiff) && lines.length > 0) {
    const paymentLine = lines.find((l) => l.component === 'PAYMENT_ACCOUNT' && l.direction === 'CREDIT')
    if (paymentLine) {
      // If debit > credit, increase credit; if credit > debit, decrease credit (or increase via last debit)
      if (baseDiff.gt(0)) {
        paymentLine.baseCreditAmount = formatDecimal4(add(paymentLine.baseCreditAmount, baseDiff))
        baseCreditTotal = add(baseCreditTotal, baseDiff)
      } else {
        const abs = baseDiff.abs()
        paymentLine.baseCreditAmount = formatDecimal4(subtract(paymentLine.baseCreditAmount, abs))
        baseCreditTotal = subtract(baseCreditTotal, abs)
      }
    }
  }

  const difference = subtract(debitTotal, creditTotal)
  const baseDifference = subtract(baseDebitTotal, baseCreditTotal)
  const isBalanced = isZero(difference)
  const isBaseBalanced = isZero(baseDifference)

  if (!isBalanced) {
    issues.push(
      calcError(
        VENDOR_PAYMENT_CALC_CODES.ACCOUNTING_PREVIEW_UNBALANCED,
        `Accounting preview unbalanced by ${formatDecimal4(difference)}`,
        'accountingPreview',
      ),
    )
  }
  if (!isBaseBalanced) {
    issues.push(
      calcError(
        VENDOR_PAYMENT_CALC_CODES.BASE_PREVIEW_UNBALANCED,
        `Base accounting preview unbalanced by ${formatDecimal4(baseDifference)}`,
        'accountingPreview',
      ),
    )
  }

  return {
    isBalanced,
    isBaseBalanced,
    debitTotal: formatDecimal4(debitTotal),
    creditTotal: formatDecimal4(creditTotal),
    difference: formatDecimal4(difference),
    baseDebitTotal: formatDecimal4(baseDebitTotal),
    baseCreditTotal: formatDecimal4(baseCreditTotal),
    baseDifference: formatDecimal4(baseDifference),
    vendorPayableDebitAmount: formatDecimal4(settlement),
    baseVendorPayableDebitAmount: formatDecimal4(baseSettlement),
    paymentAccountCreditAmount: formatDecimal4(cashOut),
    basePaymentAccountCreditAmount: formatDecimal4(baseCashOut),
    lines,
    issues,
  }
}

export function buildVendorPaymentOpenItemPreview(params: {
  paymentPurpose: VendorPaymentCalculationInput['paymentPurpose']
  totals: VendorPaymentCalculationTotals
  baseTotals: VendorPaymentCalculationBaseTotals
  vendorPayableAccountId: string | null
}): VendorPaymentOpenItemPreview {
  const { paymentPurpose, totals, baseTotals, vendorPayableAccountId } = params
  // MIXED → single VENDOR_PAYMENT debit open item (allocatable residual = advance)
  const documentType = paymentPurpose === 'ADVANCE' ? 'VENDOR_ADVANCE' : 'VENDOR_PAYMENT'
  const amount = totals.vendorSettlementAmount
  const baseAmount = baseTotals.baseVendorSettlementAmount
  return {
    side: 'DEBIT',
    documentType,
    originalAmount: amount,
    baseOriginalAmount: baseAmount,
    outstandingAmount: amount,
    baseOutstandingAmount: baseAmount,
    vendorPayableAccountId,
  }
}

export { emptyPreview, convertToBase }
