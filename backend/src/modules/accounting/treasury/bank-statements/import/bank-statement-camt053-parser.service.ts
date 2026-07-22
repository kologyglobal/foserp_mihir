import { add, formatForPersistence, roundAmount, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import {
  BankStatementFileSecurityRejectedError,
  BankStatementFileTypeRejectedError,
} from '../../treasury.errors.js'
import { maskCounterpartyAccount, normaliseDescription } from './bank-statement-import-security.service.js'
import { BANK_STATEMENT_MAX_ROWS } from './bank-statement-limits.js'
import type { NativeStatementParseResult } from './bank-statement-native.types.js'
import type { ImportIssueInput, NormalisedStatementLine } from '../bank-statement.types.js'

const MAX_XML_ENTITY_EXPANSIONS = 0
const MAX_NESTING_DEPTH = 64

/**
 * ISO 20022 CAMT.053 (BankToCustomerStatement) → normalised header + lines.
 * Uses a lightweight tag extractor with XXE / entity-expansion guards (no external XML lib).
 */
export function parseCamt053Buffer(buffer: Buffer): NativeStatementParseResult {
  if (buffer.includes(0)) {
    throw new BankStatementFileSecurityRejectedError('Binary content detected in CAMT.053 file')
  }

  const xml = buffer.toString('utf8')
  assertSafeCamtXml(xml)

  const issues: ImportIssueInput[] = []
  const stmtInner = extractFirstElementInner(xml, 'Stmt')
  if (!stmtInner) {
    throw new BankStatementFileTypeRejectedError('CAMT.053 XML is missing Stmt element')
  }

  const statementId = textOf(stmtInner, 'Id') || textOf(xml, 'MsgId') || ''
  const creDt = parseIsoDate(textOf(stmtInner, 'CreDtTm') || textOf(xml, 'CreDtTm'))
  const frDt = parseIsoDate(textOf(stmtInner, 'FrDtTm') || nestedText(stmtInner, 'FrToDt', 'FrDtTm'))
  const toDt = parseIsoDate(textOf(stmtInner, 'ToDtTm') || nestedText(stmtInner, 'FrToDt', 'ToDtTm'))

  const openingBal = findBalanceAmount(stmtInner, ['OPBD', 'PRCD', 'ITBD'])
  const closingBal = findBalanceAmount(stmtInner, ['CLBD', 'CLAV', 'FWAV'])

  const entryBlocks = extractAllElementInners(stmtInner, 'Ntry')
  if (entryBlocks.length > BANK_STATEMENT_MAX_ROWS) {
    issues.push({
      severity: 'BLOCKER',
      category: 'FILE',
      code: 'BANK_STATEMENT_ROW_LIMIT_EXCEEDED',
      message: `CAMT.053 exceeds maximum of ${BANK_STATEMENT_MAX_ROWS} entries`,
    })
  }

  const lines: NormalisedStatementLine[] = []
  let sourceRowNumber = 0

  for (const ntry of entryBlocks.slice(0, BANK_STATEMENT_MAX_ROWS)) {
    sourceRowNumber += 1
    const amtRaw = attributeOrText(ntry, 'Amt')
    const amount = parseDecimalLoose(amtRaw)
    const ind = (textOf(ntry, 'CdtDbtInd') || '').toUpperCase()
    const direction = ind === 'CRDT' || ind === 'CREDIT' ? 'CREDIT' : ind === 'DBIT' || ind === 'DEBIT' ? 'DEBIT' : null
    const bookDt = parseIsoDate(nestedText(ntry, 'BookgDt', 'Dt') || nestedText(ntry, 'BookgDt', 'DtTm') || textOf(ntry, 'BookgDt'))
    const valDt = parseIsoDate(nestedText(ntry, 'ValDt', 'Dt') || nestedText(ntry, 'ValDt', 'DtTm') || textOf(ntry, 'ValDt'))

    const acctSvcrRef = textOf(ntry, 'AcctSvcrRef')
    const endToEnd = textOf(ntry, 'EndToEndId')
    const instrId = textOf(ntry, 'InstrId')
    const txId = textOf(ntry, 'TxId')
    const chqNb = textOf(ntry, 'ChqNb')
    const ustrd = collectTexts(ntry, 'Ustrd').join(' ')
    const addtlNtry = textOf(ntry, 'AddtlNtryInf')
    const description =
      normaliseDescription(ustrd) ||
      normaliseDescription(addtlNtry) ||
      normaliseDescription(endToEnd) ||
      normaliseDescription(acctSvcrRef) ||
      'CAMT.053 entry'

    if (amount == null || !direction || !bookDt || !description) {
      issues.push({
        rowNumber: sourceRowNumber,
        severity: 'ERROR',
        category: 'ROW',
        code: 'BANK_STATEMENT_CAMT_ENTRY_PARSE_FAILED',
        message: 'Could not parse CAMT.053 Ntry (amount, direction, or booking date missing)',
        rawValue: ntry.slice(0, 200),
      })
      continue
    }

    const counterparty =
      textOf(ntry, 'Nm') ||
      nestedText(ntry, 'RltdPties', 'Nm') ||
      null
    const counterpartyAcct =
      nestedText(ntry, 'DbtrAcct', 'Id') ||
      nestedText(ntry, 'CdtrAcct', 'Id') ||
      textOf(ntry, 'IBAN') ||
      null

    lines.push({
      sourceRowNumber,
      transactionDate: bookDt,
      valueDate: valDt,
      direction,
      amount: formatForPersistence(amount, 2),
      description,
      normalizedDescription: normaliseDescription(description),
      referenceNumber: endToEnd || instrId || acctSvcrRef || null,
      utrReference: endToEnd || null,
      chequeNumber: chqNb || null,
      transactionCode: textOf(ntry, 'BankTxCd') || textOf(ntry, 'Prtry') || null,
      counterpartyName: counterparty ? counterparty.slice(0, 200) : null,
      counterpartyAccountMasked: maskCounterpartyAccount(counterpartyAcct),
      externalLineId: acctSvcrRef || null,
      externalTransactionId: txId || acctSvcrRef || endToEnd || null,
      runningBalance: null,
      rawPayload: {
        ntrySnippet: ntry.slice(0, 500),
        cdtDbtInd: ind,
      },
    })
  }

  if (lines.length === 0 && !issues.some((i) => i.severity === 'BLOCKER')) {
    issues.push({
      severity: 'BLOCKER',
      category: 'FILE',
      code: 'BANK_STATEMENT_CAMT_NO_ENTRIES',
      message: 'CAMT.053 statement contains no Ntry elements',
    })
  }

  let credit = toDecimal(0)
  let debit = toDecimal(0)
  for (const line of lines) {
    if (line.direction === 'CREDIT') credit = add(credit, line.amount)
    else debit = add(debit, line.amount)
  }

  const opening = openingBal ?? toDecimal(0)
  const closing =
    closingBal ?? subtract(add(opening, credit), debit)
  const dates = lines.map((l) => l.transactionDate.getTime())
  const minDate = dates.length ? new Date(Math.min(...dates)) : frDt ?? creDt ?? new Date()
  const maxDate = dates.length ? new Date(Math.max(...dates)) : toDt ?? creDt ?? minDate
  const expectedClosing = subtract(add(opening, credit), debit)

  return {
    format: 'CAMT_053',
    header: {
      statementReference: (statementId || `CAMT-${maxDate.toISOString().slice(0, 10)}`).slice(0, 64),
      statementDate: toDt ?? creDt ?? maxDate,
      periodStartDate: frDt ?? minDate,
      periodEndDate: toDt ?? maxDate,
      openingBalance: formatForPersistence(opening, 2),
      closingBalance: formatForPersistence(closing, 2),
      totalCreditAmount: formatForPersistence(roundAmount(credit, 2), 2),
      totalDebitAmount: formatForPersistence(roundAmount(debit, 2), 2),
      balanceDifference: formatForPersistence(subtract(closing, expectedClosing), 2),
    },
    lines,
    issues,
  }
}

/** Reject XXE / DTD / entity expansion vectors before any parse. */
export function assertSafeCamtXml(xml: string): void {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml) || /SYSTEM\s+["']/i.test(xml)) {
    throw new BankStatementFileSecurityRejectedError('CAMT.053 XML with DTD/ENTITY declarations is not allowed')
  }
  if (/&(?!amp;|lt;|gt;|apos;|quot;|#\d+;|#x[0-9a-fA-F]+;)\w+;/.test(xml)) {
    throw new BankStatementFileSecurityRejectedError('CAMT.053 XML custom entity references are not allowed')
  }
  // Depth heuristic: runaway nesting
  let depth = 0
  let maxDepth = 0
  for (let i = 0; i < xml.length; i++) {
    if (xml[i] === '<' && xml[i + 1] !== '/' && xml[i + 1] !== '!' && xml[i + 1] !== '?') {
      depth += 1
      if (depth > maxDepth) maxDepth = depth
      if (depth > MAX_NESTING_DEPTH) {
        throw new BankStatementFileSecurityRejectedError('CAMT.053 XML nesting depth exceeds safety limit')
      }
    } else if (xml[i] === '<' && xml[i + 1] === '/') {
      depth = Math.max(0, depth - 1)
    }
  }
  void MAX_XML_ENTITY_EXPANSIONS
}

function extractFirstElementInner(xml: string, localName: string): string | null {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`, 'i')
  const m = re.exec(xml)
  return m ? m[1]! : null
}

function extractAllElementInners(xml: string, localName: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) != null) out.push(m[1]!)
  return out
}

function textOf(xml: string, localName: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([^<]*)<\\/(?:[\\w.-]+:)?${localName}>`, 'i')
  const m = re.exec(xml)
  return m ? decodeXmlText(m[1]!.trim()) : ''
}

