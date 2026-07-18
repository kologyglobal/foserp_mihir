import { useEffect, useRef } from 'react'
import { notify } from '../../store/toastStore'
import {
  formatRequiredFieldsNotifyMessage,
  toRequiredFieldLabel,
} from '../../utils/formValidation'

interface ErpValidationSummaryProps {
  errors?: string[]
  lockedReason?: string
  className?: string
}

/**
 * Form/API alerts surface as toasts (top-right via ToastHost), not inline banners —
 * so save success/failure is obvious and not confused with page chrome.
 */
export function ErpValidationSummary({ errors = [], lockedReason }: ErpValidationSummaryProps) {
  const lastKey = useRef('')

  useEffect(() => {
    const key = `${lockedReason ?? ''}::${errors.join('\n')}`
    if (!lockedReason && errors.length === 0) {
      lastKey.current = ''
      return
    }
    if (key === lastKey.current) return
    lastKey.current = key

    if (lockedReason) {
      notify.warning(lockedReason)
      return
    }
    if (errors.length > 0) {
      notify.error(formatRequiredFieldsNotifyMessage(errors.map(toRequiredFieldLabel)))
    }
  }, [errors, lockedReason])

  return null
}
