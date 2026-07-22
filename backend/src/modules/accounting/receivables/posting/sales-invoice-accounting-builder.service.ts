/**
 * Builds a balanced PostingRequest for sales invoice posting (Phase 3A4).
 *
 * Strategy (no double-count):
 *   Dr CUSTOMER_RECEIVABLE = invoice.totalAmount
 *   Cr revenue (per line)  = line.taxableAmount
 *   Cr GST_OUTPUT_*        = invoice cgst/sgst/igst/cess (includes freight/charge tax)
 *   Cr FREIGHT_OUTWARD     = freightAmount base only (freight GST already in tax totals)
 *   Cr other charge acct   = otherChargesAmount base only
 *   Cr/Dr ROUNDING         = roundOffAmount (+ credit, − debit)
 *
 * Identity: totalAmount = line taxable + taxes + freight + other + roundOff
 */
import type { DefaultAccountMappingKey } from '@prisma/client'
import {
  add,
  compare,
  convertToBase,
  formatForPersistence,
  isNegative,
  isPositive,
  isZero,
  sumDecimals,
  toDecimal,
} from '../../shared/finance-decimal.js'
import { PostingError } from '../../posting/posting.errors.js'
import type { PostingRequest, PostingRequestLine } from '../../posting/posting.types.js'
import type { SalesInvoiceCalculationContext, SalesInvoiceWithLines } from '../sales-invoices/sales-invoice.types.js'
import { buildSalesInvoicePostEventKey } from './sales-invoice-posting.types.js'
import type { SalesInvoiceCogsPostingContext } from './sales-invoice-cogs.service.js'

export interface BuildSalesInvoicePostingRequestInput {
  invoice: SalesInvoiceWithLines
  receivableAccountId: string
  calculationContext?: SalesInvoiceCalculationContext | null
  /** Optional Wave 3 COGS pair — appended after revenue lines; self-balancing. */
  cogs?: SalesInvoiceCogsPostingContext | null
}

function creditLine(
  lineNumber: number,
  amount: string,
  opts: {
    accountId?: string
    accountMappingKey?: DefaultAccountMappingKey
    exchangeRate: string
    currencyCode: string
    costCentreId?: string | null
    referenceDocumentLineId?: string | null
    referenceDocumentId?: string | null
    lineNarration?: string | null
  },
): PostingRequestLine {
  const base = convertToBase(amount, opts.exchangeRate)
  return {
    lineNumber,
    accountId: opts.accountId,
    accountMappingKey: opts.accountMappingKey,
    debitAmount: '0.0000',
    creditAmount: formatForPersistence(amount),
    baseDebitAmount: '0.0000',
    baseCreditAmount: formatForPersistence(base),
    currencyCode: opts.currencyCode,
    exchangeRate: opts.exchangeRate,
    costCentreId: opts.costCentreId ?? null,
    referenceDocumentType: 'SALES_INVOICE_LINE',
    referenceDocumentId: opts.referenceDocumentId ?? null,
    referenceDocumentLineId: opts.referenceDocumentLineId ?? null,
    lineNarration: opts.lineNarration ?? null,
  }
}

function debitLine(
  lineNumber: number,
  amount: string,
  opts: {
    accountMappingKey: DefaultAccountMappingKey
    exchangeRate: string
    currencyCode: string
    lineNarration?: string | null
  },
): PostingRequestLine {
  const base = convertToBase(amount, opts.exchangeRate)
  return {
    lineNumber,
    accountMappingKey: opts.accountMappingKey,
    debitAmount: formatForPersistence(amount),
    creditAmount: '0.0000',
    baseDebitAmount: formatForPersistence(base),
    baseCreditAmount: '0.0000',
    currencyCode: opts.currencyCode,
    exchangeRate: opts.exchangeRate,
    lineNarration: opts.lineNarration ?? null,
  }
}

