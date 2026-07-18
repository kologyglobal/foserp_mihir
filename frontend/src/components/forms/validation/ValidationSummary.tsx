import { cn } from '../../../utils/cn'
import type { FieldErrorMap } from '../../../utils/formValidation'
import { fieldErrorsToMessages, normalizeFieldErrors } from '../../../utils/formValidation'

export interface ValidationSummaryProps {
  /** Field map, or pre-flattened message list */
  errors?: FieldErrorMap | string[]
  /** Preferred field order for message list */
  fieldOrder?: string[]
  title?: string
  className?: string
  /**
   * `list` — compact inline banner (default when errors present).
   * `none` — render nothing (toast-only UX; still useful as a typed slot).
   */
  variant?: 'list' | 'none'
  /** Click a message to jump to its field (when errors is a FieldErrorMap). */
  onSelectField?: (fieldKey: string) => void
}

/**
 * Optional inline summary of validation errors.
 * Primary UX remains top-right `notify` via `handleInvalidSubmit`; use this when
 * a persistent list beside the form is helpful (e.g. long multi-section forms).
 */
export function ValidationSummary({
  errors,
  fieldOrder,
  title = 'Please fix the following',
  className,
  variant = 'list',
  onSelectField,
}: ValidationSummaryProps) {
  if (variant === 'none' || !errors) return null

  const isMap = !Array.isArray(errors)
  const map = isMap ? normalizeFieldErrors(errors) : {}
  const messages = isMap
    ? fieldErrorsToMessages(map, fieldOrder)
    : errors.filter((m) => Boolean(m?.trim()))

  if (!messages.length) return null

  const keys = isMap
    ? (fieldOrder?.length
      ? [...fieldOrder.filter((k) => map[k]), ...Object.keys(map).filter((k) => !fieldOrder.includes(k))]
      : Object.keys(map))
    : messages.map((_, i) => `_msg_${i}`)

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'rounded-md border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[13px] text-amber-950',
        className,
      )}
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
        {messages.map((msg, i) => {
          const fieldKey = keys[i]
          const clickable = Boolean(onSelectField && fieldKey && !fieldKey.startsWith('_'))
          return (
            <li key={`${fieldKey}-${msg}`}>
              {clickable ? (
                <button
                  type="button"
                  className="text-left font-medium text-amber-900 underline-offset-2 hover:underline"
                  onClick={() => onSelectField?.(fieldKey)}
                >
                  {msg}
                </button>
              ) : (
                msg
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
