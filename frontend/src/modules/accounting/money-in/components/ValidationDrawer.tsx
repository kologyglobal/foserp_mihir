import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, CircleAlert, X } from 'lucide-react'
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

const UNALLOCATED_WARNING_CODES = new Set([
  'UNALLOCATED_RECEIPT_REMAINS',
  'UNALLOCATED_CREDIT_NOTE_REMAINS',
])

function isUnallocatedWarning(issue: CalculationIssue): boolean {
  if (issue.code && UNALLOCATED_WARNING_CODES.has(issue.code)) return true
  const msg = issue.message?.toLowerCase() ?? ''
  return msg.includes('unallocated') || msg.includes('no allocations proposed')
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

function warningPrimaryText(issue: CalculationIssue): string {
  if (!isUnallocatedWarning(issue)) return issue.message
  if (issue.message.toLowerCase().includes('partially')) {
    return 'Partially unallocated — remaining amount stays as customer advance.'
  }
  return 'No allocations proposed — full amount remains unallocated.'
}

export function ValidationDrawer({
  open,
  onClose,
  report,
  allocateHref,
}: {
  open: boolean
  onClose: () => void
  report: ValidationReport | null
  /** When set (e.g. posted receipt with allocate permission), show Allocate now CTA. */
  allocateHref?: string | null
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
  const accountsReady = readiness.length > 0 && readinessIssues.length === 0 && mappingErrors.length === 0
  const hasBlocking = !report.valid || mappingErrors.length > 0 || otherErrors.length > 0 || readinessIssues.length > 0

  return (
    <div className="mi-validation-overlay" role="dialog" aria-modal="true" aria-labelledby="mi-validation-title">
      <button type="button" className="mi-validation-overlay__backdrop" aria-label="Close validation drawer" onClick={onClose} />
      <div className="mi-validation-drawer">
        <div className="mi-validation-drawer__head">
          <h2 id="mi-validation-title" className="mi-validation-drawer__title">
            Validation
          </h2>
          <button type="button" onClick={onClose} className="mi-validation-drawer__close" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mi-validation-drawer__body">
          <div
            className={`mi-validation-status ${hasBlocking ? 'mi-validation-status--error' : 'mi-validation-status--ok'}`}
          >
            {hasBlocking ? (
              <CircleAlert className="mi-validation-status__icon" aria-hidden />
            ) : (
              <CheckCircle2 className="mi-validation-status__icon" aria-hidden />
            )}
            <div className="mi-validation-status__text">
              <p className="mi-validation-status__title">
                {hasBlocking ? 'Fix errors before mark-ready or post' : 'Ready — no blocking errors'}
              </p>
              <p className="mi-validation-status__sub">
                {hasBlocking
                  ? 'Resolve the items below, then validate again.'
                  : 'You can mark ready and post. Soft warnings do not block posting.'}
              </p>
            </div>
          </div>

          {accountsReady && (
            <div className="mi-validation-ready-chip" role="status">
              <CheckCircle2 className="mi-validation-ready-chip__icon" aria-hidden />
              <span>Accounts ready</span>
              <span className="mi-validation-ready-chip__detail">Required receipt accounts mapped &amp; postable</span>
            </div>
          )}

          {(mappingErrors.length > 0 || readinessIssues.length > 0) && (
            <section className="mi-validation-section">
              <h3 className="mi-validation-section__title mi-validation-section__title--error">Account mapping</h3>
              <ul className="mi-validation-list">
                {mappingErrors.map((e, i) => (
                  <li key={`map-e-${i}`} className="mi-validation-item mi-validation-item--error">
                    {e.field ? <span className="mi-validation-item__field">{e.field}</span> : null}
                    {e.message}
                  </li>
                ))}
                {readinessIssues.map((a, i) => (
                  <li key={`map-r-${i}`} className="mi-validation-item mi-validation-item--error">
                    <span className="mi-validation-item__field">{a.mappingKey}</span>
                    {a.issues?.[0]?.message
                      ?? (a.configured
                        ? 'Mapped account is invalid or not postable.'
                        : `Default account mapping ${a.mappingKey} is not configured.`)}
                  </li>
                ))}
              </ul>
              <p className="mi-validation-section__hint">
                Configure missing GL accounts under Accounting → Settings → Default Account Mapping.
              </p>
            </section>
          )}

          {otherErrors.length > 0 && (
            <section className="mi-validation-section">
              <h3 className="mi-validation-section__title mi-validation-section__title--error">Errors</h3>
              <ul className="mi-validation-list">
                {otherErrors.map((e, i) => (
                  <li key={`e-${i}`} className="mi-validation-item mi-validation-item--error">
                    {e.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {warnings.length > 0 && (
            <section className="mi-validation-section">
              <h3 className="mi-validation-section__title mi-validation-section__title--warn">Warnings</h3>
              <ul className="mi-validation-list">
                {warnings.map((w, i) => {
                  const unallocated = isUnallocatedWarning(w)
                  return (
                    <li
                      key={`w-${i}`}
                      className={`mi-validation-item mi-validation-item--warn${unallocated ? ' mi-validation-item--unallocated' : ''}`}
                    >
                      <div className="mi-validation-item__row">
                        <AlertTriangle className="mi-validation-item__icon" aria-hidden />
                        <div className="mi-validation-item__content">
                          <p className="mi-validation-item__msg">{warningPrimaryText(w)}</p>
                          {unallocated ? (
                            <>
                              <p className="mi-validation-item__hint">
                                Posting without allocation is allowed — unallocated amount becomes customer advance.
                                You can allocate after posting.
                              </p>
                              {allocateHref ? (
                                <Link
                                  to={allocateHref}
                                  className="mi-validation-item__cta"
                                  onClick={onClose}
                                >
                                  Allocate now
                                </Link>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