function nestedText(xml: string, parent: string, child: string): string {
  const inner = extractFirstElementInner(xml, parent)
  return inner ? textOf(inner, child) : ''
}

function collectTexts(xml: string, localName: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([^<]*)<\\/(?:[\\w.-]+:)?${localName}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) != null) {
    const t = decodeXmlText(m[1]!.trim())
    if (t) out.push(t)
  }
  return out
}

function attributeOrText(xml: string, localName: string): string {
  const withAttr = new RegExp(
    `<(?:[\\w.-]+:)?${localName}\\b([^>]*)>([^<]*)<\\/(?:[\\w.-]+:)?${localName}>`,
    'i',
  ).exec(xml)
  if (withAttr) return decodeXmlText(withAttr[2]!.trim())
  // self-closing unlikely for Amt
  return textOf(xml, localName)
}

function findBalanceAmount(stmtInner: string, codes: string[]): ReturnType<typeof toDecimal> | null {
  const bals = extractAllElementInners(stmtInner, 'Bal')
  for (const code of codes) {
    for (const bal of bals) {
      const cd = textOf(bal, 'Cd') || nestedText(bal, 'Tp', 'Cd') || nestedText(bal, 'CdOrPrtry', 'Cd')
      if (cd.toUpperCase() !== code) continue
      const amt = parseDecimalLoose(attributeOrText(bal, 'Amt'))
      if (amt == null) continue
      const ind = (textOf(bal, 'CdtDbtInd') || '').toUpperCase()
      if (ind === 'DBIT' || ind === 'DEBIT') return amt.neg()
      return amt
    }
  }
  return null
}

function parseDecimalLoose(raw: string): ReturnType<typeof toDecimal> | null {
  const s = raw.trim().replace(/,/g, '')
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null
  try {
    return roundAmount(toDecimal(s), 2)
  } catch {
    return null
  }
}

function parseIsoDate(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const s = raw.trim()
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!day) return null
  const y = Number(day[1])
  const m = Number(day[2])
  const d = Number(day[3])
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return dt
}

function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
