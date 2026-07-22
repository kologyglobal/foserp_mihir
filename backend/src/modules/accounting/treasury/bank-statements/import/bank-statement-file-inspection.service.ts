import type { BankStatementImportFormat, BankStatementParsingConfig } from '../bank-statement.types.js'
import { inspectCsvBuffer, parseCsvBuffer } from './bank-statement-csv-parser.service.js'
import { inspectXlsxBuffer, parseXlsxBuffer } from './bank-statement-xlsx-parser.service.js'
import { isStructuredImportFormat } from './bank-statement-native.types.js'
import { parseStructuredStatementFile } from './bank-statement-structured-parse.service.js'

export async function inspectStatementFile(
  buffer: Buffer,
  importFormat: BankStatementImportFormat,
  parsingConfig?: BankStatementParsingConfig,
) {
  if (importFormat === 'CSV') return inspectCsvBuffer(buffer, parsingConfig)
  if (importFormat === 'XLSX') return inspectXlsxBuffer(buffer, parsingConfig)
  if (isStructuredImportFormat(importFormat)) {
    const parsed = parseStructuredStatementFile(buffer, importFormat)
    return {
      headers: [] as string[],
      sampleRows: parsed.lines.slice(0, 5).map((l) => [
        l.transactionDate.toISOString().slice(0, 10),
        l.direction,
        l.amount,
        l.description ?? '',
        l.referenceNumber ?? '',
      ]),
      nativeFormat: importFormat,
      statementReference: parsed.header.statementReference,
      lineCount: parsed.lines.length,
      openingBalance: parsed.header.openingBalance,
      closingBalance: parsed.header.closingBalance,
      requiresColumnMapping: false,
    }
  }
  return { headers: [], sampleRows: [] as string[][], requiresColumnMapping: true }
}

export async function parseStatementFile(
  buffer: Buffer,
  importFormat: BankStatementImportFormat,
  parsingConfig?: BankStatementParsingConfig,
  previewOnly = false,
) {
  if (importFormat === 'CSV') {
    return { sheet: parseCsvBuffer(buffer, parsingConfig, previewOnly), formulaWarnings: [] as Array<{ rowNumber: number; columnName: string }> }
  }
  if (importFormat === 'XLSX') {
    return parseXlsxBuffer(buffer, parsingConfig, previewOnly)
  }
  return {
    sheet: { headers: [], rows: [], headerRowNumber: 1, dataStartRowNumber: 2 },
    formulaWarnings: [] as Array<{ rowNumber: number; columnName: string }>,
  }
}
