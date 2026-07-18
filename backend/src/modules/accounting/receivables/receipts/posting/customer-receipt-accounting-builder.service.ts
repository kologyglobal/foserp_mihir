/**
 * Builds a balanced PostingRequest for customer receipt posting (Phase 3B4).
 *
 * Strategy (no double-count):
 *   Dr bankCashAccountId       = receipt.bankCashAmount
 *   Dr TDS_RECEIVABLE          = receipt.customerTdsAmount (when > 0)
 *   Dr each BANK_CHARGE line   = deduction line amount (own resolved account)
 *   Dr each OTHER_DEDUCTION line = deduction line amount (own resolved account)
 *   Cr CUSTOMER_RECEIVABLE     = receipt.grossReceiptAmount (party CUSTOMER)
 *
 * Identity: grossReceiptAmount = bankCashAmount + customerTdsAmount + bankChargeAmount + otherDeductionAmount
 */
import { compare, convertToBase, formatForPersistence, isZero, sumDecimals } from '../../../shared/finance-decimal.js'
import { PostingError } from '../../../posting/posting.errors.js'
import type { PostingRequest, PostingRequestLine } from '../../../posting/posting.types.js'
import type { CustomerReceiptWithDeductions } from '../customer-receipt.types.js'
import { buildCustomerReceiptPostEventKey } from './customer-receipt-posting.types.js'

export interface BuildCustomerReceiptPostingRequestAccounts {
  bankCashAccountId: string
  customerReceivableAccountId: string
  customerTdsAccountId: string | null
}

export interface BuildCustomerReceiptPostingRequestInput {
  receipt: CustomerReceiptWithDeductions
  accounts: BuildCustomerReceiptPostingRequestAccounts
}

function debitLine(
  lineNumber: number,
  amount: string,
  opts: {
    accountId: string
    exchangeRate: string
    currencyCode: string
    referenceDocumentId?: string | null
    lineNarration?: string | null
  },
): PostingRequestLine {
  const base = convertToBase(amount, opts.exchangeRate)
  return {
    lineNumber,
    accountId: opts.accountId,
    debitAmount: formatForPersistence(amount),
    creditAmount: '0.0000',
    baseDebitAmount: formatForPersistence(base),
    baseCreditAmount: '0.0000',
    currencyCode: opts.currencyCode,
    exchangeRate: opts.exchangeRate,
    referenceDocumentType: 'CUSTOMER_RECEIPT',
    referenceDocumentId: opts.referenceDocumentId ?? null,
    lineNarration: opts.lineNarration ?? null,
  }
}

function creditLine(
  lineNumber: number,
  amount: string,
  opts: {
    accountId: string
    partyType?: 'CUSTOMER' | null
    partyId?: string | null
    partyNameSnapshot?: string | null
    exchangeRate: string
    currencyCode: string
    referenceDocumentId?: string | null
    lineNarration?: string | null
  },
): PostingRequestLine {
  const base = convertToBase(amount, opts.exchangeRate)
  return {
    lineNumber,
    accountId: opts.accountId,
    partyType: opts.partyType ?? null,
    partyId: opts.partyId ?? null,
    partyNameSnapshot: opts.partyNameSnapshot ?? null,
    debitAmount: '0.0000',
    creditAmount: formatForPersistence(amount),
    baseDebitAmount: '0.0000',
    baseCreditAmount: formatForPersistence(base),
    currencyCode: opts.currencyCode,
    exchangeRate: opts.exchangeRate,
    referenceDocumentType: 'CUSTOMER_RECEIPT',
    referenceDocumentId: opts.referenceDocumentId ?? null,
    lineNarration: opts.lineNarration ?? null,
  }
}

