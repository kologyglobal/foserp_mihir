import { useEffect, useRef } from 'react'
import { notify } from '../../store/toastStore'
import { parseMissingPermissionKey } from '../../services/api/apiErrors'
import {
  formatRequiredFieldsNotifyMessage,
  toRequiredFieldLabel,
} from '../../utils/formValidation'

interface ErpValidationSummaryProps {
  errors?: string[]
  lockedReason?: string
  className?: string
}

/** RBAC denials reach this shell as plain save errors — they are not field labels. */
const PERMISSION_DENIAL =
  /(missing permission|permission_denied|permission denied|(?:do|does) not have permission|no permission to|not permitted)/i

function permissionDenialMessage(message: string): string {
  const key = parseMissingPermissionKey(message)
  return key
    ? `You do not have permission for this action (${key}). Ask an administrator to grant it.`
    : message
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
    const denial = errors.find((e) => PERMISSION_DENIAL.test(e))
    if (denial) {
      notify.error(permissionDenialMessage(denial))
      return
    }
    if (errors.length > 0) {
      notify.error(formatRequiredFieldsNotifyMessage(errors.map(toRequiredFieldLabel)))
    }
  }, [errors, lockedReason])

  return null
}
