import type { BankStatementImportFormat } from '../bank-statement.types.js'
import { parseCamt053Buffer } from './bank-statement-camt053-parser.service.js'
import { parseMt940Buffer } from './bank-statement-mt940-parser.service.js'
import type { NativeStatementParseResult } from './bank-statement-native.types.js'
import { isStructuredImportFormat } from './bank-statement-native.types.js'
import { BankStatementFileTypeRejectedError } from '../../treasury.errors.js'

export function parseStructuredStatementFile(
  buffer: Buffer,
  importFormat: BankStatementImportFormat,
): NativeStatementParseResult {
  if (importFormat === 'MT940') return parseMt940Buffer(buffer)
  if (importFormat === 'CAMT_053') return parseCamt053Buffer(buffer)
  throw new BankStatementFileTypeRejectedError(`Not a structured statement format: ${importFormat}`)
}

export { isStructuredImportFormat }
