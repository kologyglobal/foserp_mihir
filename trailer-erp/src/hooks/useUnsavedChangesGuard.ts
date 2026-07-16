import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'

/**
 * Blocks in-app navigation and browser unload when the form has unsaved changes.
 * Call `resetDirty()` after a successful save.
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
    const leave = window.confirm('You have unsaved changes. Leave this page and discard them?')
    if (leave) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  return { dirty, markDirty, resetDirty }
}
