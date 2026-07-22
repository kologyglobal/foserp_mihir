import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import type { ImportIssueDto } from '../api/bank-statement.types'
import { groupIssuesBySeverity, issueSeverityTone } from '../utils/bankStatementUi'

export function ImportIssuePanel({ issues, title = 'Import issues' }: { issues: ImportIssueDto[]; title?: string }) {
  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
        No blocking issues detected.
      </div>
    )
  }

  const grouped = groupIssuesBySeverity(issues)

  return (
    <section className="rounded-lg border border-erp-border bg-white">
      <header className="border-b border-erp-border px-3 py-2">
        <h3 className="text-[13px] font-semibold text-erp-text">{title}</h3>
        <div className="mt-1 flex flex-wrap gap-2">
          {grouped.blockers.length > 0 ? (
            <ErpStatusChip tone="critical" label={`${grouped.blockers.length} blocker(s)`} />
          ) : null}
          {grouped.errors.length > 0 ? (
            <ErpStatusChip tone="critical" label={`${grouped.errors.length} error(s)`} />
          ) : null}
          {grouped.warnings.length > 0 ? (
            <ErpStatusChip tone="warning" label={`${grouped.warnings.length} warning(s)`} />
          ) : null}
        </div>
      </header>
      <ul className="max-h-64 divide-y divide-erp-border overflow-y-auto">
        {issues.map((issue, idx) => (
          <li key={`${issue.code}-${issue.rowNumber ?? 'h'}-${idx}`} className="px-3 py-2 text-[12px]">
            <div className="flex flex-wrap items-center gap-2">
              <ErpStatusChip tone={issueSeverityTone(issue.severity)} label={issue.severity} />
              {issue.rowNumber != null ? (
                <span className="text-erp-muted">Row {issue.rowNumber}</span>
              ) : null}
              {issue.columnName ? <span className="text-erp-muted">Col {issue.columnName}</span> : null}
              <span className="font-mono text-[11px] text-erp-muted">{issue.code}</span>
            </div>
            <p className="mt-1 text-erp-text">{issue.message}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
