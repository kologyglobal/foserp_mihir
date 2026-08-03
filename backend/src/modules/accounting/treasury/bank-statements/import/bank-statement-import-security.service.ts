import path from 'node:path'
import {
  BankStatementColumnLimitExceededError,
  BankStatementFileSecurityRejectedError,
  BankStatementFileTooLargeError,
  BankStatementFileTypeRejectedError,
  BankStatementRowLimitExceededError,
} from '../../treasury.errors.js'
import type { BankStatementImportFormat } from '../bank-statement.types.js'
import {
  BANK_STATEMENT_MAX_COLUMNS,
  BANK_STATEMENT_MAX_FILE_BYTES,
  BANK_STATEMENT_MAX_ROWS,
} from './bank-statement-limits.js'
import { looksLikeCamtFamily, looksLikeMt940 } from './bank-statement-format-detect.service.js'
import { isCamtFamilyFormat } from './bank-statement-camt-common.js'

const BLOCKED_EXTENSIONS = new Set(['.xlsm', '.xlsb', '.xltm', '.zip', '.rar', '.7z'])
const ALLOWED_EXTENSIONS = new Set(['.csv', '.xlsx', '.txt', '.sta', '.mt940', '.xml'])

export type UploadImportFormat =
  | 'CSV'
  | 'XLSX'
  | 'MT940'
  | 'CAMT_053'
  | 'CAMT_052'
  | 'CAMT_054'
  | 'AUTO_DETECT'
  | 'MANUAL'

export function sanitiseFileName(originalName: string): string {
  const base = path.basename(originalName).replace(/[^\w.\-() ]+/g, '_').slice(0, 200)
  return base || 'statement-upload'
}

export function validateUploadBasics(
  buffer: Buffer,
  originalFileName: string,
  importFormat: UploadImportFormat,
): { ext: string; mimeType: string } {
  if (buffer.length > BANK_STATEMENT_MAX_FILE_BYTES) {
    throw new BankStatementFileTooLargeError()
  }

  const ext = path.extname(originalFileName).toLowerCase()
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new BankStatementFileSecurityRejectedError(`Blocked file extension: ${ext}`)
  }

  if (importFormat === 'CSV' && ext !== '.csv' && ext !== '.txt') {
    throw new BankStatementFileTypeRejectedError('CSV import requires a .csv or .txt file')
  }
  if (importFormat === 'XLSX' && ext !== '.xlsx') {
    throw new BankStatementFileTypeRejectedError('XLSX import requires a .xlsx file (not .xlsm)')
  }
  if (importFormat === 'MT940' && !['.sta', '.mt940', '.txt'].includes(ext)) {
    throw new BankStatementFileTypeRejectedError('MT940 import requires a .sta, .mt940, or .txt file')
  }
  if (isCamtFamilyFormat(importFormat) && ext !== '.xml') {
    throw new BankStatementFileTypeRejectedError(`${importFormat.replace('_', '.')} import requires an .xml file`)
  }
  if (importFormat === 'AUTO_DETECT') {
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BankStatementFileTypeRejectedError(`Unsupported file extension for auto-detect: ${ext}`)
    }
  } else if (!ALLOWED_EXTENSIONS.has(ext) && importFormat !== 'MANUAL') {
    throw new BankStatementFileTypeRejectedError(`Unsupported file extension: ${ext}`)
  }

  assertMagicBytes(buffer, importFormat, ext)

  return {
    ext,
    mimeType: mimeForFormat(importFormat, ext),
  }
}

function mimeForFormat(importFormat: UploadImportFormat, ext: string): string {
  if (importFormat === 'XLSX' || ext === '.xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  if (isCamtFamilyFormat(importFormat) || ext === '.xml') return 'application/xml'
  if (importFormat === 'MT940' || ext === '.sta' || ext === '.mt940') return 'application/octet-stream'
  return 'text/plain'
}

function assertMagicBytes(buffer: Buffer, importFormat: UploadImportFormat, ext: string): void {
  if (importFormat === 'XLSX' || ext === '.xlsx') {
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new BankStatementFileSecurityRejectedError('XLSX file signature mismatch')
    }
    const head = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1')
    if (/vbaProject|macrosheet|xl4macros/i.test(head)) {
      throw new BankStatementFileSecurityRejectedError('Macro-enabled workbook rejected')
    }
    return
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 2048))
  if (sample.includes(0)) {
    throw new BankStatementFileSecurityRejectedError('Binary content detected in text statement file')
  }

  const textHead = sample.toString('utf8')

  if (importFormat === 'MT940' || ext === '.sta' || ext === '.mt940') {
    if (!looksLikeMt940(textHead) && !/:20:/.test(textHead)) {
      throw new BankStatementFileSecurityRejectedError('File does not look like SWIFT MT940')
    }
    return
  }

  if (isCamtFamilyFormat(importFormat) || ext === '.xml') {
    if (/<!DOCTYPE/i.test(textHead) || /<!ENTITY/i.test(textHead)) {
      throw new BankStatementFileSecurityRejectedError('CAMT XML with DTD/ENTITY declarations is not allowed')
    }
    if (!looksLikeCamtFamily(buffer.toString('utf8').slice(0, 12_000)) && !/<Document[\s>]/i.test(textHead)) {
      throw new BankStatementFileSecurityRejectedError('File does not look like CAMT.052 / CAMT.053 / CAMT.054 XML')
    }
    return
  }

  if (importFormat === 'AUTO_DETECT') {
    if (ext === '.xml' && (/<!DOCTYPE/i.test(textHead) || /<!ENTITY/i.test(textHead))) {
      throw new BankStatementFileSecurityRejectedError('XML with DTD/ENTITY declarations is not allowed')
    }
  }
}

export function assertRowColumnLimits(rowCount: number, columnCount: number): void {
  if (rowCount > BANK_STATEMENT_MAX_ROWS) throw new BankStatementRowLimitExceededError()
  if (columnCount > BANK_STATEMENT_MAX_COLUMNS) throw new BankStatementColumnLimitExceededError()
}

/** Mask counterparty account to last 4 digits only. */
export function maskCounterpartyAccount(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 0) return null
  const last4 = digits.slice(-4)
  return `****${last4}`
}

export function normaliseDescription(value: string | null | undefined): string | null {
  if (!value) return null
  return value.trim().replace(/\s+/g, ' ').slice(0, 500)
}

export function formatNeedsColumnMapping(format: BankStatementImportFormat): boolean {
  return format === 'CSV' || format === 'XLSX'
}
