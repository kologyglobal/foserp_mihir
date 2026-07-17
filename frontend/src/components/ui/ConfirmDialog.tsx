import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, MessageSquareText, X } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { cn } from '../../utils/cn'
import type { ConfirmDialogRequest, ConfirmDialogTone } from '../../store/confirmDialogStore'

const TONE_META: Record<
  ConfirmDialogTone,
  {
    icon: typeof Info
    iconWrap: string
    confirmVariant: 'primary' | 'danger' | 'success' | 'warning'
  }
> = {
  default: {
    icon: Info,
    iconWrap: 'bg-erp-primary-soft text-erp-primary',
    confirmVariant: 'primary',
  },
  danger: {
    icon: AlertTriangle,
    iconWrap: 'bg-red-50 text-red-600',
    confirmVariant: 'danger',
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: 'bg-amber-50 text-amber-700',
    confirmVariant: 'warning',
  },
  success: {
    icon: CheckCircle2,
    iconWrap: 'bg-emerald-50 text-emerald-700',
    confirmVariant: 'success',
  },
}

export type ConfirmDialogProps = {
  open: boolean
  request: ConfirmDialogRequest | null
  onCancel: () => void
  onConfirm: (note: string) => void
}

export function ConfirmDialog({ open, request, onCancel, onConfirm }: ConfirmDialogProps) {
  const titleId = useId()
  const descId = useId()
  const noteId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  const tone = request?.tone ?? 'default'
  const meta = TONE_META[tone]
  const Icon = request?.note?.enabled ? MessageSquareText : meta.icon
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

      <div className="erp-confirm-panel">
        <div className="erp-confirm-panel__top">
          <div className={cn('erp-confirm-panel__icon', meta.iconWrap)}>
            <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="erp-confirm-panel__title">
              {request.title}
            </h2>
            {request.description ? (
              <p id={descId} className="erp-confirm-panel__desc">
                {request.description}
              </p>
            ) : null}
            {request.detail ? <p className="erp-confirm-panel__detail">{request.detail}</p> : null}
          </div>
          <button type="button" className="erp-confirm-panel__close" onClick={onCancel} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

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

        <ErpButtonGroup className="erp-confirm-panel__actions">
          <ErpButton type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </ErpButton>
          <ErpButton
            type="button"
            variant={meta.confirmVariant}
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
      </div>
    </div>
  )
}
