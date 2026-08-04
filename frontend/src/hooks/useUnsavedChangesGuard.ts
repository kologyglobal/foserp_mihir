import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import { appConfirmLeaveUnsaved } from '@/utils/appConfirmLeave'

/**
 * Blocks in-app navigation and browser unload when the form has unsaved changes.
 * Call `resetDirty()` after a successful save (before `navigate()`).
 *
 * Uses a ref for the blocker decision so `resetDirty()` + immediate `navigate()`
 * does not race React state and show a false "Unsaved changes" dialog.
 *
 * In-app leave uses the modern ConfirmDialog — never `window.confirm`.
 * Tab/window close still uses the native beforeunload prompt (browsers require it
 * and do not allow custom HTML dialogs on unload).
 *
 * Blocking reads `dirtyRef` (not React state) so `resetDirty()` then `navigate()`
 * in the same tick is not treated as leaving with unsaved changes.
 */
export function useUnsavedChangesGuard(enabled: boolean) {
  const dirtyRef = useRef(false)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
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

  useBeforeUnload(
    useCallback((event) => {
      if (!enabledRef.current || !dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }, []),
  )

  const blocker = useBlocker(
    useCallback(({ currentLocation, nextLocation }) => {
      if (!enabledRef.current || !dirtyRef.current) return false
      return (
        currentLocation.pathname !== nextLocation.pathname
        || currentLocation.search !== nextLocation.search
      )
    }, []),
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    let cancelled = false
    void appConfirmLeaveUnsaved().then((leave) => {
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
