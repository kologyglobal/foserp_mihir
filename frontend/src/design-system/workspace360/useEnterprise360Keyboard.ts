import { useEffect } from 'react'

export interface Enterprise360KeyboardHandlers {
  onEdit?: () => void
  onFollowUp?: () => void
  onCall?: () => void
  onCreateQuotation?: () => void
  onCreateOpportunity?: () => void
}

/** Keyboard shortcuts for 360° detail workspaces (E/F/C/Q/O). */
export function useEnterprise360Keyboard(handlers: Enterprise360KeyboardHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key.toLowerCase()) {
        case 'e':
          if (handlers.onEdit) {
            e.preventDefault()
            handlers.onEdit()
          }
          break
        case 'f':
          if (handlers.onFollowUp) {
            e.preventDefault()
            handlers.onFollowUp()
          }
          break
        case 'c':
          if (handlers.onCall) {
            e.preventDefault()
            handlers.onCall()
          }
          break
        case 'q':
          if (handlers.onCreateQuotation) {
            e.preventDefault()
            handlers.onCreateQuotation()
          }
          break
        case 'o':
          if (handlers.onCreateOpportunity) {
            e.preventDefault()
            handlers.onCreateOpportunity()
          }
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, handlers])
}
