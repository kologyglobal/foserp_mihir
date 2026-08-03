import { add, formatForPersistence, roundAmount, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import {
  BankStatementFileSecurityRejectedError,
  BankStatementFileTypeRejectedError,
} from '../../treasury.errors.js'
import { maskCounterpartyAccount, normaliseDescription } from './bank-statement-import-security.service.js'
import { BANK_STATEMENT_MAX_ROWS } from './bank-statement-limits.js'
import type { NativeStatementParseResult, StructuredBankStatementFormat } from './bank-statement-native.types.js'
import type { ImportIssueInput, NormalisedStatementLine } from '../bank-statement.types.js'

const MAX_XML_ENTITY_EXPANSIONS = 0
const MAX_NESTING_DEPTH = 64

export type CamtFamilyFormat = Extract<StructuredBankStatementFormat, 'CAMT_052' | 'CAMT_053' | 'CAMT_054'>

export type CamtDocumentType =
  | 'END_OF_DAY_STATEMENT'
  | 'INTRADAY_REPORT'
  | 'DEBIT_CREDIT_NOTIFICATION'

export interface CamtFamilySpec {
  format: CamtFamilyFormat
  documentType: CamtDocumentType
  /** ISO 20022 document root under Document, e.g. BkToCstmrStmt */
  rootLocalName: string
  /** Statement / report / notification container */
  containerLocalName: string
  label: string
  isProvisional: boolean
}

export const CAMT_FAMILY_SPECS: Record<CamtFamilyFormat, CamtFamilySpec> = {
  CAMT_053: {
    format: 'CAMT_053',
    documentType: 'END_OF_DAY_STATEMENT',
    rootLocalName: 'BkToCstmrStmt',
    containerLocalName: 'Stmt',
    label: 'CAMT.053',
    isProvisional: false,
  },
  CAMT_052: {
    format: 'CAMT_052',
    documentType: 'INTRADAY_REPORT',
    rootLocalName: 'BkToCstmrAcctRpt',
    containerLocalName: 'Rpt',
    label: 'CAMT.052',
    isProvisional: true,
  },
  CAMT_054: {
    format: 'CAMT_054',
    documentType: 'DEBIT_CREDIT_NOTIFICATION',
    rootLocalName: 'BkToCstmrDbtCdtNtfctn',
    containerLocalName: 'Ntfctn',
    label: 'CAMT.054',
    isProvisional: true,
  },
}

/** Detect CAMT family from XML head/body. Prefers namespace then message root. */
export function detectCamtFamily(xml: string): CamtFamilyFormat | null {
  const sample = xml.slice(0, 12_000)
  if (!/<[?]xml|<\w|Document/i.test(sample)) return null

  if (/camt\.054/i.test(sample) || /BkToCstmrDbtCdtNtfctn/i.test(sample)) return 'CAMT_054'
  if (/camt\.052/i.test(sample) || /BkToCstmrAcctRpt/i.test(sample)) return 'CAMT_052'
  if (/camt\.053/i.test(sample) || /BkToCstmrStmt/i.test(sample)) return 'CAMT_053'

  // Ambiguous bare <Stmt> only counts as 053 when no other CAMT root is present.
  if (/<(?:[\w.-]+:)?Stmt[\s>]/i.test(sample) && !/BkToCstmrAcctRpt|BkToCstmrDbtCdtNtfctn/i.test(sample)) {
    return 'CAMT_053'
  }
  return null
}

export function isCamtFamilyFormat(format: string): format is CamtFamilyFormat {
  return format === 'CAMT_052' || format === 'CAMT_053' || format === 'CAMT_054'
}

/** Reject XXE / DTD / entity expansion vectors before any parse. */
export function assertSafeCamtXml(xml: string, label = 'CAMT'): void {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml) || /SYSTEM\s+["']/i.test(xml)) {
    throw new BankStatementFileSecurityRejectedError(`${label} XML with DTD/ENTITY declarations is not allowed`)
  }
  if (/&(?!amp;|lt;|gt;|apos;|quot;|#\d+;|#x[0-9a-fA-F]+;)\w+;/.test(xml)) {
    throw new BankStatementFileSecurityRejectedError(`${label} XML custom entity references are not allowed`)
  }
  let depth = 0
  for (let i = 0; i < xml.length; i++) {
    if (xml[i] === '<' && xml[i + 1] !== '/' && xml[i + 1] !== '!' && xml[i + 1] !== '?') {
      depth += 1
      if (depth > MAX_NESTING_DEPTH) {
        throw new BankStatementFileSecurityRejectedError(`${label} XML nesting depth exceeds safety limit`)
      }
    } else if (xml[i] === '<' && xml[i + 1] === '/') {
      depth = Math.max(0, depth - 1)
    }
  }
  void MAX_XML_ENTITY_EXPANSIONS
}

export function extractFirstElementInner(xml: string, localName: string): string | null {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`, 'i')
  const m = re.exec(xml)
  return m ? m[1]! : null
}

export function extractAllElementInners(xml: string, localName: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) != null) out.push(m[1]!)
  return out
}

export function textOf(xml: string, localName: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([^<]*)<\\/(?:[\\w.-]+:)?${localName}>`, 'i')
  const m = re.exec(xml)
  return m ? decodeXmlText(m[1]!.trim()) : ''
}

