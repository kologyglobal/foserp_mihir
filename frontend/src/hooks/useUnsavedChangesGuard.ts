import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import { systemConfirm } from '@/utils/systemConfirm'

/**
 * Blocks in-app navigation and browser unload when the form has unsaved changes.
 * Call `resetDirty()` after a successful save.
 *
 * In-app leave uses the ERP confirm dialog. Browser tab close still uses the
 * native beforeunload prompt (browsers do not allow custom UI there).
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
    void systemConfirm({
      title: 'Unsaved changes',
      description: 'You have unsaved changes. Leave this page and discard them?',
      confirmLabel: 'Leave page',
      cancelLabel: 'Keep editing',
      variant: 'danger',
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
