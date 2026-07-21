import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { TreasuryAdjustmentValidationIssue } from '../api/treasury-adjustment.types'

export interface AdjustmentValidationSnapshotLike {
  isValid: boolean
  errors: TreasuryAdjustmentValidationIssue[]
  warnings: TreasuryAdjustmentValidationIssue[]
}

export function AdjustmentValidationPanel({ snapshot }: { snapshot: AdjustmentValidationSnapshotLike | null | undefined }) {
  if (!snapshot) {
    return (
      <div className="rounded-lg border border-dashed border-erp-border bg-erp-surface-alt/40 p-4 text-[12px] text-erp-muted">
        Not yet validated. Run Validate to check accounts, GST/TDS rules, and the accounting preview.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] font-semibold',
          snapshot.isValid ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900',
        )}
      >
        {snapshot.isValid ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {snapshot.isValid ? 'Validation passed' : 'Validation failed'}
      </div>

      {snapshot.errors.length > 0 ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-900">
          <p className="mb-1 font-semibold">Errors</p>
          <ul className="list-inside list-disc space-y-0.5">
            {snapshot.errors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {snapshot.warnings.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <ul className="list-inside list-disc space-y-0.5">
            {snapshot.warnings.map((warn, i) => (
              <li key={i}>{warn.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
