import { useCallback, useState } from 'react'
import type { MasterLifecycleAction } from '../components/masters/MasterLifecycleDialog'
import { formatApiError } from '../services/api/apiErrors'
import { resolveMaybeVoid } from '../store/storeAction'
import { notify } from '../store/toastStore'

export type CoreMasterResource =
  | 'countries'
  | 'states'
  | 'cities'
  | 'uom'
  | 'warehouses'
  | 'locations'

type LifecycleHandlers = {
  delete: (id: string) => void | Promise<void>
  activate: (id: string) => void | Promise<void>
  deactivate: (id: string) => void | Promise<void>
}

export function useMasterLifecycle(handlers: LifecycleHandlers) {
  const [dialog, setDialog] = useState<{
    action: MasterLifecycleAction
    id: string
    label: string
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = useCallback((action: MasterLifecycleAction, id: string, label: string) => {
    setError(null)
    setDialog({ action, id, label })
  }, [])

  const close = useCallback(() => {
    if (pending) return
    setDialog(null)
    setError(null)
  }, [pending])

  const confirm = useCallback(async () => {
    if (!dialog) return
    setPending(true)
    setError(null)
    try {
      if (dialog.action === 'delete') await resolveMaybeVoid(handlers.delete(dialog.id))
      else if (dialog.action === 'activate') await resolveMaybeVoid(handlers.activate(dialog.id))
      else await resolveMaybeVoid(handlers.deactivate(dialog.id))
      const verb = dialog.action === 'delete' ? 'deleted' : dialog.action === 'activate' ? 'activated' : 'deactivated'
      notify.success(`${dialog.label} ${verb}`)
      setDialog(null)
    } catch (err) {
      const message = formatApiError(err)
      setError(message)
      notify.error(message)
    } finally {
      setPending(false)
    }
  }, [dialog, handlers])

  return { dialog, pending, error, open, close, confirm }
}
