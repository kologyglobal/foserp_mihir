import { createElement, useCallback, useRef, type FocusEvent, type KeyboardEvent } from 'react'
import { cn } from '../../utils/cn'

export type EditableTextTag =
  | 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'strong' | 'em' | 'li' | 'td' | 'th'

interface EditableTextProps {
  /** Stable id used as the key inside the template's contentOverrides map. */
  id: string
  /** Resolved value to display (caller merges override + fallback). */
  value: string
  /** Called with (id, newText) on blur when the text actually changed. */
  onChange?: (id: string, value: string) => void
  /** When false/undefined, renders plain read-only text (print/preview mode). */
  editable?: boolean
  as?: EditableTextTag
  className?: string
  /** Preserve line breaks (uses innerText + `\n` on save, renders `<br/>` when read-only). */
  multiline?: boolean
  /** Placeholder shown (via CSS `:empty::before`) when value is blank in edit mode. */
  placeholder?: string
}

/**
 * Inline WYSIWYG text field for print/preview canvases. Only writes back on
 * blur (not per keystroke) so the contentEditable node is never re-rendered
 * mid-edit, which keeps caret position intact without controlled-input hacks.
 */
export function EditableText({
  id,
  value,
  onChange,
  editable,
  as = 'span',
  className,
  multiline,
  placeholder,
}: EditableTextProps) {
  const ref = useRef<HTMLElement | null>(null)

  const handleBlur = useCallback((e: FocusEvent<HTMLElement>) => {
    if (!onChange) return
    const el = e.currentTarget
    const next = multiline
      ? (el.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim()
      : (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (next !== value) onChange(id, next)
  }, [id, value, onChange, multiline])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault()
      ref.current?.blur()
    }
  }, [multiline])

  if (!editable) {
    if (multiline && value.includes('\n')) {
      const lines = value.split('\n')
      return createElement(
        as,
        { className },
        lines.flatMap((line, i) => (i === 0 ? [line] : [createElement('br', { key: i }), line])),
      )
    }
    return createElement(as, { className }, value)
  }

  return createElement(as, {
    ref,
    className: cn(className, 'quo-editable-text'),
    contentEditable: true,
    suppressContentEditableWarning: true,
    'data-editable-id': id,
    'data-placeholder': placeholder,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
  }, value)
}
