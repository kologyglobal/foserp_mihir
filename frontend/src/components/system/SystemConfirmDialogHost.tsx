import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, MessageSquareWarning } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { useConfirmDialogStore } from '@/store/confirmDialogStore'

/**
 * Global host for `systemConfirm` / `systemAlert` / `systemPrompt` — mount once next to ToastHost.
 */
export function SystemConfirmDialogHost() {
  const current = useConfirmDialogStore((s) => s.current)
  const closeConfirm = useConfirmDialogStore((s) => s.closeConfirm)
  const closePrompt = useConfirmDialogStore((s) => s.closePrompt)
  const [promptValue, setPromptValue] = useState('')
  const [promptError, setPromptError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!current) return
    if (current.kind === 'prompt') {
      setPromptValue(current.defaultValue ?? '')
      setPromptError('')
      const t = window.setTimeout(() => textareaRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [current])

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (current.kind === 'confirm') closeConfirm(false)
        else closePrompt(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, closeConfirm, closePrompt])

  if (!current) return null

  const isDanger = current.variant === 'danger'
  const dismiss = () => {
    if (current.kind === 'confirm') closeConfirm(false)
    else closePrompt(null)
  }

  const submitPrompt = () => {
    if (current.kind !== 'prompt') return
    const trimmed = promptValue.trim()
    if (current.required !== false && !trimmed) {
      setPromptError('Comments are required')
      textareaRef.current?.focus()
      return
    }
    closePrompt(trimmed)
  }

  return createPortal(
    <div
      className="erp-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss()
      }}
    >
      <div
        className="erp-modal-panel max-w-md"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="system-confirm-title"
        aria-describedby={current.description ? 'system-confirm-desc' : undefined}
      >
        <div className="flex items-start gap-3">
          {isDanger || current.kind === 'prompt' ? (
            <div
              className={
                isDanger
                  ? 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600'
                  : 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700'
              }
            >
              {isDanger ? (
                <AlertTriangle className="h-4 w-4" aria-hidden />
              ) : (
                <MessageSquareWarning className="h-4 w-4" aria-hidden />
              )}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 id="system-confirm-title" className="text-[16px] font-semibold text-erp-text">
              {current.title}
            </h2>
            {current.description ? (
              <p
                id="system-confirm-desc"
                className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-erp-muted"
              >
                {current.description}
              </p>
            ) : null}
          </div>
        </div>

        {current.kind === 'prompt' ? (
          <div className="mt-4">
            <label
              htmlFor="system-prompt-field"
              className="mb-1.5 block text-[12px] font-semibold text-erp-text"
            >
              {current.fieldLabel ?? 'Comments'}
              {current.required !== false ? (
                <span className="ml-0.5 text-red-600" aria-hidden>
                  *
                </span>
              ) : null}
            </label>
            <textarea
              id="system-prompt-field"
              ref={textareaRef}
              className="erp-input min-h-[96px] w-full resize-y px-3 py-2 text-[13px] leading-relaxed"
              value={promptValue}
              placeholder={current.placeholder ?? 'Enter comments…'}
              rows={4}
              aria-invalid={Boolean(promptError)}
              aria-describedby={promptError ? 'system-prompt-error' : undefined}
              onChange={(e) => {
                setPromptValue(e.target.value)
                if (promptError) setPromptError('')
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  submitPrompt()
                }
              }}
            />
            {promptError ? (
              <p id="system-prompt-error" className="mt-1.5 text-[12px] text-red-600" role="alert">
                {promptError}
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-erp-muted">Ctrl+Enter to submit</p>
            )}
          </div>
        ) : null}

        <ErpButtonGroup className="mt-5 justify-end">
          {current.kind === 'confirm' && current.alertOnly ? (
            <ErpButton type="button" variant="primary" onClick={() => closeConfirm(true)} autoFocus>
              {current.confirmLabel}
            </ErpButton>
          ) : current.kind === 'confirm' ? (
            <>
              <ErpButton type="button" variant="secondary" onClick={() => closeConfirm(false)} autoFocus>
                {current.cancelLabel}
              </ErpButton>
              <ErpButton
                type="button"
                variant={isDanger ? 'danger' : 'primary'}
                onClick={() => closeConfirm(true)}
              >
                {current.confirmLabel}
              </ErpButton>
            </>
          ) : (
            <>
              <ErpButton type="button" variant="secondary" onClick={() => closePrompt(null)}>
                {current.cancelLabel}
              </ErpButton>
              <ErpButton
                type="button"
                variant={isDanger ? 'danger' : 'primary'}
                onClick={submitPrompt}
              >
                {current.confirmLabel}
              </ErpButton>
            </>
          )}
        </ErpButtonGroup>
      </div>
    </div>,
    document.body,
  )
}
