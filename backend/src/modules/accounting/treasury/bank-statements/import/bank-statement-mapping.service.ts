import type {
  BankStatementColumnRef,
  BankStatementMappingConfig,
  ParsedRawRow,
  ParsedSheet,
} from '../bank-statement.types.js'

export function resolveColumnIndex(ref: BankStatementColumnRef | undefined, headers: string[]): number | null {
  if (!ref) return null
  if (typeof ref.column === 'number') return ref.column
  const target = ref.column.trim().toLowerCase()
  const idx = headers.findIndex((h) => h.trim().toLowerCase() === target)
  return idx >= 0 ? idx : null
}

export function getCellValue(row: ParsedRawRow, index: number | null): string {
  if (index == null || index < 0) return ''
  return row.cells[index] ?? ''
}

export function mergeMappingConfig(
  templateConfig?: BankStatementMappingConfig | null,
  override?: BankStatementMappingConfig | null,
): BankStatementMappingConfig | null {
  if (!templateConfig && !override) return null
  if (!templateConfig) return override ?? null
  if (!override) return templateConfig
  return {
    ...templateConfig,
    ...override,
    columns: { ...templateConfig.columns, ...override.columns },
    header: { ...templateConfig.header, ...override.header },
    directionValues: { ...templateConfig.directionValues, ...override.directionValues },
  }
}

export function inferDefaultMapping(headers: string[]): BankStatementMappingConfig {
  const lower = headers.map((h) => h.trim().toLowerCase())
  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = lower.findIndex((h) => h.includes(c))
      if (idx >= 0) return { column: idx }
    }
    return undefined
  }

  const debitIdx = lower.findIndex((h) => h.includes('debit') || h === 'dr')
  const creditIdx = lower.findIndex((h) => h.includes('credit') || h === 'cr')
  const hasDebitCredit = debitIdx >= 0 && creditIdx >= 0

  return {
    amountMode: hasDebitCredit ? 'DEBIT_CREDIT_COLUMNS' : 'SIGNED_AMOUNT',
    columns: {
      transactionDate: find('date', 'txn date', 'transaction date'),
      valueDate: find('value date', 'val date'),
      description: find('description', 'narration', 'particulars'),
      referenceNumber: find('reference', 'ref', 'cheque', 'chq'),
      debitAmount: hasDebitCredit ? { column: debitIdx } : undefined,
      creditAmount: hasDebitCredit ? { column: creditIdx } : undefined,
      signedAmount: hasDebitCredit ? undefined : find('amount'),
      runningBalance: find('balance', 'running balance'),
      counterpartyName: find('counterparty', 'party', 'beneficiary'),
      counterpartyAccount: find('account', 'a/c'),
      utrReference: find('utr'),
      chequeNumber: find('cheque no', 'chq no'),
    },
    dateFormat: 'DD/MM/YYYY',
  }
}

export function sheetToRawPayload(sheet: ParsedSheet, row: ParsedRawRow): Record<string, unknown> {
  const payload: Record<string, unknown> = { rowNumber: row.rowNumber }
  sheet.headers.forEach((header, idx) => {
    if (header) payload[header] = row.cells[idx] ?? ''
  })
  return payload
}
