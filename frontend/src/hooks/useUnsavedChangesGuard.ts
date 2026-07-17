import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import { appConfirm } from '@/store/confirmDialogStore'

/**
 * Blocks in-app navigation and browser unload when the form has unsaved changes.
 * Call `resetDirty()` after a successful save.
 *
 * In-app leave uses `ConfirmDialog` via `appConfirm` — never `window.confirm`.
 * Tab/window close still uses the native beforeunload prompt (browsers require it).
 */
export function useUnsavedChangesGuard(enabled: boolean) {
  const dirtyRef = useRef(false)
  const [dirty, setDirty] = useState(false)

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true
      setDirty(true)
    }
  }, [])

  const resetDirty = useCallback(() => {
    dirtyRef.current = false
    setDirty(false)
  }, [])

  const shouldBlock = enabled && dirty

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!shouldBlock) return
        event.preventDefault()
        event.returnValue = ''
      },
      [shouldBlock],
    ),
  )

  const blocker = useBlocker(shouldBlock)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    let cancelled = false
    void appConfirm({
      title: 'Unsaved changes',
      description: 'You have unsaved changes. Leave this page and discard them?',
      confirmLabel: 'Leave page',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    }).then((leave) => {
      if (cancelled) return
      if (leave) blocker.proceed()
      else blocker.reset()
    })
    return () => {
      cancelled = true
    }
  }, [blocker])

  return { dirty, markDirty, resetDirty }
}
