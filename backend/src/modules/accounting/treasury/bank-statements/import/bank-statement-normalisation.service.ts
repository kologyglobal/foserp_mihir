import { Prisma } from '@prisma/client'
import { add, formatForPersistence, isPositive, isZero, isNegative, roundAmount, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import { getCellValue, resolveColumnIndex, sheetToRawPayload } from './bank-statement-mapping.service.js'
import { maskCounterpartyAccount, normaliseDescription as securityNormaliseDescription } from './bank-statement-import-security.service.js'
import type {
  BankStatementMappingConfig,
  ImportIssueInput,
  NormalisedStatementHeader,
  NormalisedStatementLine,
  ParsedSheet,
} from '../bank-statement.types.js'

const DEFAULT_DEBIT = ['DR', 'D', 'DEBIT', 'WITHDRAWAL', 'OUT', 'PAYMENT']
const DEFAULT_CREDIT = ['CR', 'C', 'CREDIT', 'DEPOSIT', 'IN', 'RECEIPT']

function trim(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim()
}

export function parseConfiguredDecimal(
  raw: string,
  opts?: { decimalSeparator?: string; thousandsSeparator?: string | null },
): Prisma.Decimal | null {
  let s = trim(raw)
  if (!s) return null
  s = s.replace(/[₹$€£]/g, '').trim()
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1).trim()
  }
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1).trim()
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim()
  }

  const dec = opts?.decimalSeparator
  const thou = opts?.thousandsSeparator
  if (dec === ',') {
    s = s.replace(/\./g, '').replace(/\s/g, '').replace(',', '.')
  } else {
    // Default / Indian: remove commas and spaces, keep '.'
    s = s.replace(/,/g, '').replace(/\s/g, '')
    if (thou) s = s.split(thou).join('')
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  try {
    let d = toDecimal(s)
    if (negative) d = d.neg()
    return d
  } catch {
    return null
  }
}

export function parseConfiguredDate(raw: string, dateFormat = 'DD/MM/YYYY'): Date | null {
  const s = trim(raw)
  if (!s) return null

  if (dateFormat === 'EXCEL_SERIAL' || (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 80000 && dateFormat.includes('EXCEL'))) {
    const serial = Math.floor(Number(s))
    const utc = Date.UTC(1899, 11, 30) + serial * 86400000
    return new Date(utc)
  }

  const months: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  }

  let y: number | null = null
  let m: number | null = null
  let day: number | null = null

  if (dateFormat === 'YYYY-MM-DD') {
    const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (!m1) return null
    y = Number(m1[1]); m = Number(m1[2]); day = Number(m1[3])
  } else if (dateFormat === 'DD/MM/YYYY' || dateFormat === 'DD-MM-YYYY') {
    const sep = dateFormat.includes('/') ? '/' : '-'
    const m1 = new RegExp(`^(\\d{1,2})\\${sep}(\\d{1,2})\\${sep}(\\d{4})$`).exec(s)
    if (!m1) return null
    day = Number(m1[1]); m = Number(m1[2]); y = Number(m1[3])
  } else if (dateFormat === 'MM/DD/YYYY') {
    const m1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
    if (!m1) return null
    m = Number(m1[1]); day = Number(m1[2]); y = Number(m1[3])
  } else if (dateFormat === 'DD MMM YYYY') {
    const m1 = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(s)
    if (!m1) return null
    day = Number(m1[1])
    m = months[m1[2]!.toUpperCase()] ?? null
    y = Number(m1[3])
  } else {
    // try ISO first
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (iso) {
      y = Number(iso[1]); m = Number(iso[2]); day = Number(iso[3])
    } else {
      return null
    }
  }

  if (y == null || m == null || day == null) return null
  if (m < 1 || m > 12 || day < 1 || day > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, day))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== day) return null
  return dt
}

function resolveDirection(
  raw: string,
  mapping: BankStatementMappingConfig,
): 'CREDIT' | 'DEBIT' | null {
  const key = trim(raw).toUpperCase()
  if (!key) return null
  const debit = new Set((mapping.directionValues?.debit?.length ? mapping.directionValues.debit : DEFAULT_DEBIT).map((a) => a.toUpperCase()))
  const credit = new Set((mapping.directionValues?.credit?.length ? mapping.directionValues.credit : DEFAULT_CREDIT).map((a) => a.toUpperCase()))
  if (debit.has(key) && !credit.has(key)) return 'DEBIT'
  if (credit.has(key) && !debit.has(key)) return 'CREDIT'
  return null
}

