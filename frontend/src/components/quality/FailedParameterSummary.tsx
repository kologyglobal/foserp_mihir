import type { QcParameterResult } from '../../types/qcParameters'
import { StatusBadge } from '../ui/StatusBadge'
import { cn } from '../../utils/cn'

export function FailedParameterSummary({
  results,
  title = 'Failed Parameters',
  className,
}: {
  results: QcParameterResult[]
  title?: string
  className?: string
}) {
  const failed = results.filter((r) => r.passed === false)
  if (failed.length === 0) return null

  return (
    <div className={cn('rounded-lg border border-erp-danger/30 bg-erp-danger-soft/20 p-4', className)}>
      <h3 className="mb-3 text-[13px] font-semibold text-erp-danger">{title}</h3>
      <ul className="space-y-2">
        {failed.map((r) => (
          <li key={r.parameterId} className="flex flex-wrap items-start justify-between gap-2 text-[12px]">
            <div>
              <span className="font-medium text-erp-text">{r.parameterName}</span>
              <span className="ml-2 text-erp-muted">{r.parameterCode}</span>
              {r.remarks && <p className="mt-0.5 text-erp-muted">{r.remarks}</p>}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={r.severity} />
              <span className="text-erp-muted">
                Actual: {r.actualValue === null || r.actualValue === '' ? '—' : String(r.actualValue)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
