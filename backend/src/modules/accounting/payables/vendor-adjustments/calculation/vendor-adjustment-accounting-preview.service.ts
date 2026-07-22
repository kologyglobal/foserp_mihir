/**
 * Vendor invoice accounting preview builder (Phase 4A2).
 *
 * Pure/synchronous — builds a balanced (when accounts resolve) draft journal preview from the
 * calculated amounts and the resolved accounts, without touching the DB or posting anything.
 *
 * Balancing identity (holds for both REGULAR and RCM invoices):
 *   Dr  Σ line (taxable + nonRecoverableTax)         [LINE_OFFSET, per line]
 *   Dr  Σ recoverable input tax (CGST/SGST/IGST/CESS) [INPUT_*, header aggregate]
 *   Dr  freight amount                                [FREIGHT]
 *   Dr/Cr round-off                                    [ROUND_OFF] (Dr when positive, Cr when negative)
 *   Cr  vendorPayableAmount                            [VENDOR_PAYABLE]
 *   Cr  tdsAmount (AT_INVOICE only)                    [TDS_PAYABLE]
 *   Cr  rcmTaxTotals.{cgst,sgst,igst}Amount (RCM only) [RCM_*_PAYABLE] — additive, already
 *       balanced against the (recoverable + non-recoverable) RCM tax booked on the debit side.
 *
 * Any component whose required account did not resolve is simply omitted from `lines` (with an
 * issue recorded) — the two sides will then legitimately fail to balance, which is the signal
 * that the invoice cannot yet be posted.
 */
import type { VendorAdjustmentTdsTreatment, VendorAdjustmentType } from '@prisma/client'
import { add, compare, formatForPersistence, isNegative, isPositive, isZero, subtract, sumDecimals, toDecimal } from '../../../shared/finance-decimal.js'
import { calcError, VENDOR_ADJUSTMENT_CALC_CODES } from './vendor-adjustment-calculation.errors.js'
import { computeRecoverableInputTaxByComponent } from './vendor-adjustment-account-resolver.service.js'
import type { VendorAdjustmentAmountsCalculationResult } from './vendor-adjustment-amounts.service.js'
import type {
  VendorAdjustmentAccountComponent,
  VendorAdjustmentAccountReadiness,
  VendorAdjustmentAccountingPreview,
  VendorAdjustmentAccountingPreviewLine,
  VendorAdjustmentResolvedAccount,
  VendorAdjustmentValidationIssue,
} from './vendor-adjustment-calculation.types.js'

export interface BuildVendorAdjustmentAccountingPreviewParams {
  amountsResult: VendorAdjustmentAmountsCalculationResult
  accountReadiness: VendorAdjustmentAccountReadiness
  input: {
    vendorId?: string | null
    currencyCode?: string
    exchangeRate?: string
    adjustmentType: VendorAdjustmentType
    tdsTreatment?: VendorAdjustmentTdsTreatment
  }
}

function findResolvedAccount(
  resolvedAccounts: VendorAdjustmentResolvedAccount[],
  component: VendorAdjustmentAccountComponent,
  lineNumber: number | null,
): VendorAdjustmentResolvedAccount | undefined {
  return resolvedAccounts.find(
    (entry) => entry.component === component && entry.lineNumber === lineNumber && entry.accountId != null && entry.isValid,
  )
}