function issue(
  partial: Omit<ImportIssueInput, 'severity' | 'category' | 'code' | 'message'> & {
    severity: ImportIssueInput['severity']
    category: ImportIssueInput['category']
    code: string
    message: string
  },
): ImportIssueInput {
  return partial
}

export function normaliseStatementRows(
  sheet: ParsedSheet,
  mapping: BankStatementMappingConfig,
): { lines: NormalisedStatementLine[]; issues: ImportIssueInput[] } {
  const issues: ImportIssueInput[] = []
  const lines: NormalisedStatementLine[] = []
  const dateFormat = mapping.dateFormat ?? 'DD/MM/YYYY'

  const idx = {
    transactionDate: resolveColumnIndex(mapping.columns.transactionDate, sheet.headers),
    valueDate: resolveColumnIndex(mapping.columns.valueDate, sheet.headers),
    description: resolveColumnIndex(mapping.columns.description, sheet.headers),
    referenceNumber: resolveColumnIndex(mapping.columns.referenceNumber, sheet.headers),
    debitAmount: resolveColumnIndex(mapping.columns.debitAmount, sheet.headers),
    creditAmount: resolveColumnIndex(mapping.columns.creditAmount, sheet.headers),
    signedAmount: resolveColumnIndex(mapping.columns.signedAmount, sheet.headers),
    amount: resolveColumnIndex(mapping.columns.amount, sheet.headers),
    direction: resolveColumnIndex(mapping.columns.direction, sheet.headers),
    runningBalance: resolveColumnIndex(mapping.columns.runningBalance, sheet.headers),
    counterpartyName: resolveColumnIndex(mapping.columns.counterpartyName, sheet.headers),
    counterpartyAccount: resolveColumnIndex(mapping.columns.counterpartyAccount, sheet.headers),
    utrReference: resolveColumnIndex(mapping.columns.utrReference, sheet.headers),
    chequeNumber: resolveColumnIndex(mapping.columns.chequeNumber, sheet.headers),
    transactionCode: resolveColumnIndex(mapping.columns.transactionCode, sheet.headers),
    externalLineId: resolveColumnIndex(mapping.columns.externalLineId, sheet.headers),
    externalTransactionId: resolveColumnIndex(mapping.columns.externalTransactionId, sheet.headers),
  }

  if (idx.transactionDate == null) {
    issues.push(issue({
      severity: 'BLOCKER',
      category: 'COLUMN_MAPPING',
      code: 'BANK_STATEMENT_MAPPING_REQUIRED_FIELD_MISSING',
      message: 'TRANSACTION_DATE mapping is required',
    }))
  }

  for (const row of sheet.rows) {
    const rowIssues: ImportIssueInput[] = []
    const txRaw = getCellValue(row, idx.transactionDate)
    const transactionDate = parseConfiguredDate(txRaw, dateFormat)
    if (!txRaw.trim()) {
      rowIssues.push(issue({
        rowNumber: row.rowNumber,
        severity: 'ERROR',
        category: 'DATE',
        code: 'BANK_STATEMENT_DATE_PARSE_FAILED',
        message: 'Transaction date is required',
        rawValue: txRaw,
      }))
    } else if (!transactionDate) {
      rowIssues.push(issue({
        rowNumber: row.rowNumber,
        severity: 'ERROR',
        category: 'DATE',
        code: 'BANK_STATEMENT_DATE_PARSE_FAILED',
        message: `Could not parse date “${txRaw}” with format ${dateFormat}`,
        rawValue: txRaw,
      }))
    }

    const vdRaw = getCellValue(row, idx.valueDate)
    const valueDate = vdRaw.trim() ? parseConfiguredDate(vdRaw, dateFormat) : null
    if (vdRaw.trim() && !valueDate) {
      rowIssues.push(issue({
        rowNumber: row.rowNumber,
        severity: 'WARNING',
        category: 'DATE',
        code: 'BANK_STATEMENT_DATE_PARSE_FAILED',
        message: `Could not parse value date “${vdRaw}”`,
        rawValue: vdRaw,
      }))
    }

    let direction: 'CREDIT' | 'DEBIT' | null = null
    let amount: Prisma.Decimal | null = null

    if (mapping.amountMode === 'DEBIT_CREDIT_COLUMNS') {
      const debitRaw = getCellValue(row, idx.debitAmount)
      const creditRaw = getCellValue(row, idx.creditAmount)
      const debit = debitRaw.trim() ? parseConfiguredDecimal(debitRaw) : null
      const credit = creditRaw.trim() ? parseConfiguredDecimal(creditRaw) : null
      const debitPos = debit && isPositive(debit) ? debit : null
      const creditPos = credit && isPositive(credit) ? credit : null
      const debitBlank = !debitRaw.trim() || (debit != null && isZero(debit))
      const creditBlank = !creditRaw.trim() || (credit != null && isZero(credit))
      if (debit && isNegative(debit)) {
        rowIssues.push(issue({ rowNumber: row.rowNumber, severity: 'ERROR', category: 'AMOUNT', code: 'BANK_STATEMENT_AMOUNT_PARSE_FAILED', message: 'Debit column must not be negative', rawValue: debitRaw }))
      }
      if (credit && isNegative(credit)) {
        rowIssues.push(issue({ rowNumber: row.rowNumber, severity: 'ERROR', category: 'AMOUNT', code: 'BANK_STATEMENT_AMOUNT_PARSE_FAILED', message: 'Credit column must not be negative', rawValue: creditRaw }))
      }
      if (debitPos && creditPos) {
        rowIssues.push(issue({ rowNumber: row.rowNumber, severity: 'ERROR', category: 'AMOUNT', code: 'BANK_STATEMENT_AMOUNT_PARSE_FAILED', message: 'Both debit and credit are populated' }))
      } else if (debitBlank && creditBlank) {
        rowIssues.push(issue({ rowNumber: row.rowNumber, severity: 'ERROR', category: 'AMOUNT', code: 'BANK_STATEMENT_AMOUNT_PARSE_FAILED', message: 'Both debit and credit are blank or zero' }))
      } else if (debitPos) {
        direction = 'DEBIT'
        amount = roundAmount(debitPos, 2)
      } else if (creditPos) {
        direction = 'CREDIT'
        amount = roundAmount(creditPos, 2)
      } else if ((debitRaw.trim() && debit == null) || (creditRaw.trim() && credit == null)) {
        rowIssues.push(issue({ rowNumber: row.rowNumber, severity: 'ERROR', category: 'AMOUNT', code: 'BANK_STATEMENT_AMOUNT_PARSE_FAILED', message: 'Amount could not be parsed', rawValue: debitRaw || creditRaw }))
      }
    } else if (mapping.amountMode === 'SIGNED_AMOUNT') {
      const signedRaw = getCellValue(row, idx.signedAmount ?? idx.amount)
      const signed = signedRaw.trim() ? parseConfiguredDecimal(signedRaw) : null
      if (signed == null || isZero(signed)) {
        rowIssues.push(issue({ rowNumber: row.rowNumber, severity: 'ERROR', category: 'AMOUNT', code: 'BANK_STATEMENT_AMOUNT_PARSE_FAILED', message: 'Signed amount is required', rawValue: signedRaw }))
      } else if (isPositive(signed)) {
        direction = 'CREDIT'
        amount = roundAmount(signed, 2)
      } else {
        direction = 'DEBIT'
        amount = roundAmount(signed.abs(), 2)
      }
    } else {
      const amtRaw = getCellValue(row, idx.amount)
      const dirRaw = getCellValue(row, idx.direction)
      const amt = amtRaw.trim() ? parseConfiguredDecimal(amtRaw) : null
      if (amt == null || !isPositive(amt)) {
        rowIssues.push(issue({ rowNumber: row.rowNumber, severity: 'ERROR', category: 'AMOUNT', code: 'BANK_STATEMENT_AMOUNT_PARSE_FAILED', message: 'Amount must be a positive value', rawValue: amtRaw }))
      } else {
        amount = roundAmount(amt, 2)
      }
      const d = resolveDirection(dirRaw, mapping)
      if (!d) {
        rowIssues.push(issue({ rowNumber: row.rowNumber, severity: 'ERROR', category: 'DIRECTION', code: 'BANK_STATEMENT_DIRECTION_PARSE_FAILED', message: `Unknown direction “${dirRaw}”`, rawValue: dirRaw }))
      } else {
        direction = d
      }
    }

    const description = trim(getCellValue(row, idx.description)) || null
    if (!description) {
      rowIssues.push(issue({ rowNumber: row.rowNumber, severity: 'ERROR', category: 'ROW', code: 'BANK_STATEMENT_MAPPING_REQUIRED_FIELD_MISSING', message: 'Description is required' }))
    }

    const rbRaw = getCellValue(row, idx.runningBalance)
    const runningBalance = rbRaw.trim() ? parseConfiguredDecimal(rbRaw) : null
    if (rbRaw.trim() && runningBalance == null) {
      rowIssues.push(issue({ rowNumber: row.rowNumber, severity: 'WARNING', category: 'BALANCE', code: 'BANK_STATEMENT_AMOUNT_PARSE_FAILED', message: 'Running balance could not be parsed', rawValue: rbRaw }))
    }

    issues.push(...rowIssues)

    if (!transactionDate || !direction || !amount || !description) {
      continue
    }

    lines.push({
      sourceRowNumber: row.rowNumber,
      transactionDate,
      valueDate,
      direction,
      amount: formatForPersistence(amount, 2),
      description,
      normalizedDescription: securityNormaliseDescription(description),
      referenceNumber: trim(getCellValue(row, idx.referenceNumber)) || null,
      utrReference: trim(getCellValue(row, idx.utrReference)) || null,
      chequeNumber: trim(getCellValue(row, idx.chequeNumber)) || null,
      transactionCode: trim(getCellValue(row, idx.transactionCode)) || null,
      counterpartyName: trim(getCellValue(row, idx.counterpartyName)) || null,
      counterpartyAccountMasked: maskCounterpartyAccount(getCellValue(row, idx.counterpartyAccount)),
      externalLineId: trim(getCellValue(row, idx.externalLineId)) || null,
      externalTransactionId: trim(getCellValue(row, idx.externalTransactionId)) || null,
      runningBalance: runningBalance != null ? formatForPersistence(runningBalance, 2) : null,
      rawPayload: sheetToRawPayload(sheet, row),
    })
  }

  return { lines, issues }
}