export function buildSalesInvoicePostingRequest(input: BuildSalesInvoicePostingRequestInput): PostingRequest {
  const { invoice, receivableAccountId, calculationContext, cogs } = input
  const invoiceId = invoice.id
  const exchangeRate = invoice.exchangeRate.toString()
  const currencyCode = invoice.currencyCode
  const postingDate = (invoice.postingDate ?? invoice.invoiceDate).toISOString().slice(0, 10)
  const documentDate = invoice.invoiceDate.toISOString().slice(0, 10)

  const lines: PostingRequestLine[] = []
  let lineNumber = 1

  const totalAmount = formatForPersistence(invoice.totalAmount)
  const baseTotal = formatForPersistence(invoice.baseTotalAmount)

  lines.push({
    lineNumber: lineNumber++,
    accountId: receivableAccountId,
    partyType: 'CUSTOMER',
    partyId: invoice.customerId,
    partyNameSnapshot: invoice.customerNameSnapshot,
    debitAmount: totalAmount,
    creditAmount: '0.0000',
    baseDebitAmount: baseTotal,
    baseCreditAmount: '0.0000',
    currencyCode,
    exchangeRate,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
    referenceDocumentType: 'SALES_INVOICE',
    referenceDocumentId: invoiceId,
    lineNarration: invoice.narration ?? `Sales invoice receivable`,
  })

  for (const line of invoice.lines) {
    if (isZero(line.taxableAmount)) continue
    lines.push(
      creditLine(lineNumber++, formatForPersistence(line.taxableAmount), {
        accountId: line.revenueAccountId ?? undefined,
        accountMappingKey: line.revenueAccountId ? undefined : 'SALES_REVENUE',
        exchangeRate,
        currencyCode,
        costCentreId: line.costCentreId,
        referenceDocumentLineId: line.id,
        referenceDocumentId: invoiceId,
        lineNarration: line.description ?? line.itemNameSnapshot ?? null,
      }),
    )
  }

  const taxCredits: Array<{ key: DefaultAccountMappingKey; amount: string }> = [
    { key: 'GST_OUTPUT_CGST', amount: formatForPersistence(invoice.cgstAmount) },
    { key: 'GST_OUTPUT_SGST', amount: formatForPersistence(invoice.sgstAmount) },
    { key: 'GST_OUTPUT_IGST', amount: formatForPersistence(invoice.igstAmount) },
    { key: 'GST_OUTPUT_CESS', amount: formatForPersistence(invoice.cessAmount) },
  ]
  for (const tax of taxCredits) {
    if (isZero(tax.amount)) continue
    lines.push(
      creditLine(lineNumber++, tax.amount, {
        accountMappingKey: tax.key,
        exchangeRate,
        currencyCode,
        lineNarration: `${tax.key} on sales invoice`,
      }),
    )
  }

  const freightAmount = formatForPersistence(invoice.freightAmount)
  if (!isZero(freightAmount)) {
    const freightAccountId = calculationContext?.freightRevenueAccountId ?? undefined
    lines.push(
      creditLine(lineNumber++, freightAmount, {
        accountId: freightAccountId,
        accountMappingKey: freightAccountId ? undefined : 'FREIGHT_OUTWARD',
        exchangeRate,
        currencyCode,
        lineNarration: 'Freight charges',
      }),
    )
  }

  const otherAmount = formatForPersistence(invoice.otherChargesAmount)
  if (!isZero(otherAmount)) {
    const otherAccountId = calculationContext?.otherCharges?.[0]?.accountId ?? undefined
    lines.push(
      creditLine(lineNumber++, otherAmount, {
        accountId: otherAccountId ?? undefined,
        accountMappingKey: otherAccountId ? undefined : 'SALES_REVENUE',
        exchangeRate,
        currencyCode,
        lineNarration: 'Other charges',
      }),
    )
  }

  const roundOff = formatForPersistence(invoice.roundOffAmount)
  if (!isZero(roundOff)) {
    if (isPositive(roundOff)) {
      lines.push(
        creditLine(lineNumber++, roundOff, {
          accountMappingKey: 'ROUNDING',
          exchangeRate,
          currencyCode,
          lineNarration: 'Rounding adjustment',
        }),
      )
    } else if (isNegative(roundOff)) {
      const absRound = formatForPersistence(toDecimal(roundOff).abs())
      lines.push(
        debitLine(lineNumber++, absRound, {
          accountMappingKey: 'ROUNDING',
          exchangeRate,
          currencyCode,
          lineNarration: 'Rounding adjustment',
        }),
      )
    }
  }

  if (cogs && !isZero(cogs.totalCogsAmount)) {
    const cogsAmount = formatForPersistence(cogs.totalCogsAmount)
    lines.push({
      lineNumber: lineNumber++,
      accountId: cogs.cogsAccountId,
      debitAmount: cogsAmount,
      creditAmount: '0.0000',
      baseDebitAmount: formatForPersistence(convertToBase(cogsAmount, exchangeRate)),
      baseCreditAmount: '0.0000',
      currencyCode,
      exchangeRate,
      referenceDocumentType: 'SALES_INVOICE',
      referenceDocumentId: invoiceId,
      lineNarration: 'Cost of goods sold on sales invoice',
    })
    lines.push(
      creditLine(lineNumber++, cogsAmount, {
        accountId: cogs.fgInventoryAccountId,
        exchangeRate,
        currencyCode,
        referenceDocumentId: invoiceId,
        lineNarration: 'Finished goods inventory relief on sales invoice',
      }),
    )
  }

  const totalDebit = sumDecimals(lines.map((l) => l.debitAmount))
  const totalCredit = sumDecimals(lines.map((l) => l.creditAmount))
  if (compare(totalDebit, totalCredit) !== 0) {
    throw new PostingError(
      'UNBALANCED',
      `Sales invoice posting request is unbalanced: debit=${totalDebit.toString()} credit=${totalCredit.toString()}`,
    )
  }

  const revenueTotal = sumDecimals(
    invoice.lines.map((l) => l.taxableAmount).filter((a) => !isZero(a)),
  )
  const expectedCredit = add(
    add(revenueTotal, invoice.cgstAmount),
    add(invoice.sgstAmount, add(invoice.igstAmount, add(invoice.cessAmount, add(invoice.freightAmount, add(invoice.otherChargesAmount, invoice.roundOffAmount))))),
  )
  if (compare(invoice.totalAmount, expectedCredit) !== 0) {
    throw new PostingError(
      'UNBALANCED',
      `Invoice total ${invoice.totalAmount.toString()} does not equal component sum ${expectedCredit.toString()}`,
    )
  }

  return {
    legalEntityId: invoice.legalEntityId,
    eventKey: buildSalesInvoicePostEventKey(invoiceId),
    eventType: 'SALES_INVOICE_POSTED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate,
    postingDate,
    branchId: invoice.branchId,
    referenceNumber: invoice.referenceNumber,
    narration: invoice.narration ?? `Sales invoice ${invoice.draftReference ?? invoiceId}`,
    currencyCode,
    exchangeRate,
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'SALES_INVOICE',
    sourceDocumentId: invoiceId,
    lines,
  }
}
