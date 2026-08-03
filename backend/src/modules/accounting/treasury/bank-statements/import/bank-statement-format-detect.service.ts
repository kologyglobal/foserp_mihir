import path from 'node:path'
import type { BankStatementImportFormat } from '../bank-statement.types.js'
import { BankStatementFileTypeRejectedError } from '../../treasury.errors.js'
import { detectCamtFamily, isCamtFamilyFormat } from './bank-statement-camt-common.js'

/**
 * Resolve AUTO_DETECT (or confirm explicit format) from extension + content sniff.
 * Does not support BANK_API / PDF.
 */
export function detectBankStatementFormat(
  buffer: Buffer,
  originalFileName: string,
  requested: BankStatementImportFormat,
): Exclude<BankStatementImportFormat, 'AUTO_DETECT' | 'OTHER' | 'MANUAL'> {
  const textHead = buffer.subarray(0, Math.min(buffer.length, 12_000)).toString('utf8')
  const detectedCamt = detectCamtFamily(textHead)

  if (requested !== 'AUTO_DETECT') {
    if (requested === 'CSV' || requested === 'XLSX' || requested === 'MT940') {
      return requested
    }
    if (isCamtFamilyFormat(requested)) {
      if (detectedCamt && detectedCamt !== requested) {
        throw new BankStatementFileTypeRejectedError(
          `Explicit format ${requested} does not match detected CAMT family ${detectedCamt}`,
        )
      }
      if (!detectedCamt && path.extname(originalFileName).toLowerCase() === '.xml') {
        throw new BankStatementFileTypeRejectedError(
          `Could not detect a known CAMT family for explicit format ${requested}`,
        )
      }
      return requested
    }
    throw new BankStatementFileTypeRejectedError(`Unsupported import format: ${requested}`)
  }

  const ext = path.extname(originalFileName).toLowerCase()

  if (ext === '.xlsx' || looksLikeXlsx(buffer)) return 'XLSX'
  if (ext === '.xml' || detectedCamt) {
    if (!detectedCamt) {
      throw new BankStatementFileTypeRejectedError(
        'XML statement is not a recognised CAMT.052 / CAMT.053 / CAMT.054 document',
      )
    }
    return detectedCamt
  }
  if (ext === '.sta' || ext === '.mt940' || looksLikeMt940(textHead)) return 'MT940'
  if (ext === '.csv') return 'CSV'
  if (ext === '.txt') {
    if (looksLikeMt940(textHead)) return 'MT940'
    if (detectedCamt) return detectedCamt
    return 'CSV'
  }

  if (detectedCamt) return detectedCamt
  if (looksLikeMt940(textHead)) return 'MT940'
  if (looksLikeCsv(textHead)) return 'CSV'

  throw new BankStatementFileTypeRejectedError(
    'Could not auto-detect statement format — choose CSV, XLSX, MT940, CAMT.053, CAMT.052, or CAMT.054',
  )
}

export function looksLikeMt940(text: string): boolean {
  const sample = text.slice(0, 4000)
  return /:20:/.test(sample) && (/:61:/.test(sample) || /:60[FM]:/.test(sample))
}

/** @deprecated Prefer detectCamtFamily — kept for security sniff callers. */
export function looksLikeCamt053(text: string): boolean {
  return detectCamtFamily(text) === 'CAMT_053'
}

export function looksLikeCamtFamily(text: string): boolean {
  return detectCamtFamily(text) != null
}

function looksLikeXlsx(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
}

function looksLikeCsv(text: string): boolean {
  const first = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? ''
  return first.includes(',') || first.includes(';') || first.includes('\t')
}
