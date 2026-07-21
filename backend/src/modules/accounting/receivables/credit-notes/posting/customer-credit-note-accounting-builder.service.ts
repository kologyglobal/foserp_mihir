import type { DefaultAccountMappingKey } from '@prisma/client'
import { compare, convertToBase, formatForPersistence, isNegative, isZero, sumDecimals, toDecimal } from '../../../shared/finance-decimal.js'
import { PostingError } from '../../../posting/posting.errors.js'
import type { PostingRequest, PostingRequestLine } from '../../../posting/posting.types.js'
import type { CustomerCreditNoteWithLines } from '../customer-credit-note.types.js'
import { buildCustomerCreditNotePostEventKey } from './customer-credit-note-posting.types.js'

function line(
  lineNumber: number,
  amount: string,
  side: 'debit' | 'credit',
  options: {
    accountId?: string
    accountMappingKey?: DefaultAccountMappingKey
    note: CustomerCreditNoteWithLines
    costCentreId?: string | null
    party?: boolean
    narration?: string
  },
): PostingRequestLine {
  const base = formatForPersistence(convertToBase(amount, options.note.exchangeRate.toString()))
  return {
    lineNumber,
    accountId: options.accountId,
    accountMappingKey: options.accountMappingKey,
    partyType: options.party ? 'CUSTOMER' : null,
    partyId: options.party ? options.note.customerId : null,
    partyNameSnapshot: options.party ? options.note.customerNameSnapshot : null,
    debitAmount: side === 'debit' ? formatForPersistence(amount) : '0.0000',
    creditAmount: side === 'credit' ? formatForPersistence(amount) : '0.0000',
    baseDebitAmount: side === 'debit' ? base : '0.0000',
    baseCreditAmount: side === 'credit' ? base : '0.0000',
    currencyCode: options.note.currencyCode,
    exchangeRate: options.note.exchangeRate.toString(),
    costCentreId: options.costCentreId ?? null,
    referenceDocumentType: 'CUSTOMER_CREDIT_NOTE',
    referenceDocumentId: options.note.id,
    lineNarration: options.narration ?? null,
  }
}

export function buildCustomerCreditNotePostingRequest(note: CustomerCreditNoteWithLines, receivableAccountId: string): PostingRequest {
  const lines: PostingRequestLine[] = []
  let sequence = 1
  for (const source of note.lines) {
    if (isZero(source.taxableAmount)) continue
    lines.push(line(sequence++, source.taxableAmount.toString(), 'debit', {
      note,
      accountId: source.revenueReversalAccountId ?? undefined,
      accountMappingKey: source.revenueReversalAccountId ? undefined : 'SALES_REVENUE',
      costCentreId: source.costCentreId,
      narration: source.description ?? 'Revenue reversal',
    }))
  }
  const taxes: Array<[DefaultAccountMappingKey, string]> = [
    ['GST_OUTPUT_CGST', note.cgstAmount.toString()],
    ['GST_OUTPUT_SGST', note.sgstAmount.toString()],
    ['GST_OUTPUT_IGST', note.igstAmount.toString()],
    ['GST_OUTPUT_CESS', note.cessAmount.toString()],
  ]
  for (const [key, amount] of taxes) if (!isZero(amount)) lines.push(line(sequence++, amount, 'debit', { note, accountMappingKey: key }))
  if (!isZero(note.freightAmount)) lines.push(line(sequence++, note.freightAmount.toString(), 'debit', { note, accountMappingKey: 'FREIGHT_OUTWARD' }))
  if (!isZero(note.otherChargesAmount)) lines.push(line(sequence++, note.otherChargesAmount.toString(), 'debit', { note, accountMappingKey: 'SALES_REVENUE' }))
  if (!isZero(note.roundOffAmount)) {
    const negative = isNegative(note.roundOffAmount)
    lines.push(line(sequence++, formatForPersistence(toDecimal(note.roundOffAmount).abs()), negative ? 'credit' : 'debit', {
      note, accountMappingKey: 'ROUNDING',
    }))
  }
  lines.push(line(sequence++, note.grandTotal.toString(), 'credit', {
    note, accountId: receivableAccountId, party: true, narration: 'Customer receivable credit',
  }))
  const debit = sumDecimals(lines.map((item) => item.debitAmount))
  const credit = sumDecimals(lines.map((item) => item.creditAmount))
  if (compare(debit, credit) !== 0) throw new PostingError('UNBALANCED', `Credit note posting is unbalanced: ${debit} / ${credit}`)

  return {
    legalEntityId: note.legalEntityId,
    eventKey: buildCustomerCreditNotePostEventKey(note.id),
    eventType: 'CUSTOMER_CREDIT_NOTE_POSTED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'CREDIT_NOTE',
    documentDate: note.creditNoteDate.toISOString().slice(0, 10),
    postingDate: (note.postingDate ?? note.creditNoteDate).toISOString().slice(0, 10),
    branchId: note.branchId,
    narration: `Customer credit note ${note.draftReference ?? note.id}`,
    currencyCode: note.currencyCode,
    exchangeRate: note.exchangeRate.toString(),
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'CUSTOMER_CREDIT_NOTE',
    sourceDocumentId: note.id,
    lines,
  }
}
