import { X } from 'lucide-react'
import type { CalculationIssue, CustomerReceiptValidationPreview, SalesInvoiceValidationPreview } from '@/types/moneyIn'
import {
  groupValidationIssues,
  isAccountMappingIssue,
} from '../moneyInUi'

type ValidationReport =
  | SalesInvoiceValidationPreview
  | CustomerReceiptValidationPreview
  | {
      valid: boolean
      errors: CalculationIssue[]
      warnings: CalculationIssue[]
      accountReadiness?: CustomerReceiptValidationPreview['accountReadiness']
    }

function flattenAccountReadiness(
  readiness: NonNullable<CustomerReceiptValidationPreview['accountReadiness']>,
) {
  return [
    readiness.bankCash,
    readiness.customerReceivable,
    readiness.customerTds,
    ...(readiness.bankCharges ?? []),
    ...(readiness.otherDeductions ?? []),
  ]
}

export function ValidationDrawer({
  open,
  onClose,
  report,
}: {
  open: boolean
  onClose: () => void
  report: ValidationReport | null
}) {
  if (!open || !report) return null
  const { errors, warnings } = groupValidationIssues([...report.errors, ...report.warnings])
  const mappingErrors = errors.filter(isAccountMappingIssue)
  const otherErrors = errors.filter((e) => !isAccountMappingIssue(e))
  const readiness =
    'accountReadiness' in report && report.accountReadiness
      ? flattenAccountReadiness(report.accountReadiness)
      : []
  const readinessIssues = readiness.filter((a) => a.required && !a.valid)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" role="dialog" aria-modal="true">
      <button type="button" className="flex-1" aria-label="Close validation drawer" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col border-l border-erp-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-erp-border px-4 py-3">
          <h2 className="text-[14px] font-semibold text-erp-text">Validation</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className={`mb-3 text-[13px] ${report.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
            {report.valid ? 'Validation passed — no blocking errors.' : 'Fix errors before mark-ready or post.'}
          </p>

          {(mappingErrors.length > 0 || readinessIssues.length > 0) && (
            <section className="mb-4">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-rose-700">
                Account mapping
              </h3>
              <ul className="space-y-2">
                {mappingErrors.map((e, i) => (
                  <li
                    key={`map-e-${i}`}
                    className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900"
                  >
                    {e.field ? (
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        {e.field}
                      </span>
                    ) : null}
                    {e.message}
                  </li>
                ))}
                {readinessIssues.map((a, i) => (
                  <li
                    key={`map-r-${i}`}
                    className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900"
                  >
                    <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                      {a.mappingKey}
                    </span>
                    {a.issues?.[0]?.message
                      ?? (a.configured
                        ? 'Mapped account is invalid or not postable.'
                        : `Default account mapping ${a.mappingKey} is not configured.`)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-erp-muted">
                Configure missing GL accounts under Accounting → Settings → Default Account Mapping.
              </p>
            </section>
          )}

          {otherErrors.length > 0 && (
            <section className="mb-4">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-rose-700">Errors</h3>
              <ul className="space-y-2">
                {otherErrors.map((e, i) => (
                  <li key={`e-${i}`} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900">
                    {e.message}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {warnings.length > 0 && (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-amber-700">Warnings</h3>
              <ul className="space-y-2">
                {warnings.map((w, i) => (
                  <li key={`w-${i}`} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    {w.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {readiness.length > 0 && readinessIssues.length === 0 && mappingErrors.length === 0 && (
            <section className="mt-4">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
                Account readiness
              </h3>
              <p className="text-[12px] text-emerald-700">All required receipt accounts are mapped and postable.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
