import { AlertCircle } from 'lucide-react'
import type { EnterpriseValidationItem } from './types'
import { toRequiredFieldLabel } from '../../utils/formValidation'

/**
 * Optional inline checklist. Primary UX for save failures is top-right toast
 * via `handleInvalidSubmit` / `ErpValidationSummary`.
 */
export function EnterpriseValidationGuide({
  title = 'Please complete the required fields before saving',
  items,
}: {
  title?: string
  items?: EnterpriseValidationItem[]
  /** @deprecated Errors surface as toasts via ErpValidationSummary */
  errors?: string[]
}) {
  const missing = (items ?? [])
    .map((item) => {
      const rawLabel = (item.label || item.message || '').trim()
      const label = toRequiredFieldLabel(rawLabel) || rawLabel
      const rawMessage = item.message?.trim() ?? ''
      const messageLabel = rawMessage ? toRequiredFieldLabel(rawMessage) : ''
      const hint =
        rawMessage
        && messageLabel.toLowerCase() !== label.toLowerCase()
        && rawMessage.toLowerCase() !== label.toLowerCase()
        && rawMessage.toLowerCase() !== `${label.toLowerCase()} is required`
        && rawMessage.toLowerCase() !== `${label.toLowerCase()} is required.`
          ? rawMessage
          : null
      return { ...item, label, hint }
    })
    .filter((i) => i.label)

  if (missing.length === 0) return null

  return (
    <div className="ent-ws-validation" role="status">
      <div className="ent-ws-validation__head">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        <p className="ent-ws-validation__title">{title}</p>
      </div>
      <ul className="ent-ws-validation__list">
        {missing.map((item) => (
          <li key={item.id}>
            {item.onClick ? (
              <button type="button" className="ent-ws-validation__link" onClick={item.onClick}>
                {item.label}
              </button>
            ) : (
              <span>{item.label}</span>
            )}
            {item.hint ? <span className="ent-ws-validation__hint"> — {item.hint}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
