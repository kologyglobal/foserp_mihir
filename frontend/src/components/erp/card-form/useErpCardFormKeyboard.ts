import { useEffect } from 'react'
import type { ErpCardFormPageProps } from './types'

interface UseErpCardFormKeyboardOptions {
  enabled?: boolean
  onSave?: () => void
  onSaveClose?: () => void
  onSaveAndNew?: () => void
  onCancel?: () => void
  onAddLine?: () => void
  onDeleteLine?: () => void
}

/** Keyboard-first UX for card forms — Ctrl+S, Ctrl+Enter, Esc, Alt+N, Alt+D */
export function useErpCardFormKeyboard({
  enabled = true,
  onSave,
  onSaveClose,
  onSaveAndNew,
  onCancel,
  onAddLine,
  onDeleteLine,
}: UseErpCardFormKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable

      if (e.key === 'Escape' && onCancel) {
        e.preventDefault()
        onCancel()
        return
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's' && onSaveClose) {
        e.preventDefault()
        onSaveClose()
        return
      }

      if (e.ctrlKey && e.key === 's' && onSave) {
        e.preventDefault()
        onSave()
        return
      }

      if (e.ctrlKey && e.key === 'Enter' && onSaveClose) {
        e.preventDefault()
        onSaveClose()
        return
      }

      if (e.altKey && e.key.toLowerCase() === 'n' && onSaveAndNew) {
        e.preventDefault()
        onSaveAndNew()
        return
      }

      if (e.altKey && e.key.toLowerCase() === 'n' && onAddLine && !onSaveAndNew) {
        e.preventDefault()
        onAddLine()
        return
      }

      if (e.altKey && e.key.toLowerCase() === 'd' && onDeleteLine && !inInput) {
        e.preventDefault()
        onDeleteLine()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, onSave, onSaveClose, onSaveAndNew, onCancel, onAddLine, onDeleteLine])
}

export function useErpCardFormPageKeyboard(props: Pick<ErpCardFormPageProps, 'enableKeyboardShortcuts' | 'onSaveShortcut' | 'onSaveCloseShortcut' | 'onSaveAndNewShortcut'>) {
  useErpCardFormKeyboard({
    enabled: props.enableKeyboardShortcuts !== false,
    onSave: props.onSaveShortcut,
    onSaveClose: props.onSaveCloseShortcut,
    onSaveAndNew: props.onSaveAndNewShortcut,
  })
}
