import type { BankStatementMappingConfig } from '../api/bank-statement.types'

/** Map UI column selections to API mapping config. */
export function buildMappingConfig(
  amountMode: BankStatementMappingConfig['amountMode'],
  columnSelections: Record<string, string>,
  dateFormat?: string,
): BankStatementMappingConfig {
  const columns: BankStatementMappingConfig['columns'] = {}
  for (const [key, value] of Object.entries(columnSelections)) {
    if (value.trim()) columns[key] = { column: value.trim() }
  }
  return {
    amountMode,
    columns,
    ...(dateFormat ? { dateFormat } : {}),
  }
}

/** Extract column label/index from mapping for form defaults. */
export function flattenMappingConfig(config?: BankStatementMappingConfig | null): Record<string, string> {
  if (!config?.columns) return {}
  const out: Record<string, string> = {}
  for (const [key, ref] of Object.entries(config.columns)) {
    if (ref?.column != null) out[key] = String(ref.column)
  }
  return out
}
