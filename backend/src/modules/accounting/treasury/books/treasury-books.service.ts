import { prisma } from '../../../../config/database.js'
import { add, subtract, formatForPersistence } from '../../shared/finance-decimal.js'
import type { BookQuery } from './treasury-books.schemas.js'
import { TreasuryBookAccountNotFoundError, TreasuryBookAccountTypeMismatchError } from './treasury-books.errors.js'

export interface BookEntryRow {
  entryId: string
  postingDate: string
  documentDate: string
  voucherNumber: string
  voucherType: string
  sourceModule: string | null
  sourceDocumentType: string | null
  sourceDocumentId: string | null
  narration: string | null
  debitAmount: string
  creditAmount: string
  runningBalance: string
}

export interface BookResult {
  treasuryAccountId: string
  treasuryAccountCode: string
  treasuryAccountName: string
  glAccountId: string
  currencyCode: string
  dateFrom: string | null
  dateTo: string | null
  openingBalance: string
  closingBalance: string
  entries: BookEntryRow[]
  total: number
  page: number
  limit: number
}

async function loadTreasuryAccount(tenantId: string, legalEntityId: string, treasuryAccountId: string, expectedType: 'BANK' | 'CASH') {
  const account = await prisma.treasuryAccount.findFirst({
    where: { id: treasuryAccountId, tenantId, legalEntityId },
  })
  if (!account) throw new TreasuryBookAccountNotFoundError()
  if (account.accountType !== expectedType) throw new TreasuryBookAccountTypeMismatchError(expectedType)
  return account
}

async function computeOpeningBalance(tenantId: string, legalEntityId: string, glAccountId: string, dateFrom?: string): Promise<string> {
  if (!dateFrom) return '0.0000'
  const prior = await prisma.generalLedgerEntry.aggregate({
    where: {
      tenantId,
      legalEntityId,
      accountId: glAccountId,
      postingDate: { lt: new Date(dateFrom) },
    },
    _sum: { debitAmount: true, creditAmount: true },
  })
  const debit = prior._sum.debitAmount ?? 0
  const credit = prior._sum.creditAmount ?? 0
  return formatForPersistence(subtract(debit, credit))
}

async function loadBook(
  tenantId: string,
  query: BookQuery,
  expectedType: 'BANK' | 'CASH',
): Promise<BookResult> {
  const { legalEntityId, treasuryAccountId, dateFrom, dateTo, page = 1, limit = 50 } = query
  const account = await loadTreasuryAccount(tenantId, legalEntityId, treasuryAccountId, expectedType)

  const where = {
    tenantId,
    legalEntityId,
    accountId: account.glAccountId,
    ...(dateFrom || dateTo
      ? {
          postingDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  }

  const openingBalance = await computeOpeningBalance(tenantId, legalEntityId, account.glAccountId, dateFrom)

  const allEntries = await prisma.generalLedgerEntry.findMany({
    where,
    orderBy: [{ postingDate: 'asc' }, { voucherNumber: 'asc' }, { lineNumber: 'asc' }],
  })

  let running = openingBalance
  const rows: BookEntryRow[] = allEntries.map((e) => {
    running = formatForPersistence(add(running, subtract(e.debitAmount, e.creditAmount)))
    return {
      entryId: e.id,
      postingDate: e.postingDate.toISOString().slice(0, 10),
      documentDate: e.documentDate.toISOString().slice(0, 10),
      voucherNumber: e.voucherNumber,
      voucherType: e.voucherType,
      sourceModule: e.sourceModule ?? null,
      sourceDocumentType: e.sourceDocumentType ?? null,
      sourceDocumentId: e.sourceDocumentId ?? null,
      narration: null,
      debitAmount: formatForPersistence(e.debitAmount),
      creditAmount: formatForPersistence(e.creditAmount),
      runningBalance: running,
    }
  })

  const closingBalance = rows.length > 0 ? rows[rows.length - 1].runningBalance : openingBalance
  const total = rows.length
  const start = (page - 1) * limit
  const pageRows = rows.slice(start, start + limit)

  return {
    treasuryAccountId: account.id,
    treasuryAccountCode: account.code,
    treasuryAccountName: account.name,
    glAccountId: account.glAccountId,
    currencyCode: account.currencyCode,
    dateFrom: dateFrom ?? null,
    dateTo: dateTo ?? null,
    openingBalance,
    closingBalance,
    entries: pageRows,
    total,
    page,
    limit,
  }
}

export async function getBankbook(tenantId: string, query: BookQuery): Promise<BookResult> {
  return loadBook(tenantId, query, 'BANK')
}

export async function getCashbook(tenantId: string, query: BookQuery): Promise<BookResult> {
  return loadBook(tenantId, query, 'CASH')
}

function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function bookToCsv(book: BookResult): string {
  const header = ['Posting Date', 'Voucher Number', 'Voucher Type', 'Source Module', 'Source Document Type', 'Debit', 'Credit', 'Running Balance']
  const lines = [
    `Account,${csvEscape(book.treasuryAccountCode)} - ${csvEscape(book.treasuryAccountName)}`,
    `Opening Balance,${book.openingBalance}`,
    '',
    header.join(','),
    ...book.entries.map((e) =>
      [e.postingDate, e.voucherNumber, e.voucherType, e.sourceModule ?? '', e.sourceDocumentType ?? '', e.debitAmount, e.creditAmount, e.runningBalance]
        .map(csvEscape)
        .join(','),
    ),
    '',
    `Closing Balance,${book.closingBalance}`,
  ]
  return lines.join('\n')
}

export async function getBankbookCsv(tenantId: string, query: BookQuery): Promise<string> {
  const book = await getBankbook(tenantId, { ...query, page: 1, limit: 100000 })
  return bookToCsv(book)
}

export async function getCashbookCsv(tenantId: string, query: BookQuery): Promise<string> {
  const book = await getCashbook(tenantId, { ...query, page: 1, limit: 100000 })
  return bookToCsv(book)
}
