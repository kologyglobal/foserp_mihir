import path from 'node:path'
import type { BankStatementImportFormat } from '../bank-statement.types.js'
import { BankStatementFileTypeRejectedError } from '../../treasury.errors.js'

/**
 * Resolve AUTO_DETECT (or confirm explicit format) from extension + content sniff.
 * Does not support BANK_API / PDF.
 */
export function detectBankStatementFormat(
  buffer: Buffer,
  originalFileName: string,
  requested: BankStatementImportFormat,
): Exclude<BankStatementImportFormat, 'AUTO_DETECT' | 'OTHER' | 'MANUAL'> {
  if (requested !== 'AUTO_DETECT') {
    if (requested === 'CSV' || requested === 'XLSX' || requested === 'MT940' || requested === 'CAMT_053') {
      return requested
    }
    throw new BankStatementFileTypeRejectedError(`Unsupported import format: ${requested}`)
  }

  const ext = path.extname(originalFileName).toLowerCase()
  const textHead = buffer.subarray(0, Math.min(buffer.length, 8192)).toString('utf8')

  if (ext === '.xlsx' || looksLikeXlsx(buffer)) return 'XLSX'
  if (ext === '.xml' || looksLikeCamt053(textHead)) return 'CAMT_053'
  if (ext === '.sta' || ext === '.mt940' || looksLikeMt940(textHead)) return 'MT940'
  if (ext === '.csv') return 'CSV'
  if (ext === '.txt') {
    if (looksLikeMt940(textHead)) return 'MT940'
    if (looksLikeCamt053(textHead)) return 'CAMT_053'
    return 'CSV'
  }

  if (looksLikeCamt053(textHead)) return 'CAMT_053'
  if (looksLikeMt940(textHead)) return 'MT940'
  if (looksLikeCsv(textHead)) return 'CSV'

  throw new BankStatementFileTypeRejectedError(
    'Could not auto-detect statement format — choose CSV, XLSX, MT940, or CAMT.053',
  )
}

export function looksLikeMt940(text: string): boolean {
  const sample = text.slice(0, 4000)
  return /:20:/.test(sample) && (/:61:/.test(sample) || /:60[FM]:/.test(sample))
}

export function looksLikeCamt053(text: string): boolean {
  const sample = text.slice(0, 8000)
  if (!/<[?]xml|<\w|Document/i.test(sample)) return false
  return /camt\.053/i.test(sample) || /BkToCstmrStmt/i.test(sample) || /<Stmt[\s>]/i.test(sample)
}

function looksLikeXlsx(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
}

function looksLikeCsv(text: string): boolean {
  const first = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? ''
  return first.includes(',') || first.includes(';') || first.includes('\t')
}