export function buildVendorAdjustmentAccountingPreview(params: BuildVendorAdjustmentAccountingPreviewParams): VendorAdjustmentAccountingPreview {
  const { amountsResult, accountReadiness, input } = params
  const totals = amountsResult.totals
  const lines: VendorAdjustmentAccountingPreviewLine[] = []
  const issues: VendorAdjustmentValidationIssue[] = []
  let lineNumber = 0

  function pushLine(
    component: VendorAdjustmentAccountComponent,
    direction: 'DEBIT' | 'CREDIT',
    amount: string,
    description: string,
    opts: { sourceLineNumber?: number | null; costCentreId?: string | null; partyId?: string | null } = {},
  ): void {
    if (isZero(amount)) return
    const account = findResolvedAccount(accountReadiness.resolvedAccounts, component, opts.sourceLineNumber ?? null)
    if (!account) {
      issues.push(
        calcError(
          VENDOR_ADJUSTMENT_CALC_CODES.ACCOUNT_NOT_CONFIGURED,
          `Cannot build accounting preview line for ${component}${opts.sourceLineNumber != null ? ` (line ${opts.sourceLineNumber})` : ''} — account not resolved`,
          component,
        ),
      )
      return
    }
    lineNumber += 1
    lines.push({
      lineNumber,
      component,
      direction,
      accountId: account.accountId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      description,
      debitAmount: direction === 'DEBIT' ? formatForPersistence(amount) : '0.0000',
      creditAmount: direction === 'CREDIT' ? formatForPersistence(amount) : '0.0000',
      partyType: component === 'VENDOR_PAYABLE' ? 'VENDOR' : null,
      partyId: component === 'VENDOR_PAYABLE' ? (opts.partyId ?? input.vendorId ?? null) : null,
      costCentreId: opts.costCentreId ?? null,
      sourceLineNumber: opts.sourceLineNumber ?? null,
    })
  }

  const isDebitNote = input.adjustmentType === 'VENDOR_DEBIT_NOTE'
  const tdsApplies =
    input.tdsTreatment === 'ADD_TDS_LIABILITY' || input.tdsTreatment === 'REVERSE_TDS_LIABILITY'

  for (const line of amountsResult.lines) {
    const offsetAmount = add(toDecimal(line.taxableAmount), toDecimal(line.nonRecoverableTaxAmount))
    pushLine(
      'LINE_OFFSET',
      isDebitNote ? 'CREDIT' : 'DEBIT',
      formatForPersistence(offsetAmount),
      line.description,
      { sourceLineNumber: line.lineNumber, costCentreId: line.costCentreId },
    )
  }

  const recoverable = computeRecoverableInputTaxByComponent(totals)
  pushLine('INPUT_CGST', isDebitNote ? 'CREDIT' : 'DEBIT', recoverable.cgst, isDebitNote ? 'Input CGST reversal' : 'Input CGST credit')
  pushLine('INPUT_SGST', isDebitNote ? 'CREDIT' : 'DEBIT', recoverable.sgst, isDebitNote ? 'Input SGST reversal' : 'Input SGST credit')
  pushLine('INPUT_IGST', isDebitNote ? 'CREDIT' : 'DEBIT', recoverable.igst, isDebitNote ? 'Input IGST reversal' : 'Input IGST credit')
  pushLine('INPUT_CESS', isDebitNote ? 'CREDIT' : 'DEBIT', recoverable.cess, isDebitNote ? 'Input cess reversal' : 'Input cess credit')

  pushLine('FREIGHT', isDebitNote ? 'CREDIT' : 'DEBIT', totals.freightAmount, 'Freight charges')
  pushLine('OTHER_CHARGE', isDebitNote ? 'CREDIT' : 'DEBIT', totals.otherChargeAmount, 'Other charges')

  pushLine(
    'VENDOR_PAYABLE',
    isDebitNote ? 'DEBIT' : 'CREDIT',
    totals.vendorPayableAmount,
    isDebitNote ? 'Reduce vendor payable' : 'Increase vendor payable',
  )

  if (tdsApplies) {
    const reverseTds = input.tdsTreatment === 'REVERSE_TDS_LIABILITY'
    pushLine(
      'TDS_PAYABLE',
      reverseTds ? 'DEBIT' : 'CREDIT',
      totals.tdsAmount,
      reverseTds ? 'Reverse TDS liability' : 'TDS liability',
    )
  }

  const roundOff = toDecimal(totals.roundOffAmount)
  if (!isZero(roundOff)) {
    if (isPositive(roundOff)) {
      pushLine('ROUND_OFF', 'DEBIT', formatForPersistence(roundOff), 'Rounding adjustment')
    } else if (isNegative(roundOff)) {
      pushLine('ROUND_OFF', 'CREDIT', formatForPersistence(roundOff.abs()), 'Rounding adjustment')
    }
  }

  if (amountsResult.isRcm) {
    pushLine('RCM_CGST_PAYABLE', 'CREDIT', amountsResult.rcmTaxTotals.cgstAmount, 'RCM CGST payable (self-assessed)')
    pushLine('RCM_SGST_PAYABLE', 'CREDIT', amountsResult.rcmTaxTotals.sgstAmount, 'RCM SGST payable (self-assessed)')
    pushLine('RCM_IGST_PAYABLE', 'CREDIT', amountsResult.rcmTaxTotals.igstAmount, 'RCM IGST payable (self-assessed)')
  }

  const totalDebit = sumDecimals(lines.map((l) => l.debitAmount))
  const totalCredit = sumDecimals(lines.map((l) => l.creditAmount))
  const difference = subtract(totalDebit, totalCredit)
  const isBalanced = issues.length === 0 && compare(totalDebit, totalCredit) === 0 && lines.length > 0

  if (!isBalanced && issues.length === 0) {
    issues.push(
      calcError(
        VENDOR_ADJUSTMENT_CALC_CODES.ACCOUNTING_PREVIEW_UNBALANCED,
        `Accounting preview is unbalanced: debit=${formatForPersistence(totalDebit)} credit=${formatForPersistence(totalCredit)}`,
      ),
    )
  }

  return {
    isBalanced,
    lines,
    totalDebit: formatForPersistence(totalDebit),
    totalCredit: formatForPersistence(totalCredit),
    difference: formatForPersistence(difference),
    vendorPayableCreditAmount: formatForPersistence(totals.vendorPayableAmount),
    issues,
  }
}
