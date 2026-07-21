import { X } from 'lucide-react'
import type { VendorInvoiceDto } from '@/types/moneyOut'
import { groupValidationIssues } from '../moneyOutUi'

export function VendorInvoiceValidationPanel({
  open,
  onClose,
  invoice,
}: {
  open: boolean
  onClose: () => void
  invoice: VendorInvoiceDto | null
}) {
  if (!open || !invoice) return null
  const validation = invoice.validation
  const errors = validation?.errors ?? []
  const warnings = validation?.warnings ?? []
  const { info } = groupValidationIssues([...(errors ?? []), ...(warnings ?? [])])
  const dup = validation?.duplicateAssessment
  const readiness = validation?.accountReadiness
  const preview = invoice.accountingPreviewSnapshot

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" role="dialog" aria-modal="true" aria-labelledby="vi-validation-title">
      <button type="button" className="flex-1" aria-label="Close validation panel" onClick={onClose} />
      <div className="flex h-full w-full max-w-lg flex-col border-l border-erp-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-erp-border px-4 py-3">
          <h2 id="vi-validation-title" className="text-[14px] font-semibold text-erp-text">
            Validation
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-[12px]">
          <p className={validation?.isValid ? 'text-emerald-700' : 'text-rose-700'}>
            {validation?.isValid
              ? 'Validation passed — no blocking errors.'
              : 'Fix errors before submit, mark ready, or post.'}
          </p>

          {dup && dup.riskLevel !== 'NONE' && (
            <section className={`rounded border px-3 py-2 ${dup.isBlocking ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <h3 className="font-semibold">{dup.isBlocking ? 'Exact duplicate blocked' : 'Similar invoice warning'}</h3>
              <p className="mt-1">
                {dup.message ??
                  (dup.isBlocking
                    ? 'A vendor invoice with this supplier invoice number already exists for this vendor.'
                    : 'A similar vendor invoice may already exist. Review before continuing.')}
              </p>
            </section>
          )}

          {errors.length > 0 && (
            <section>
              <h3 className="mb-2 font-semibold uppercase tracking-wide text-rose-700">Errors ({errors.length})</h3>
              <ul className="space-y-2">
                {errors.map((e, i) => (
                  <li key={`e-${i}`} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
                    {e.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {warnings.length > 0 && (
            <section>
              <h3 className="mb-2 font-semibold uppercase tracking-wide text-amber-700">Warnings ({warnings.length})</h3>
              <ul className="space-y-2">
                {warnings.map((w, i) => (
                  <li key={`w-${i}`} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    {w.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {info.length > 0 && (
            <section>
              <h3 className="mb-2 font-semibold uppercase tracking-wide text-sky-700">Information</h3>
              <ul className="space-y-2">
                {info.map((item, i) => (
                  <li key={`i-${i}`} className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">
                    {item.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {readiness && (
            <section>
              <h3 className="mb-2 font-semibold uppercase tracking-wide text-erp-muted">Account readiness</h3>
              <p className={readiness.isReady ? 'text-emerald-700' : 'text-rose-700'}>
                {readiness.isReady ? 'All required accounts are ready.' : 'One or more required accounts are missing or invalid.'}
              </p>
              <ul className="mt-2 space-y-1">
                {readiness.resolvedAccounts.map((a, i) => (
                  <li key={`a-${i}`} className="flex justify-between gap-2 border-b border-erp-border/50 py-1">
                    <span>
                      {a.component}
                      {a.lineNumber != null ? ` (line ${a.lineNumber})` : ''}
                    </span>
                    <span className={a.isValid ? 'text-emerald-700' : 'text-rose-700'}>
                      {a.isValid ? `${a.accountCode ?? a.accountId ?? '—'}` : a.issueMessage ?? 'Missing'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {preview && (
            <section>
              <h3 className="mb-2 font-semibold uppercase tracking-wide text-erp-muted">Accounting preview</h3>
              <p className={preview.isBalanced ? 'text-emerald-700' : 'text-rose-700'}>
                {preview.isBalanced ? 'Balanced' : `Unbalanced (diff ${preview.difference})`}
              </p>
              <p className="mt-1 text-erp-muted">
                Dr {preview.totalDebit} · Cr {preview.totalCredit}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