export function buildCustomerReceiptPostingRequest(input: BuildCustomerReceiptPostingRequestInput): PostingRequest {
  const { receipt, accounts } = input
  const receiptId = receipt.id
  const exchangeRate = receipt.exchangeRate.toString()
  const currencyCode = receipt.currencyCode
  const postingDate = (receipt.postingDate ?? receipt.receiptDate).toISOString().slice(0, 10)
  const documentDate = receipt.receiptDate.toISOString().slice(0, 10)

  const lines: PostingRequestLine[] = []
  let lineNumber = 1

  const bankCashAmount = formatForPersistence(receipt.bankCashAmount)
  if (isZero(bankCashAmount)) {
    throw new PostingError('ZERO_TOTAL_POSTING', 'Bank/cash amount must be greater than zero for a customer receipt')
  }
  lines.push(
    debitLine(lineNumber++, bankCashAmount, {
      accountId: accounts.bankCashAccountId,
      exchangeRate,
      currencyCode,
      referenceDocumentId: receiptId,
      lineNarration: receipt.narration ?? 'Customer receipt bank/cash',
    }),
  )

  const tdsAmount = formatForPersistence(receipt.customerTdsAmount)
  if (!isZero(tdsAmount)) {
    if (!accounts.customerTdsAccountId) {
      throw new PostingError('ACCOUNT_RESOLUTION_FAILED', 'TDS receivable account is required when customerTdsAmount > 0')
    }
    lines.push(
      debitLine(lineNumber++, tdsAmount, {
        accountId: accounts.customerTdsAccountId,
        exchangeRate,
        currencyCode,
        referenceDocumentId: receiptId,
        lineNarration: 'Customer TDS receivable',
      }),
    )
  }

  for (const line of receipt.deductionLines.filter((l) => l.type === 'BANK_CHARGE')) {
    const amount = formatForPersistence(line.amount)
    if (isZero(amount)) continue
    if (!line.accountId) {
      throw new PostingError('ACCOUNT_RESOLUTION_FAILED', `Bank charge line ${line.lineNumber} is missing a resolved account`)
    }
    lines.push(
      debitLine(lineNumber++, amount, {
        accountId: line.accountId,
        exchangeRate,
        currencyCode,
        referenceDocumentId: receiptId,
        lineNarration: line.description ?? 'Bank charge',
      }),
    )
  }

  for (const line of receipt.deductionLines.filter((l) => l.type === 'OTHER_DEDUCTION')) {
    const amount = formatForPersistence(line.amount)
    if (isZero(amount)) continue
    if (!line.accountId) {
      throw new PostingError('ACCOUNT_RESOLUTION_FAILED', `Other deduction line ${line.lineNumber} is missing a resolved account`)
    }
    lines.push(
      debitLine(lineNumber++, amount, {
        accountId: line.accountId,
        exchangeRate,
        currencyCode,
        referenceDocumentId: receiptId,
        lineNarration: line.description ?? 'Other deduction',
      }),
    )
  }

  const grossAmount = formatForPersistence(receipt.grossReceiptAmount)
  lines.push(
    creditLine(lineNumber++, grossAmount, {
      accountId: accounts.customerReceivableAccountId,
      partyType: 'CUSTOMER',
      partyId: receipt.customerId,
      partyNameSnapshot: receipt.customerNameSnapshot,
      exchangeRate,
      currencyCode,
      referenceDocumentId: receiptId,
      lineNarration: receipt.narration ?? 'Customer receipt against receivable',
    }),
  )

  const totalDebit = sumDecimals(lines.map((l) => l.debitAmount))
  const totalCredit = sumDecimals(lines.map((l) => l.creditAmount))
  if (compare(totalDebit, totalCredit) !== 0) {
    throw new PostingError(
      'UNBALANCED',
      `Customer receipt posting request is unbalanced: debit=${totalDebit.toString()} credit=${totalCredit.toString()}`,
    )
  }
  if (compare(totalCredit, grossAmount) !== 0) {
    throw new PostingError(
      'UNBALANCED',
      `Customer receipt total credit ${totalCredit.toString()} does not equal gross receipt amount ${grossAmount}`,
    )
  }

  return {
    legalEntityId: receipt.legalEntityId,
    eventKey: buildCustomerReceiptPostEventKey(receiptId),
    eventType: 'CUSTOMER_RECEIPT_POSTED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate,
    postingDate,
    branchId: receipt.branchId,
    referenceNumber: receipt.referenceNumber,
    narration: receipt.narration ?? `Customer receipt ${receipt.draftReference ?? receiptId}`,
    currencyCode,
    exchangeRate,
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'CUSTOMER_RECEIPT',
    sourceDocumentId: receiptId,
    lines,
  }
}
