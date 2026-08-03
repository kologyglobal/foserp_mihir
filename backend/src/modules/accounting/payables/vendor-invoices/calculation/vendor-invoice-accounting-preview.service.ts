/**
 * Vendor invoice accounting preview builder (Phase 4A2).
 *
 * Pure/synchronous — builds a balanced (when accounts resolve) draft journal preview from the
 * calculated amounts and the resolved accounts, without touching the DB or posting anything.
 *
 * Balancing identity (holds for both REGULAR and RCM invoices):
 *   Dr  Σ line (taxable + nonRecoverableTax)         [LINE_DEBIT, per line]
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
import type { TdsRecognitionMode } from '@prisma/client'
import { add, compare, formatForPersistence, isNegative, isPositive, isZero, subtract, sumDecimals, toDecimal } from '../../../shared/finance-decimal.js'
import { calcError, VENDOR_INVOICE_CALC_CODES } from './vendor-invoice-calculation.errors.js'
import { computeRecoverableInputTaxByComponent } from './vendor-invoice-account-resolver.service.js'
import { grirLineFor } from './vendor-invoice-grir-release.service.js'
import type { VendorInvoiceGrirReleasePlan } from './vendor-invoice-grir-release.service.js'
import type { VendorInvoiceAmountsCalculationResult } from './vendor-invoice-amounts.service.js'
import type {
  VendorInvoiceAccountComponent,
  VendorInvoiceAccountReadiness,
  VendorInvoiceAccountingPreview,
  VendorInvoiceAccountingPreviewLine,
  VendorInvoiceResolvedAccount,
  VendorInvoiceValidationIssue,
} from './vendor-invoice-calculation.types.js'

export interface BuildVendorInvoiceAccountingPreviewParams {
  amountsResult: VendorInvoiceAmountsCalculationResult
  accountReadiness: VendorInvoiceAccountReadiness
  input: {
    vendorId?: string | null
    currencyCode?: string
    exchangeRate?: string
    tdsRecognitionMode?: TdsRecognitionMode
  }
  /** FIN-CLOSE-1 — lines listed here clear GR/IR instead of debiting PURCHASE. */
  grirReleasePlan?: VendorInvoiceGrirReleasePlan | null
}

function findResolvedAccount(
  resolvedAccounts: VendorInvoiceResolvedAccount[],
  component: VendorInvoiceAccountComponent,
  lineNumber: number | null,
): VendorInvoiceResolvedAccount | undefined {
  return resolvedAccounts.find(
    (entry) => entry.component === component && entry.lineNumber === lineNumber && entry.accountId != null && entry.isValid,
  )
}

export function buildVendorInvoiceAccountingPreview(params: BuildVendorInvoiceAccountingPreviewParams): VendorInvoiceAccountingPreview {
  const { amountsResult, accountReadiness, input } = params
  const totals = amountsResult.totals
  const lines: VendorInvoiceAccountingPreviewLine[] = []
  const issues: VendorInvoiceValidationIssue[] = []
  let lineNumber = 0

  function pushLine(
    component: VendorInvoiceAccountComponent,
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
          VENDOR_INVOICE_CALC_CODES.ACCOUNT_NOT_CONFIGURED,
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

  for (const line of amountsResult.lines) {
    const grir = grirLineFor(params.grirReleasePlan, line.lineNumber)
    if (grir) {
      // Release the receipt-cost balance the GRN parked in GR/IR, then book the difference
      // between invoice price and receipt cost to purchase price variance.
      pushLine('GRIR_CLEARING', 'DEBIT', grir.grirAmount, `GR/IR release — ${line.description}`, {
        sourceLineNumber: line.lineNumber,
        costCentreId: line.costCentreId,
      })
      const inventoryAdjustment = toDecimal(grir.inventoryAdjustmentAmount)
      if (isPositive(inventoryAdjustment)) {
        pushLine('RAW_MATERIAL_INVENTORY', 'DEBIT', formatForPersistence(inventoryAdjustment), `Retro cost adjustment — ${line.description}`, {
          sourceLineNumber: line.lineNumber,
          costCentreId: line.costCentreId,
        })
      } else if (isNegative(inventoryAdjustment)) {
        pushLine('RAW_MATERIAL_INVENTORY', 'CREDIT', formatForPersistence(inventoryAdjustment.abs()), `Retro cost adjustment — ${line.description}`, {
          sourceLineNumber: line.lineNumber,
          costCentreId: line.costCentreId,
        })
      }
      const ppv = toDecimal(grir.ppvAmount)
      if (isPositive(ppv)) {
        pushLine('PURCHASE_PRICE_VARIANCE', 'DEBIT', formatForPersistence(ppv), `Price variance — ${line.description}`, {
          sourceLineNumber: line.lineNumber,
          costCentreId: line.costCentreId,
        })
      } else if (isNegative(ppv)) {
        pushLine('PURCHASE_PRICE_VARIANCE', 'CREDIT', formatForPersistence(ppv.abs()), `Price variance — ${line.description}`, {
          sourceLineNumber: line.lineNumber,
          costCentreId: line.costCentreId,
        })
      }
      // Non-recoverable tax is never part of GR/IR — it stays on the expense account.
      pushLine('LINE_DEBIT', 'DEBIT', formatForPersistence(toDecimal(line.nonRecoverableTaxAmount)), line.description, {
        sourceLineNumber: line.lineNumber,
        costCentreId: line.costCentreId,
      })
      continue
    }

    const debitAmount = add(toDecimal(line.taxableAmount), toDecimal(line.nonRecoverableTaxAmount))
    pushLine('LINE_DEBIT', 'DEBIT', formatForPersistence(debitAmount), line.description, {
      sourceLineNumber: line.lineNumber,
      costCentreId: line.costCentreId,
    })
  }

  const recoverable = computeRecoverableInputTaxByComponent(totals)
  pushLine('INPUT_CGST', 'DEBIT', recoverable.cgst, 'Input CGST credit')
  pushLine('INPUT_SGST', 'DEBIT', recoverable.sgst, 'Input SGST credit')
  pushLine('INPUT_IGST', 'DEBIT', recoverable.igst, 'Input IGST credit')
  pushLine('INPUT_CESS', 'DEBIT', recoverable.cess, 'Input cess credit')

  pushLine('FREIGHT', 'DEBIT', totals.freightAmount, 'Freight inward charges')
  pushLine('OTHER_CHARGE', 'DEBIT', totals.otherChargeAmount, 'Other purchase charges')

  pushLine('VENDOR_PAYABLE', 'CREDIT', totals.vendorPayableAmount, 'Amount payable to vendor')

  const tdsAtInvoice = (input.tdsRecognitionMode ?? 'NOT_APPLICABLE') === 'AT_INVOICE'
  if (tdsAtInvoice) {
    pushLine('TDS_PAYABLE', 'CREDIT', totals.tdsAmount, 'TDS deducted at source')
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
        VENDOR_INVOICE_CALC_CODES.ACCOUNTING_PREVIEW_UNBALANCED,
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