export function nestedText(xml: string, parent: string, child: string): string {
  const inner = extractFirstElementInner(xml, parent)
  return inner ? textOf(inner, child) : ''
}

export function collectTexts(xml: string, localName: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([^<]*)<\\/(?:[\\w.-]+:)?${localName}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) != null) {
    const t = decodeXmlText(m[1]!.trim())
    if (t) out.push(t)
  }
  return out
}

export function attributeOrText(xml: string, localName: string): string {
  const withAttr = new RegExp(
    `<(?:[\\w.-]+:)?${localName}\\b([^>]*)>([^<]*)<\\/(?:[\\w.-]+:)?${localName}>`,
    'i',
  ).exec(xml)
  if (withAttr) return decodeXmlText(withAttr[2]!.trim())
  return textOf(xml, localName)
}

export function findBalanceAmount(stmtInner: string, codes: string[]): ReturnType<typeof toDecimal> | null {
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

export function parseDecimalLoose(raw: string): ReturnType<typeof toDecimal> | null {
  const s = raw.trim().replace(/,/g, '')
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null
  try {
    return roundAmount(toDecimal(s), 2)
  } catch {
    return null
  }
}

export function parseIsoDate(raw: string | null | undefined): Date | null {
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

export function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function extractAccountKey(containerInner: string): { accountId: string; currency: string } {
  const acct = extractFirstElementInner(containerInner, 'Acct') ?? ''
  const iban = nestedText(acct, 'Id', 'IBAN') || textOf(acct, 'IBAN')
  const othr = nestedText(acct, 'Othr', 'Id') || nestedText(acct, 'Id', 'Id')
  const accountId = (iban || othr || '').trim().toUpperCase()
  const currency = (textOf(acct, 'Ccy') || '').trim().toUpperCase()
  return { accountId, currency }
}

function parseNtryBlock(
  ntry: string,
  sourceRowNumber: number,
  label: string,
  issues: ImportIssueInput[],
): NormalisedStatementLine | null {
  const amtRaw = attributeOrText(ntry, 'Amt')
  const amount = parseDecimalLoose(amtRaw)
  const ind = (textOf(ntry, 'CdtDbtInd') || '').toUpperCase()
  const direction =
    ind === 'CRDT' || ind === 'CREDIT' ? 'CREDIT' : ind === 'DBIT' || ind === 'DEBIT' ? 'DEBIT' : null
  const bookDt = parseIsoDate(
    nestedText(ntry, 'BookgDt', 'Dt') || nestedText(ntry, 'BookgDt', 'DtTm') || textOf(ntry, 'BookgDt'),
  )
  const valDt = parseIsoDate(
    nestedText(ntry, 'ValDt', 'Dt') || nestedText(ntry, 'ValDt', 'DtTm') || textOf(ntry, 'ValDt'),
  )

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
    `${label} entry`

  if (amount == null || !direction || !bookDt || !description) {
    issues.push({
      rowNumber: sourceRowNumber,
      severity: 'ERROR',
      category: 'ROW',
      code: 'BANK_STATEMENT_CAMT_ENTRY_PARSE_FAILED',
      message: `Could not parse ${label} Ntry (amount, direction, or booking date missing)`,
      rawValue: ntry.slice(0, 200),
    })
    return null
  }

  const counterparty = textOf(ntry, 'Nm') || nestedText(ntry, 'RltdPties', 'Nm') || null
  const counterpartyAcct =
    nestedText(ntry, 'DbtrAcct', 'Id') || nestedText(ntry, 'CdtrAcct', 'Id') || textOf(ntry, 'IBAN') || null

  return {
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
  }
}

/**
 * Shared CAMT.052 / .053 / .054 parser.
 * Flattens multiple containers only when they share the same account id + currency.
 */
export function parseCamtFamilyBuffer(buffer: Buffer, format: CamtFamilyFormat): NativeStatementParseResult {
  const spec = CAMT_FAMILY_SPECS[format]
  if (buffer.includes(0)) {
    throw new BankStatementFileSecurityRejectedError(`Binary content detected in ${spec.label} file`)
  }

  const xml = buffer.toString('utf8')
  assertSafeCamtXml(xml, spec.label)

  const detected = detectCamtFamily(xml)
  if (detected && detected !== format) {
    throw new BankStatementFileTypeRejectedError(
      `Explicit format ${spec.label} does not match detected CAMT family ${detected.replace('_', '.')}`,
    )
  }
  if (!detected && !extractFirstElementInner(xml, spec.containerLocalName)) {
    throw new BankStatementFileTypeRejectedError(`${spec.label} XML root/container not recognised`)
  }

  const issues: ImportIssueInput[] = []
  const containers = extractAllElementInners(xml, spec.containerLocalName)
  if (containers.length === 0) {
    throw new BankStatementFileTypeRejectedError(
      `${spec.label} XML is missing ${spec.containerLocalName} element`,
    )
  }

  const accountKeys = containers.map(extractAccountKey)
  const firstKey = accountKeys[0]!
  const mixed = accountKeys.some(
    (k) =>
      (firstKey.accountId && k.accountId && k.accountId !== firstKey.accountId) ||
      (firstKey.currency && k.currency && k.currency !== firstKey.currency),
  )
  if (mixed) {
    issues.push({
      severity: 'BLOCKER',
      category: 'FILE',
      code: 'BANK_STATEMENT_CAMT_MULTI_ACCOUNT',
      message: `${spec.label} contains multiple account/currency containers — import one account at a time`,
    })
  }

  const msgId = textOf(xml, 'MsgId')
  const containerIds = containers.map((c) => textOf(c, 'Id')).filter(Boolean)
  const primaryContainer = containers[0]!
  const statementId = containerIds[0] || msgId || ''
  const externalStatementId = [msgId, statementId].filter(Boolean).join(':').slice(0, 128) || null

  const creDt = parseIsoDate(textOf(primaryContainer, 'CreDtTm') || textOf(xml, 'CreDtTm'))
  const frDt = parseIsoDate(
    textOf(primaryContainer, 'FrDtTm') || nestedText(primaryContainer, 'FrToDt', 'FrDtTm'),
  )
  const toDt = parseIsoDate(
    textOf(primaryContainer, 'ToDtTm') || nestedText(primaryContainer, 'FrToDt', 'ToDtTm'),
  )

  let openingBal: ReturnType<typeof toDecimal> | null = null
  let closingBal: ReturnType<typeof toDecimal> | null = null
  for (const container of containers) {
    const op = findBalanceAmount(container, ['OPBD', 'PRCD', 'ITBD'])
    const cl = findBalanceAmount(container, ['CLBD', 'CLAV', 'FWAV'])
    if (op != null && openingBal == null) openingBal = op
    if (cl != null) closingBal = cl
  }
  const hasOpeningBalance = openingBal != null
  const hasClosingBalance = closingBal != null

  const entryBlocks = containers.flatMap((c) => extractAllElementInners(c, 'Ntry'))
  if (entryBlocks.length > BANK_STATEMENT_MAX_ROWS) {
    issues.push({
      severity: 'BLOCKER',
      category: 'FILE',
      code: 'BANK_STATEMENT_ROW_LIMIT_EXCEEDED',
      message: `${spec.label} exceeds maximum of ${BANK_STATEMENT_MAX_ROWS} entries`,
    })
  }

  const lines: NormalisedStatementLine[] = []
  let sourceRowNumber = 0
  for (const ntry of entryBlocks.slice(0, BANK_STATEMENT_MAX_ROWS)) {
    sourceRowNumber += 1
    const line = parseNtryBlock(ntry, sourceRowNumber, spec.label, issues)
    if (!line) continue
    line.rawPayload = {
      ...(line.rawPayload ?? {}),
      messageId: msgId || null,
      containerId: statementId || null,
      documentType: spec.documentType,
      isProvisional: spec.isProvisional,
    }
    lines.push(line)
  }

  if (lines.length === 0 && !issues.some((i) => i.severity === 'BLOCKER')) {
    issues.push({
      severity: 'BLOCKER',
      category: 'FILE',
      code: 'BANK_STATEMENT_CAMT_NO_ENTRIES',
      message: `${spec.label} document contains no Ntry elements`,
    })
  }

  let credit = toDecimal(0)
  let debit = toDecimal(0)
  for (const line of lines) {
    if (line.direction === 'CREDIT') credit = add(credit, line.amount)
    else debit = add(debit, line.amount)
  }

  const opening = openingBal ?? toDecimal(0)
  const closing = closingBal ?? (hasOpeningBalance ? subtract(add(opening, credit), debit) : toDecimal(0))
  const dates = lines.map((l) => l.transactionDate.getTime())
  const minDate = dates.length ? new Date(Math.min(...dates)) : frDt ?? creDt ?? new Date()
  const maxDate = dates.length ? new Date(Math.max(...dates)) : toDt ?? creDt ?? minDate
  const expectedClosing = subtract(add(opening, credit), debit)
  const balanceDifference =
    hasOpeningBalance && hasClosingBalance
      ? formatForPersistence(subtract(closing, expectedClosing), 2)
      : formatForPersistence(toDecimal(0), 2)

  const refBase =
    statementId ||
    msgId ||
    `${spec.format.replace('_', '-')}-${maxDate.toISOString().slice(0, 10)}`

  return {
    format: spec.format,
    header: {
      statementReference: refBase.slice(0, 64),
      statementDate: toDt ?? creDt ?? maxDate,
      periodStartDate: frDt ?? minDate,
      periodEndDate: toDt ?? maxDate,
      openingBalance: formatForPersistence(opening, 2),
      closingBalance: formatForPersistence(closing, 2),
      totalCreditAmount: formatForPersistence(roundAmount(credit, 2), 2),
      totalDebitAmount: formatForPersistence(roundAmount(debit, 2), 2),
      balanceDifference,
      documentType: spec.documentType,
      hasOpeningBalance,
      hasClosingBalance,
      externalStatementId,
      accountCurrency: firstKey.currency || null,
      isProvisional: spec.isProvisional,
    },
    lines,
    issues,
  }
}
