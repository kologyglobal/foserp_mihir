import { add, formatForPersistence, roundAmount, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import { BankStatementFileSecurityRejectedError } from '../../treasury.errors.js'
import { maskCounterpartyAccount, normaliseDescription } from './bank-statement-import-security.service.js'
import { BANK_STATEMENT_MAX_ROWS } from './bank-statement-limits.js'
import type { NativeStatementParseResult } from './bank-statement-native.types.js'
import type { ImportIssueInput, NormalisedStatementLine } from '../bank-statement.types.js'

/**
 * Minimal SWIFT MT940 parser → NormalisedStatementHeader + lines.
 * Supports common Indian-bank :20/:25/:28C/:60F/:61/:86/:62F blocks.
 */
export function parseMt940Buffer(buffer: Buffer): NativeStatementParseResult {
  if (buffer.includes(0)) {
    throw new BankStatementFileSecurityRejectedError('Binary content detected in MT940 file')
  }

  const text = buffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = splitMt940Tags(text)
  const issues: ImportIssueInput[] = []

  if (!blocks.some((b) => b.tag === '20')) {
    issues.push({
      severity: 'BLOCKER',
      category: 'FILE',
      code: 'BANK_STATEMENT_MT940_MISSING_20',
      message: 'MT940 file is missing required :20: transaction reference',
    })
  }

  const ref20 = firstTag(blocks, '20')?.value.trim() ?? ''
  const account25 = firstTag(blocks, '25')?.value.trim() ?? null
  const opening = parseBalanceTag(firstTag(blocks, '60F')?.value ?? firstTag(blocks, '60M')?.value)
  const closing = parseBalanceTag(firstTag(blocks, '62F')?.value ?? firstTag(blocks, '62M')?.value)

  const lines: NormalisedStatementLine[] = []
  let sourceRowNumber = 0

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    if (block.tag !== '61') continue
    sourceRowNumber += 1
    if (sourceRowNumber > BANK_STATEMENT_MAX_ROWS) {
      issues.push({
        severity: 'BLOCKER',
        category: 'FILE',
        code: 'BANK_STATEMENT_ROW_LIMIT_EXCEEDED',
        message: `MT940 exceeds maximum of ${BANK_STATEMENT_MAX_ROWS} entries`,
      })
      break
    }

    const info86 = blocks[i + 1]?.tag === '86' ? blocks[i + 1]!.value : ''
    const parsed = parseField61(block.value)
    if (!parsed) {
      issues.push({
        rowNumber: sourceRowNumber,
        severity: 'ERROR',
        category: 'ROW',
        code: 'BANK_STATEMENT_MT940_61_PARSE_FAILED',
        message: 'Could not parse MT940 :61: statement line',
        rawValue: block.value.slice(0, 200),
      })
      continue
    }

    const description =
      normaliseDescription(info86) ||
      normaliseDescription(parsed.customerReference) ||
      'MT940 entry'
    if (!description) {
      issues.push({
        rowNumber: sourceRowNumber,
        severity: 'ERROR',
        category: 'ROW',
        code: 'BANK_STATEMENT_MAPPING_REQUIRED_FIELD_MISSING',
        message: 'Description is required',
      })
      continue
    }

    lines.push({
      sourceRowNumber,
      transactionDate: parsed.transactionDate,
      valueDate: parsed.valueDate,
      direction: parsed.direction,
      amount: formatForPersistence(parsed.amount, 2),
      description,
      normalizedDescription: normaliseDescription(description),
      referenceNumber: parsed.customerReference || parsed.bankReference || null,
      utrReference: null,
      chequeNumber: parsed.chequeNumber,
      transactionCode: parsed.transactionCode,
      counterpartyName: null,
      counterpartyAccountMasked: maskCounterpartyAccount(account25),
      externalLineId: null,
      externalTransactionId: parsed.bankReference || parsed.customerReference || null,
      runningBalance: null,
      rawPayload: {
        tag61: block.value,
        tag86: info86 || null,
        accountIdentification: account25,
      },
    })
  }

  if (lines.length === 0 && !issues.some((i) => i.severity === 'BLOCKER' || i.severity === 'ERROR')) {
    issues.push({
      severity: 'BLOCKER',
      category: 'FILE',
      code: 'BANK_STATEMENT_MT940_NO_ENTRIES',
      message: 'MT940 file contains no :61: statement lines',
    })
  }

  let credit = toDecimal(0)
  let debit = toDecimal(0)
  for (const line of lines) {
    if (line.direction === 'CREDIT') credit = add(credit, line.amount)
    else debit = add(debit, line.amount)
  }

  const openingBal = opening?.amount ?? toDecimal(0)
  const closingBal =
    closing?.amount ??
    subtract(add(openingBal, credit), debit)
  const dates = lines.map((l) => l.transactionDate.getTime())
  const minDate = dates.length ? new Date(Math.min(...dates)) : opening?.date ?? new Date()
  const maxDate = dates.length ? new Date(Math.max(...dates)) : closing?.date ?? minDate
  const expectedClosing = subtract(add(openingBal, credit), debit)

  return {
    format: 'MT940',
    header: {
      statementReference: (ref20 || `MT940-${maxDate.toISOString().slice(0, 10)}`).slice(0, 64),
      statementDate: closing?.date ?? maxDate,
      periodStartDate: opening?.date ?? minDate,
      periodEndDate: closing?.date ?? maxDate,
      openingBalance: formatForPersistence(openingBal, 2),
      closingBalance: formatForPersistence(closingBal, 2),
      totalCreditAmount: formatForPersistence(roundAmount(credit, 2), 2),
      totalDebitAmount: formatForPersistence(roundAmount(debit, 2), 2),
      balanceDifference: formatForPersistence(subtract(closingBal, expectedClosing), 2),
    },
    lines,
    issues,
  }
}

