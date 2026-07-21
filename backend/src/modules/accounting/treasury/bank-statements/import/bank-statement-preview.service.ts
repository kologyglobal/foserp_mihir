import type {
  ImportIssueInput,
  ImportPreviewResult,
  NormalisedStatementHeader,
  NormalisedStatementLine,
  PreviewRowResult,
} from '../bank-statement.types.js'
import { buildStatementLineHash } from '../bank-statement-identity.service.js'
import { isDuplicateLine } from '../bank-statement-duplicate.service.js'
import { deriveStatementHeaderFromLines, normaliseStatementRows } from './bank-statement-normalisation.service.js'
import type { ParsedSheet } from '../bank-statement.types.js'
import type { BankStatementMappingConfig } from '../bank-statement.types.js'

function severityRank(severity: ImportIssueInput['severity']): number {
  switch (severity) {
    case 'BLOCKER':
      return 4
    case 'ERROR':
      return 3
    case 'WARNING':
      return 2
    default:
      return 1
  }
}

export async function buildImportPreview(input: {
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  currencyCode: string
  sheet: ParsedSheet
  mapping: BankStatementMappingConfig
  formulaWarnings?: Array<{ rowNumber: number; columnName: string }>
  statementReference?: string
}): Promise<ImportPreviewResult> {
  const { lines, issues: parseIssues } = normaliseStatementRows(input.sheet, input.mapping)
  const issues: ImportIssueInput[] = [...parseIssues]

  for (const fw of input.formulaWarnings ?? []) {
    issues.push({
      rowNumber: fw.rowNumber,
      columnName: fw.columnName,
      severity: 'WARNING',
      category: 'ROW',
      code: 'BANK_STATEMENT_FORMULA_CELL',
      message: 'Formula cell — using cached value, not evaluating formula',
    })
  }

  return finalisePreviewRows({
    tenantId: input.tenantId,
    legalEntityId: input.legalEntityId,
    treasuryAccountId: input.treasuryAccountId,
    lines,
    issues,
    statementReference: input.statementReference,
  })
}

/** Preview path for MT940 / CAMT.053 (already normalised — no CSV column mapping). */
export async function buildNativeImportPreview(input: {
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  lines: NormalisedStatementLine[]
  header: NormalisedStatementHeader
  issues?: ImportIssueInput[]
  statementReference?: string
}): Promise<ImportPreviewResult> {
  const preview = await finalisePreviewRows({
    tenantId: input.tenantId,
    legalEntityId: input.legalEntityId,
    treasuryAccountId: input.treasuryAccountId,
    lines: input.lines,
    issues: [...(input.issues ?? [])],
    statementReference: input.statementReference ?? input.header.statementReference,
    preferHeader: input.header,
  })
  return preview
}

async function finalisePreviewRows(input: {
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  lines: NormalisedStatementLine[]
  issues: ImportIssueInput[]
  statementReference?: string
  preferHeader?: NormalisedStatementHeader
}): Promise<ImportPreviewResult> {
  const { lines, issues } = input
  const rows: PreviewRowResult[] = []
  let validRowCount = 0
  let warningRowCount = 0
  let errorRowCount = 0
  let duplicateRowCount = 0

  for (const line of lines) {
    const rowIssues = issues.filter((i) => i.rowNumber === line.sourceRowNumber)
    const lineHash = buildStatementLineHash({
      treasuryAccountId: input.treasuryAccountId,
      transactionDate: line.transactionDate,
      direction: line.direction,
      amount: line.amount,
      referenceNumber: line.referenceNumber,
      description: line.description,
      externalTransactionId: line.externalTransactionId,
    })
    const dup = await isDuplicateLine(input.tenantId, input.legalEntityId, lineHash)
    let status: PreviewRowResult['status'] = 'VALID'
    if (dup.isDuplicate) {
      status = 'DUPLICATE'
      duplicateRowCount += 1
      rowIssues.push({
        rowNumber: line.sourceRowNumber,
        severity: 'WARNING',
        category: 'DUPLICATE_LINE',
        code: 'BANK_STATEMENT_DUPLICATE_LINE',
        message: 'Duplicate line detected for this treasury account',
      })
    } else if (rowIssues.some((i) => i.severity === 'ERROR' || i.severity === 'BLOCKER')) {
      status = 'ERROR'
      errorRowCount += 1
    } else if (rowIssues.some((i) => i.severity === 'WARNING')) {
      status = 'WARNING'
      warningRowCount += 1
      validRowCount += 1
    } else {
      validRowCount += 1
    }

    rows.push({ ...line, status, issues: rowIssues })
  }

  const importableLines = rows.filter((r) => r.status === 'VALID' || r.status === 'WARNING')
  let header: NormalisedStatementHeader | null = null
  if (importableLines.length > 0) {
    if (input.preferHeader) {
      header = {
        ...input.preferHeader,
        statementReference:
          input.statementReference?.trim() || input.preferHeader.statementReference,
      }
    } else {
      header = deriveStatementHeaderFromLines(
        importableLines.map(({ status: _s, issues: _i, ...line }) => line),
        { statementReference: input.statementReference },
      )
    }
  }

  const hasBlockingErrors = issues.some((i) => i.severity === 'ERROR' || i.severity === 'BLOCKER')

  return {
    header,
    rows,
    totalRowCount: rows.length,
    validRowCount,
    warningRowCount,
    errorRowCount,
    duplicateRowCount,
    canImportStrict: !hasBlockingErrors && validRowCount > 0,
    issues: issues.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
  }
}

export function countIssueSeverities(issues: ImportIssueInput[]) {
  return {
    warningCount: issues.filter((i) => i.severity === 'WARNING').length,
    errorCount: issues.filter((i) => i.severity === 'ERROR' || i.severity === 'BLOCKER').length,
  }
}
