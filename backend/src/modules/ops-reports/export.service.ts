import { AuthorizationError } from '../../utils/errors.js'
import { findReportDefinition } from './registry.js'
import { executeReport } from './query.service.js'
import { ReportExportNotSupportedError, ReportNotFoundError } from './ops-reports.errors.js'
import type { ReportResult } from './types.js'

export const EXPORT_SYNC_ROW_LIMIT = 10000

function csvEscape(value: unknown): string {
  if (value == null) return ''
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function hasExportPermission(userPerms: string[], definition: { module: string }): boolean {
  if (userPerms.includes('tenant.manage')) return true
  if (userPerms.includes('manufacturing.reports.export')) return true
  if (definition.module === 'TRACEABILITY' && userPerms.includes('manufacturing.traceability.export')) return true
  return false
}

export function assertCanExportReport(reportKey: string, userPerms: string[]): void {
  const definition = findReportDefinition(reportKey)
  if (!definition) throw new ReportNotFoundError(reportKey)
  if (!definition.exportSupported) throw new ReportExportNotSupportedError(reportKey)
  if (!hasExportPermission(userPerms, definition)) {
    throw new AuthorizationError('Missing export permission: manufacturing.reports.export')
  }
}

export function reportResultToCsv(result: ReportResult): string {
  const lines: string[] = []
  lines.push(csvEscape(result.title))
  lines.push(`Generated At,${csvEscape(result.generatedAt)}`)
  lines.push(`Timezone,${csvEscape(result.timezone)}`)
  lines.push(`Filters,${csvEscape(JSON.stringify(result.filters))}`)
  if (result.warnings.length > 0) lines.push(`Warnings,${csvEscape(result.warnings.join(' | '))}`)
  lines.push(`Row Count,${result.pagination.totalRows}`)
  lines.push('')
  lines.push(result.columns.map((c) => csvEscape(c.label)).join(','))
  for (const row of result.rows) {
    lines.push(result.columns.map((c) => csvEscape(row[c.key])).join(','))
  }
  return lines.join('\n')
}

export async function exportReportCsv(
  tenantId: string,
  reportKey: string,
  filters: Record<string, unknown>,
  userPerms: string[],
): Promise<{ csv: string; rowCount: number }> {
  assertCanExportReport(reportKey, userPerms)
  const result = await executeReport(tenantId, reportKey, filters, userPerms, { pageSizeOverride: EXPORT_SYNC_ROW_LIMIT })
  return { csv: reportResultToCsv(result), rowCount: result.pagination.totalRows }
}