function splitMt940Tags(text: string): Array<{ tag: string; value: string }> {
  const cleaned = text
    .replace(/^-{1,}\s*$/gm, '')
    .replace(/^\{1:.*$/gm, '')
    .replace(/^\{2:.*$/gm, '')
    .replace(/^\{3:.*$/gm, '')
    .replace(/^\{4:$/gm, '')
    .replace(/^-\}$/gm, '')

  const re = /:(\d{2}[A-Z]?):(.*?)(?=\n:\d{2}[A-Z]?:|\n-$|\n-$|$)/gs
  const out: Array<{ tag: string; value: string }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned)) != null) {
    out.push({ tag: m[1]!, value: m[2]!.replace(/\n/g, ' ').trim() })
  }
  return out
}

function firstTag(blocks: Array<{ tag: string; value: string }>, tag: string) {
  return blocks.find((b) => b.tag === tag)
}

function parseMt940Amount(raw: string): ReturnType<typeof toDecimal> | null {
  const s = raw.trim().replace(/\s/g, '')
  if (!s) return null
  // MT940 uses comma as decimal separator
  const normalised = s.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null
  try {
    return roundAmount(toDecimal(normalised), 2)
  } catch {
    return null
  }
}

function parseYyMmDd(raw: string): Date | null {
  if (!/^\d{6}$/.test(raw)) return null
  const yy = Number(raw.slice(0, 2))
  const mm = Number(raw.slice(2, 4))
  const dd = Number(raw.slice(4, 6))
  const year = yy >= 70 ? 1900 + yy : 2000 + yy
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const dt = new Date(Date.UTC(year, mm - 1, dd))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null
  return dt
}

function parseBalanceTag(value: string | undefined): { date: Date; amount: ReturnType<typeof toDecimal>; credit: boolean } | null {
  if (!value) return null
  // C/D + YYMMDD + currency(3) + amount
  const m = /^([CD])(\d{6})([A-Z]{3})([\d.,]+)$/i.exec(value.trim().replace(/\s/g, ''))
  if (!m) return null
  const date = parseYyMmDd(m[2]!)
  const amount = parseMt940Amount(m[4]!)
  if (!date || amount == null) return null
  const credit = m[1]!.toUpperCase() === 'C'
  return { date, amount: credit ? amount : amount.neg(), credit }
}

function parseField61(value: string): {
  transactionDate: Date
  valueDate: Date | null
  direction: 'CREDIT' | 'DEBIT'
  amount: ReturnType<typeof toDecimal>
  transactionCode: string | null
  customerReference: string | null
  bankReference: string | null
  chequeNumber: string | null
} | null {
  // YYMMDD[MMDD]C|D|RC|RD[fund]amountNxxx[reference]//[bankref]
  const m =
    /^(\d{6})(\d{4})?(R?[CD])([A-Z])?([\d.,]+)(N[A-Z0-9]{3})(.*)$/i.exec(value.trim().replace(/\s+/g, ''))
  if (!m) return null

  const transactionDate = parseYyMmDd(m[1]!)
  if (!transactionDate) return null

  let valueDate: Date | null = null
  if (m[2]) {
    const mm = Number(m[2].slice(0, 2))
    const dd = Number(m[2].slice(2, 4))
    const year = transactionDate.getUTCFullYear()
    valueDate = new Date(Date.UTC(year, mm - 1, dd))
  }

  const mark = m[3]!.toUpperCase()
  const direction: 'CREDIT' | 'DEBIT' = mark.endsWith('C') ? 'CREDIT' : 'DEBIT'
  const amount = parseMt940Amount(m[5]!)
  if (amount == null) return null

  const transactionCode = m[6] ? m[6].slice(1) : null
  const rest = m[7] ?? ''
  const [custPart, bankPart] = rest.split('//')
  const customerReference = custPart?.replace(/^NONREF$/i, '').trim() || null
  const bankReference = bankPart?.trim() || null
  const chequeNumber =
    transactionCode && /CHQ|CHK|CQ/i.test(transactionCode) && customerReference && /^\d+$/.test(customerReference)
      ? customerReference
      : null

  return {
    transactionDate,
    valueDate,
    direction,
    amount,
    transactionCode,
    customerReference,
    bankReference,
    chequeNumber,
  }
}
