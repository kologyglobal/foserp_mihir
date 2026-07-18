import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { cn } from '../../utils/cn'
import type { ConfirmDialogRequest, ConfirmDialogTone } from '../../store/confirmDialogStore'

const TONE_CONFIRM_VARIANT: Record<ConfirmDialogTone, 'primary' | 'danger' | 'success' | 'warning'> = {
  default: 'primary',
  danger: 'danger',
  warning: 'warning',
  success: 'success',
}

export type ConfirmDialogProps = {
  open: boolean
  request: ConfirmDialogRequest | null
  onCancel: () => void
  onConfirm: (note: string) => void
}

/**
 * App confirm / notes dialog — Dynamics-style panel (flat border, header/footer rules).
 * Used by `appConfirm` / `appPromptNote` (e.g. unsaved leave).
 */
export function ConfirmDialog({ open, request, onCancel, onConfirm }: ConfirmDialogProps) {
  const titleId = useId()
  const descId = useId()
  const noteId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  const tone = request?.tone ?? 'default'
  const confirmVariant = TONE_CONFIRM_VARIANT[tone]
  const noteEnabled = Boolean(request?.note?.enabled)
  const noteRequired = Boolean(request?.note?.required)
  const noteLabel = request?.note?.label ?? 'Comments'
  const noteError = noteRequired && touched && !note.trim()
  const canConfirm = !noteRequired || Boolean(note.trim())

  useEffect(() => {
    if (!open || !request) return
    setNote(request.note?.defaultValue ?? '')
    setTouched(false)
    const t = window.setTimeout(() => {
      if (noteEnabled) textareaRef.current?.focus()
    }, 40)
    return () => window.clearTimeout(t)
  }, [open, request, noteEnabled])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canConfirm) {
        e.preventDefault()
        onConfirm(note.trim())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel, onConfirm, note, canConfirm])

  if (!open || !request) return null

  const confirmLabel = request.confirmLabel ?? 'Confirm'
  const cancelLabel = request.cancelLabel ?? 'Cancel'

  return (
    <div
      className="erp-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={request.description ? descId : undefined}
    >
      <button type="button" className="erp-confirm-backdrop__scrim" aria-label="Dismiss" onClick={onCancel} />

      <div className={cn('erp-confirm-panel', tone !== 'default' && `erp-confirm-panel--${tone}`)}>
        <header className="erp-confirm-panel__header">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="erp-confirm-panel__title">
              {request.title}
            </h2>
            {request.description ? (
              <p id={descId} className="erp-confirm-panel__desc">
                {request.description}
              </p>
            ) : null}
          </div>
          <button type="button" className="erp-confirm-panel__close" onClick={onCancel} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        {(request.detail || noteEnabled) && (
          <div className="erp-confirm-panel__body">
            {request.detail ? <p className="erp-confirm-panel__detail">{request.detail}</p> : null}

            {noteEnabled ? (
              <div className="erp-confirm-panel__note">
                <label htmlFor={noteId} className="erp-confirm-panel__note-label">
                  {noteLabel}
                  {noteRequired ? <span className="erp-confirm-panel__req">Required</span> : null}
                </label>
                <textarea
                  ref={textareaRef}
                  id={noteId}
                  value={note}
                  rows={request.note?.rows ?? 4}
                  maxLength={request.note?.maxLength}
                  placeholder={request.note?.placeholder ?? 'Add a clear reason for the audit trail…'}
                  className={cn('erp-confirm-panel__textarea', noteError && 'erp-confirm-panel__textarea--error')}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => setTouched(true)}
                />
                <div className="erp-confirm-panel__note-meta">
                  {noteError ? (
                    <span className="erp-confirm-panel__error">Please enter comments to continue.</span>
                  ) : (
                    <span className="erp-confirm-panel__hint">Ctrl/⌘ + Enter to confirm</span>
                  )}
                  {request.note?.maxLength ? (
                    <span className="erp-confirm-panel__count">
                      {note.length}/{request.note.maxLength}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <footer className="erp-confirm-panel__footer">
          <ErpButtonGroup className="erp-confirm-panel__actions">
            <ErpButton type="button" variant="secondary" onClick={onCancel} autoFocus={!noteEnabled}>
              {cancelLabel}
            </ErpButton>
            <ErpButton
              type="button"
              variant={confirmVariant}
              disabled={!canConfirm}
              onClick={() => {
                setTouched(true)
                if (!canConfirm) return
                onConfirm(note.trim())
              }}
            >
              {confirmLabel}
            </ErpButton>
          </ErpButtonGroup>
        </footer>
      </div>
    </div>
  )
}
