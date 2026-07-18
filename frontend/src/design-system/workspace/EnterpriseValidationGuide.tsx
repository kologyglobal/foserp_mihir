import { AlertCircle } from 'lucide-react'
import type { EnterpriseValidationItem } from './types'

/**
 * Interactive “complete before saving” checklist (CRM guides).
 * Plain string errors are handled as toasts via ErpValidationSummary — not inline banners.
 */
export function EnterpriseValidationGuide({
  title = 'Please complete the required fields',
  items,
}: {
  title?: string
  items?: EnterpriseValidationItem[]
  /** @deprecated Errors surface as toasts via ErpValidationSummary */
  errors?: string[]
}) {
  const missing = items?.filter((i) => i.label || i.message) ?? []
  if (missing.length === 0) return null

  return (
    <div className="ent-ws-validation" role="status">
      <div className="ent-ws-validation__head">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        <p className="ent-ws-validation__title">{title}</p>
      </div>
      <ul className="ent-ws-validation__list">
        {missing.map((item) => {
          const label = (item.label || item.message || '').trim()
          const hint =
            item.message
            && item.message.trim().toLowerCase() !== label.toLowerCase()
              ? item.message
              : null
          return (
            <li key={item.id}>
              {item.onClick ? (
                <button type="button" className="ent-ws-validation__link" onClick={item.onClick}>
                  {label}
                </button>
              ) : (
                <span>{label}</span>
              )}
              {hint ? <span className="ent-ws-validation__hint"> — {hint}</span> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
