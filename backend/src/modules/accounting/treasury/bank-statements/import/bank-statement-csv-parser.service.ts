import { parse } from 'csv-parse/sync'
import type { BankStatementParsingConfig, ParsedRawRow, ParsedSheet } from '../bank-statement.types.js'
import { assertRowColumnLimits } from './bank-statement-import-security.service.js'
import { BANK_STATEMENT_MAX_PREVIEW_ROWS } from './bank-statement-limits.js'

const DELIMITERS = [',', ';', '\t', '|'] as const

function decodeBuffer(buffer: Buffer, encoding?: string): string {
  if (encoding === 'windows-1252') {
    return buffer.toString('latin1')
  }
  let text = buffer.toString('utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  return text
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? ''
  let best = ','
  let bestCount = 0
  for (const d of DELIMITERS) {
    const count = firstLine.split(d).length
    if (count > bestCount) {
      bestCount = count
      best = d
    }
  }
  return best
}

export function parseCsvBuffer(
  buffer: Buffer,
  parsingConfig?: BankStatementParsingConfig,
  previewOnly = false,
): ParsedSheet {
  const text = decodeBuffer(buffer, parsingConfig?.encoding)
  const delimiter = parsingConfig?.delimiter ?? detectDelimiter(text)
  const records = parse(text, {
    delimiter,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as string[][]

  if (records.length === 0) {
    return { headers: [], rows: [], headerRowNumber: 1, dataStartRowNumber: 2 }
  }

  const headerRowNumber = parsingConfig?.headerRowNumber ?? 1
  const dataStartRowNumber = parsingConfig?.dataStartRowNumber ?? headerRowNumber + 1
  const headerIndex = Math.max(0, headerRowNumber - 1)
  const headers = (records[headerIndex] ?? []).map((h) => String(h ?? '').trim())
  const maxCols = Math.max(headers.length, ...records.map((r) => r.length))
  assertRowColumnLimits(records.length, maxCols)

  const dataRecords = previewOnly
    ? records.slice(dataStartRowNumber - 1, dataStartRowNumber - 1 + BANK_STATEMENT_MAX_PREVIEW_ROWS)
    : records.slice(dataStartRowNumber - 1)

  const rows: ParsedRawRow[] = dataRecords.map((cells, idx) => ({
    rowNumber: dataStartRowNumber + idx,
    cells: cells.map((c) => String(c ?? '').trim()),
  }))

  return { headers, rows, headerRowNumber, dataStartRowNumber }
}

export function inspectCsvBuffer(buffer: Buffer, parsingConfig?: BankStatementParsingConfig) {
  const text = decodeBuffer(buffer, parsingConfig?.encoding)
  const delimiter = parsingConfig?.delimiter ?? detectDelimiter(text)
  const sheet = parseCsvBuffer(buffer, { ...parsingConfig, delimiter }, true)
  return {
    detectedDelimiter: delimiter,
    detectedEncoding: parsingConfig?.encoding ?? 'utf-8',
    headers: sheet.headers,
    sampleRows: sheet.rows.slice(0, 10).map((r) => r.cells),
    headerRowNumber: sheet.headerRowNumber,
    dataStartRowNumber: sheet.dataStartRowNumber,
  }
}