export function deriveStatementHeaderFromLines(
  lines: NormalisedStatementLine[],
  opts?: {
    statementReference?: string
    openingBalance?: string
    closingBalance?: string
    statementDate?: Date
    periodStartDate?: Date
    periodEndDate?: Date
  },
): NormalisedStatementHeader {
  let credit = toDecimal(0)
  let debit = toDecimal(0)
  for (const line of lines) {
    if (line.direction === 'CREDIT') credit = add(credit, line.amount)
    else debit = add(debit, line.amount)
  }
  const opening = toDecimal(opts?.openingBalance ?? '0')
  const expectedClosing = subtract(add(opening, credit), debit)
  const closing = opts?.closingBalance != null ? toDecimal(opts.closingBalance) : expectedClosing
  const dates = lines.map((l) => l.transactionDate.getTime())
  const minDate = dates.length ? new Date(Math.min(...dates)) : new Date()
  const maxDate = dates.length ? new Date(Math.max(...dates)) : new Date()

  return {
    statementReference: opts?.statementReference?.trim() || `STMT-${maxDate.toISOString().slice(0, 10)}`,
    statementDate: opts?.statementDate ?? maxDate,
    periodStartDate: opts?.periodStartDate ?? minDate,
    periodEndDate: opts?.periodEndDate ?? maxDate,
    openingBalance: formatForPersistence(opening, 2),
    closingBalance: formatForPersistence(closing, 2),
    totalCreditAmount: formatForPersistence(roundAmount(credit, 2), 2),
    totalDebitAmount: formatForPersistence(roundAmount(debit, 2), 2),
    balanceDifference: formatForPersistence(subtract(closing, expectedClosing), 2),
  }
}

export function applyHeaderOverrides(
  header: NormalisedStatementHeader,
  overrides?: Partial<{
    statementReference: string
    openingBalance: string | number
    closingBalance: string | number
    statementDate: string
    periodStartDate: string
    periodEndDate: string
  }> | null,
): NormalisedStatementHeader {
  if (!overrides) return header
  const next: NormalisedStatementHeader = { ...header }
  if (overrides.statementReference) next.statementReference = overrides.statementReference
  if (overrides.openingBalance != null) next.openingBalance = formatForPersistence(overrides.openingBalance, 2)
  if (overrides.closingBalance != null) next.closingBalance = formatForPersistence(overrides.closingBalance, 2)
  if (overrides.statementDate) next.statementDate = new Date(`${overrides.statementDate}T00:00:00.000Z`)
  if (overrides.periodStartDate) next.periodStartDate = new Date(`${overrides.periodStartDate}T00:00:00.000Z`)
  if (overrides.periodEndDate) next.periodEndDate = new Date(`${overrides.periodEndDate}T00:00:00.000Z`)

  const expected = subtract(add(next.openingBalance, next.totalCreditAmount), next.totalDebitAmount)
  next.balanceDifference = formatForPersistence(subtract(next.closingBalance, expected), 2)
  return next
}
