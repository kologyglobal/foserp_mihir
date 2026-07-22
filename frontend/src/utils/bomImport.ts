export const BOM_IMPORT_REQUIRED_HEADERS = [
  'bom_code',
  'output_item_code',
  'output_quantity',
  'output_uom_code',
  'line_ref',
  'parent_line_ref',
  'component_item_code',
  'component_quantity',
  'component_uom_code',
  'sequence',
] as const

export interface ParsedBomCsv {
  rows: Record<string, string>[]
  errors: string[]
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const source = text.replace(/^\uFEFF/, '')

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (character === ',' && !quoted) {
      row.push(cell.trim())
      cell = ''
      continue
    }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell.trim())
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += character
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted value')
  row.push(cell.trim())
  if (row.some((value) => value !== '')) rows.push(row)
  return rows
}

export function parseBomImportCsv(text: string): ParsedBomCsv {
  let table: string[][]
  try {
    table = parseCsv(text)
  } catch (error) {
    return { rows: [], errors: [error instanceof Error ? error.message : 'Invalid CSV'] }
  }
  if (table.length < 2) return { rows: [], errors: ['CSV must contain a header and at least one data row'] }

  const headers = table[0].map(normalizeHeader)
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index)
  if (duplicateHeaders.length) {
    return { rows: [], errors: [`Duplicate CSV columns: ${[...new Set(duplicateHeaders)].join(', ')}`] }
  }
  const missing = BOM_IMPORT_REQUIRED_HEADERS.filter((header) => !headers.includes(header))
  if (missing.length) return { rows: [], errors: [`Missing required CSV columns: ${missing.join(', ')}`] }

  const rows = table.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])))
  const errors: string[] = []
  rows.forEach((row, index) => {
    const rowNo = index + 2
    for (const key of BOM_IMPORT_REQUIRED_HEADERS) {
      if (key === 'parent_line_ref') continue
      if (!row[key]?.trim()) errors.push(`Row ${rowNo}: ${key} is required`)
    }
  })
  return { rows, errors }
}
