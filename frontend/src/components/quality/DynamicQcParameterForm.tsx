import { useCallback } from 'react'
import type { QcParameterResult } from '../../types/qcParameters'
import { applyParameterEvaluation } from '../../utils/qcDecisionEngine'
import { cn } from '../../utils/cn'

type Props = {
  results: QcParameterResult[]
  onChange: (results: QcParameterResult[]) => void
  disabled?: boolean
  inspector?: string
}

export function DynamicQcParameterForm({ results, onChange, disabled, inspector }: Props) {
  const update = useCallback(
    (parameterId: string, patch: Partial<QcParameterResult>) => {
      onChange(
        applyParameterEvaluation(
          results.map((r) => (r.parameterId === parameterId ? { ...r, ...patch } : r)),
        ),
      )
    },
    [results, onChange],
  )

  if (results.length === 0) {
    return <p className="text-[13px] text-erp-muted">No dynamic parameters loaded for this inspection.</p>
  }

  return (
    <div className="space-y-3">
      {results.map((r) => {
        const evaluated = applyParameterEvaluation([r])[0]
        const fail = evaluated.passed === false
        const pass = evaluated.passed === true
        return (
          <div
            key={r.parameterId}
            className={cn(
              'rounded-lg border p-3',
              fail && 'border-erp-danger/40 bg-erp-danger-soft/30',
              pass && 'border-erp-success/30 bg-erp-success-soft/20',
              !fail && !pass && 'border-erp-border',
            )}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[13px] font-semibold text-erp-text">{r.parameterName}</span>
                <span className="ml-2 text-[11px] text-erp-muted">{r.parameterCode}</span>
                {r.mandatory && <span className="ml-1 text-[11px] text-erp-danger">*</span>}
              </div>
              <span className="text-[10px] uppercase tracking-wide text-erp-muted">{r.severity}</span>
            </div>

            {r.parameterType === 'boolean' && (
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={r.actualValue === true}
                  onChange={(e) => update(r.parameterId, { actualValue: e.target.checked })}
                />
                {r.passFailRule === 'boolean_false' ? 'No issue observed' : 'Pass check'}
              </label>
            )}

            {r.parameterType === 'numeric' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  disabled={disabled}
                  className="w-32 rounded border border-erp-border px-2 py-1.5 text-[13px]"
                  value={r.actualValue === null ? '' : String(r.actualValue)}
                  onChange={(e) =>
                    update(r.parameterId, { actualValue: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
                {r.uomCode && <span className="text-[12px] text-erp-muted">{r.uomCode}</span>}
                {(r.minValue != null || r.maxValue != null) && (
                  <span className="text-[11px] text-erp-muted">
                    Tol: {r.minValue ?? '—'} – {r.maxValue ?? '—'}
                    {r.targetValue != null && ` · Target ${r.targetValue}`}
                  </span>
                )}
              </div>
            )}

            {r.parameterType === 'text' && (
              <input
                type="text"
                disabled={disabled}
                className="w-full rounded border border-erp-border px-2 py-1.5 text-[13px]"
                value={String(r.actualValue ?? '')}
                onChange={(e) => update(r.parameterId, { actualValue: e.target.value })}
              />
            )}

            {r.parameterType === 'dropdown' && (
              <select
                disabled={disabled}
                className="rounded border border-erp-border px-2 py-1.5 text-[13px]"
                value={String(r.actualValue ?? '')}
                onChange={(e) => update(r.parameterId, { actualValue: e.target.value })}
              >
                <option value="">Select…</option>
                {(r.dropdownOptions ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}

            {r.parameterType === 'photo_required' && (
              <input
                type="text"
                disabled={disabled}
                placeholder="Photo / attachment reference"
                className="w-full rounded border border-erp-border px-2 py-1.5 text-[13px]"
                value={r.attachmentRef ?? ''}
                onChange={(e) => update(r.parameterId, { attachmentRef: e.target.value, actualValue: e.target.value })}
              />
            )}

            <input
              type="text"
              disabled={disabled}
              placeholder="Remarks"
              className="mt-2 w-full rounded border border-erp-border px-2 py-1.5 text-[12px]"
              value={r.remarks}
              onChange={(e) => update(r.parameterId, { remarks: e.target.value })}
            />

            {evaluated.passed != null && (
              <p className={cn('mt-1 text-[11px] font-medium', fail ? 'text-erp-danger' : 'text-erp-success')}>
                {evaluated.passed ? 'PASS' : 'FAIL'}
                {inspector && r.recordedAt ? ` · ${inspector}` : ''}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
