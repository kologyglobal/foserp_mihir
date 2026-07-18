import { Prisma } from '@prisma/client'
import { add, isPositive, isZero, roundAmount, toDecimal } from '../../../shared/finance-decimal.js'
import type {
  CustomerReceiptPostingPreview,
  ReceiptChargeSummaryRow,
  ReceiptPostingPreviewLine,
  ReceiptValidationIssue,
  CustomerReceiptTdsSummary,
} from './customer-receipt-calculation.types.js'
import { RECEIPT_ERROR_CODES, receiptError } from './customer-receipt-calculation.errors.js'
import { format4, toBaseAmount } from './receipt-currency-calculation.service.js'

export interface PostingPreviewAccounts {
  bankCashAccountId: string | null
  customerReceivableAccountId: string | null
  customerTdsAccountId: string | null
  bankChargeAccountIds: Array<string | null>
  otherDeductionAccountIds: Array<string | null>
}

export interface BuildPostingPreviewInput {
  bankCashAmount: Prisma.Decimal
  customerTdsAmount: Prisma.Decimal
  bankChargeAmount: Prisma.Decimal
  otherDeductionAmount: Prisma.Decimal
  grossReceiptAmount: Prisma.Decimal
  exchangeRate: Prisma.Decimal
  customerId: string
  customerNameSnapshot?: string | null
  accounts: PostingPreviewAccounts
  bankChargeRows: ReceiptChargeSummaryRow[]
  otherDeductionRows: ReceiptChargeSummaryRow[]
  tdsSummary: CustomerReceiptTdsSummary | null
}

/**
 * Deterministic, side-effect-free posting preview.
 * Dr Bank/Cash + Dr TDS + Dr Bank Charges + Dr Other Deductions
 *    Cr Customer Receivable (gross)
 */
export function buildCustomerReceiptPostingPreview(
  input: BuildPostingPreviewInput,
): { preview: CustomerReceiptPostingPreview; errors: ReceiptValidationIssue[] } {
  const errors: ReceiptValidationIssue[] = []
  const debitLines: ReceiptPostingPreviewLine[] = []
  const creditLines: ReceiptPostingPreviewLine[] = []
  const rate = input.exchangeRate

  if (isPositive(input.bankCashAmount)) {
    debitLines.push({
      side: 'DEBIT',
      accountId: input.accounts.bankCashAccountId,
      accountRole: 'BANK_CASH',
      amount: format4(input.bankCashAmount),
      baseAmount: format4(toBaseAmount(input.bankCashAmount, rate)),
    })
  }

  if (isPositive(input.customerTdsAmount)) {
    debitLines.push({
      side: 'DEBIT',
      accountId: input.accounts.customerTdsAccountId ?? input.tdsSummary?.accountId ?? null,
      accountRole: 'TDS_RECEIVABLE',
      amount: format4(input.customerTdsAmount),
      baseAmount: format4(toBaseAmount(input.customerTdsAmount, rate)),
    })
  }

  input.bankChargeRows.forEach((row, idx) => {
    const amt = toDecimal(row.amount)
    if (!isPositive(amt)) return
    debitLines.push({
      side: 'DEBIT',
      accountId: input.accounts.bankChargeAccountIds[idx] ?? row.accountId,
      accountRole: 'BANK_CHARGES',
      amount: format4(amt),
      baseAmount: format4(toBaseAmount(amt, rate)),
      narration: row.description,
    })
  })

  // Fallback single bank-charge line when rows empty but total > 0
  if (!input.bankChargeRows.length && isPositive(input.bankChargeAmount)) {
    debitLines.push({
      side: 'DEBIT',
      accountId: input.accounts.bankChargeAccountIds[0] ?? null,
      accountRole: 'BANK_CHARGES',
      amount: format4(input.bankChargeAmount),
      baseAmount: format4(toBaseAmount(input.bankChargeAmount, rate)),
    })
  }

  input.otherDeductionRows.forEach((row, idx) => {
    const amt = toDecimal(row.amount)
    if (!isPositive(amt)) return
    debitLines.push({
      side: 'DEBIT',
      accountId: input.accounts.otherDeductionAccountIds[idx] ?? row.accountId,
      accountRole: 'OTHER_DEDUCTION',
      amount: format4(amt),
      baseAmount: format4(toBaseAmount(amt, rate)),
      narration: row.description,
    })
  })

  if (isPositive(input.grossReceiptAmount)) {
    creditLines.push({
      side: 'CREDIT',
      accountId: input.accounts.customerReceivableAccountId,
      accountRole: 'CUSTOMER_RECEIVABLE',
      amount: format4(input.grossReceiptAmount),
      baseAmount: format4(toBaseAmount(input.grossReceiptAmount, rate)),
      partyType: 'CUSTOMER',
      partyId: input.customerId,
      partyNameSnapshot: input.customerNameSnapshot ?? null,
    })
  }

  const totalDebit = roundAmount(
    debitLines.reduce((acc, l) => acc.add(toDecimal(l.amount)), new Prisma.Decimal(0)),
    4,
  )
  const totalCredit = roundAmount(
    creditLines.reduce((acc, l) => acc.add(toDecimal(l.amount)), new Prisma.Decimal(0)),
    4,
  )
  const baseTotalDebit = roundAmount(
    debitLines.reduce((acc, l) => acc.add(toDecimal(l.baseAmount)), new Prisma.Decimal(0)),
    4,
  )
  const baseTotalCredit = roundAmount(
    creditLines.reduce((acc, l) => acc.add(toDecimal(l.baseAmount)), new Prisma.Decimal(0)),
    4,
  )

  const balanced = totalDebit.eq(totalCredit) && baseTotalDebit.eq(baseTotalCredit)

  if (!balanced && (isPositive(totalDebit) || isPositive(totalCredit) || !isZero(totalDebit) || !isZero(totalCredit))) {
    // Only flag unbalanced when there are amounts to post
    if (!totalDebit.eq(0) || !totalCredit.eq(0)) {
      errors.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_POSTING_PREVIEW_UNBALANCED,
          `Posting preview unbalanced: debit ${format4(totalDebit)} vs credit ${format4(totalCredit)}`,
          'postingPreview',
        ),
      )
    }
  }

  // Sanity: credit should equal gross
  if (isPositive(input.grossReceiptAmount) && !totalCredit.eq(input.grossReceiptAmount)) {
    errors.push(
      receiptError(
        RECEIPT_ERROR_CODES.RECEIPT_POSTING_PREVIEW_UNBALANCED,
        'Customer receivable credit must equal gross receipt amount',
        'postingPreview',
      ),
    )
  }

  // Debit components should sum to gross
  const componentSum = roundAmount(
    add(
      add(input.bankCashAmount, input.customerTdsAmount),
      add(input.bankChargeAmount, input.otherDeductionAmount),
    ),
    4,
  )
  if (isPositive(input.grossReceiptAmount) && !componentSum.eq(input.grossReceiptAmount)) {
    errors.push(
      receiptError(
        RECEIPT_ERROR_CODES.CUSTOMER_RECEIPT_GROSS_AMOUNT_INVALID,
        'Gross receipt does not equal bank + TDS + charges + deductions',
        'grossReceiptAmount',
      ),
    )
  }

  return {
    preview: {
      debitLines,
      creditLines,
      totalDebit: format4(totalDebit),
      totalCredit: format4(totalCredit),
      baseTotalDebit: format4(baseTotalDebit),
      baseTotalCredit: format4(baseTotalCredit),
      balanced: balanced && totalCredit.eq(input.grossReceiptAmount),
    },
    errors,
  }
}
