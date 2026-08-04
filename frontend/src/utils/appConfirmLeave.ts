import type { Blocker } from 'react-router-dom'
import { appConfirm } from '@/store/confirmDialogStore'

/** Shared copy for leave-with-dirty-form prompts. */
export const UNSAVED_LEAVE_COPY = {
  title: 'Unsaved changes',
  description: 'You have unsaved changes. Leave this page and discard them?',
  confirmLabel: 'Leave page',
  cancelLabel: 'Keep editing',
} as const

/** In-app confirm for dirty navigation (never `window.confirm`). */
export function appConfirmLeaveUnsaved(): Promise<boolean> {
  return appConfirm({
    title: UNSAVED_LEAVE_COPY.title,
    description: UNSAVED_LEAVE_COPY.description,
    confirmLabel: UNSAVED_LEAVE_COPY.confirmLabel,
    cancelLabel: UNSAVED_LEAVE_COPY.cancelLabel,
    tone: 'default',
  })
}

/**
 * Wire a React Router `Blocker` to the modern leave dialog.
 * Call from `useEffect` when `blocker.state === 'blocked'`.
 * Returns a cleanup that cancels an in-flight dialog resolution.
 */
export function resolveBlockedNavigation(blocker: Blocker): () => void {
  if (blocker.state !== 'blocked') return () => {}
  let cancelled = false
  void appConfirmLeaveUnsaved().then((leave) => {
    if (cancelled) return
    if (leave) blocker.proceed()
    else blocker.reset()
  })
  return () => {
    cancelled = true
  }
}
