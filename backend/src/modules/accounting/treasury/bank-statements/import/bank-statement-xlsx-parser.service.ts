import ExcelJS from 'exceljs'
import type { BankStatementParsingConfig, ParsedRawRow, ParsedSheet } from '../bank-statement.types.js'
import { BankStatementFileSecurityRejectedError } from '../../treasury.errors.js'
import { assertRowColumnLimits } from './bank-statement-import-security.service.js'
import { BANK_STATEMENT_MAX_PREVIEW_ROWS } from './bank-statement-limits.js'

function cellToString(cell: ExcelJS.Cell): { value: string; isFormula: boolean } {
  if (cell.type === ExcelJS.ValueType.Formula) {
    const result = cell.result
    return {
      value: result == null ? '' : String(result),
      isFormula: true,
    }
  }
  if (cell.value == null) return { value: '', isFormula: false }
  if (cell.value instanceof Date) return { value: cell.value.toISOString().slice(0, 10), isFormula: false }
  return { value: String(cell.value).trim(), isFormula: false }
}

export async function parseXlsxBuffer(
  buffer: Buffer,
  parsingConfig?: BankStatementParsingConfig,
  previewOnly = false,
): Promise<{ sheet: ParsedSheet; formulaWarnings: Array<{ rowNumber: number; columnName: string }> }> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  } catch {
    throw new BankStatementFileSecurityRejectedError('Unable to read XLSX workbook — file may be password-protected or corrupt')
  }

  if ((workbook as { encryption?: unknown }).encryption) {
    throw new BankStatementFileSecurityRejectedError('Password-protected workbook rejected')
  }

  const sheetName = parsingConfig?.sheetName ?? workbook.worksheets[0]?.name
  const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0]
  if (!worksheet) {
    return { sheet: { headers: [], rows: [], headerRowNumber: 1, dataStartRowNumber: 2, sheetName }, formulaWarnings: [] }
  }

  const headerRowNumber = parsingConfig?.headerRowNumber ?? 1
  const dataStartRowNumber = parsingConfig?.dataStartRowNumber ?? headerRowNumber + 1
  const headerRow = worksheet.getRow(headerRowNumber)
  const colCount = worksheet.columnCount || headerRow.cellCount
  assertRowColumnLimits(worksheet.rowCount, colCount)

  const headers: string[] = []
  for (let c = 1; c <= colCount; c += 1) {
    headers.push(cellToString(headerRow.getCell(c)).value)
  }

  const formulaWarnings: Array<{ rowNumber: number; columnName: string }> = []
  const maxRow = previewOnly
    ? Math.min(worksheet.rowCount, dataStartRowNumber - 1 + BANK_STATEMENT_MAX_PREVIEW_ROWS)
    : worksheet.rowCount

  const rows: ParsedRawRow[] = []
  for (let r = dataStartRowNumber; r <= maxRow; r += 1) {
    const row = worksheet.getRow(r)
    const cells: string[] = []
    for (let c = 1; c <= colCount; c += 1) {
      const parsed = cellToString(row.getCell(c))
      cells.push(parsed.value)
      if (parsed.isFormula) {
        formulaWarnings.push({ rowNumber: r, columnName: headers[c - 1] ?? `Column ${c}` })
      }
    }
    if (cells.some((v) => v.length > 0)) {
      rows.push({ rowNumber: r, cells })
    }
  }

  return {
    sheet: { sheetName: worksheet.name, headers, rows, headerRowNumber, dataStartRowNumber },
    formulaWarnings,
  }
}

export async function inspectXlsxBuffer(buffer: Buffer, parsingConfig?: BankStatementParsingConfig) {
  const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  const sheetNames = workbook.worksheets.map((w) => w.name)
  const { sheet } = await parseXlsxBuffer(buffer, parsingConfig, true)
  return {
    sheetNames,
    headers: sheet.headers,
    sampleRows: sheet.rows.slice(0, 10).map((r) => r.cells),
    headerRowNumber: sheet.headerRowNumber,
    dataStartRowNumber: sheet.dataStartRowNumber,
    sheetName: sheet.sheetName,
  }
}
