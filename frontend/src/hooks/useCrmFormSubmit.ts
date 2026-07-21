import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notify } from '../store/toastStore'

export type CrmSaveMode = 'default' | 'new' | 'close'

export interface CrmFormSubmitPaths {
  /** List / register route (Save & Close, Cancel destination). */
  list: string
  /** Optional create route for Save & New (defaults to current path). */
  create?: string
  /** Optional detail/360 after Save (edit mode). */
  detail?: string | ((id: string) => string)
}

export interface CrmFormSubmitOptions {
  paths: CrmFormSubmitPaths
  /** Called with save mode; return created/updated id when available. */
  onSave: (mode: CrmSaveMode) => Promise<{ ok: boolean; id?: string; error?: string } | void>
  successMessage?: string | ((mode: CrmSaveMode, id?: string) => string)
  /** When Save (default) on create: navigate to detail if id returned. Default true. */
  navigateToDetailOnSave?: boolean
}

/**
 * Shared CRM submit guard: disables double-submit, toasts success/failure,
 * and navigates for Save / Save & New / Save & Close.
 */
export function useCrmFormSubmit(options: CrmFormSubmitOptions) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    paths,
    onSave,
    successMessage = 'Saved',
    navigateToDetailOnSave = true,
  } = options

  const submit = useCallback(
    async (mode: CrmSaveMode = 'default') => {
      if (isSubmitting) return
      setIsSubmitting(true)
      try {
        const result = await onSave(mode)
        if (result && result.ok === false) {
          notify.failed(result.error ?? 'Save failed')
          return
        }
        const id = result && 'id' in result ? result.id : undefined
        const msg =
          typeof successMessage === 'function' ? successMessage(mode, id) : successMessage
        notify.success(msg)

        if (mode === 'close') {
          navigate(paths.list)
          return
        }
        if (mode === 'new') {
          navigate(paths.create ?? paths.list)
          return
        }
        if (mode === 'default' && navigateToDetailOnSave && id && paths.detail) {
          const dest = typeof paths.detail === 'function' ? paths.detail(id) : paths.detail
          navigate(dest)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Save failed'
        notify.failed(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting, navigate, onSave, paths, successMessage, navigateToDetailOnSave],
  )

  const cancel = useCallback(() => {
    navigate(paths.list)
  }, [navigate, paths.list])

  return { isSubmitting, submit, cancel, setIsSubmitting }
}
