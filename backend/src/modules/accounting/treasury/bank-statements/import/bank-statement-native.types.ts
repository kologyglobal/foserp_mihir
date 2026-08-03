import type {
  ImportIssueInput,
  NormalisedStatementHeader,
  NormalisedStatementLine,
} from '../bank-statement.types.js'

export type StructuredBankStatementFormat = 'MT940' | 'CAMT_053' | 'CAMT_052' | 'CAMT_054'

export interface NativeStatementParseResult {
  format: StructuredBankStatementFormat
  header: NormalisedStatementHeader
  lines: NormalisedStatementLine[]
  issues: ImportIssueInput[]
}

export function isStructuredImportFormat(
  format: string,
): format is StructuredBankStatementFormat {
  return (
    format === 'MT940' ||
    format === 'CAMT_053' ||
    format === 'CAMT_052' ||
    format === 'CAMT_054'
  )
}
