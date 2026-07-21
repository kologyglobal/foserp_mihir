import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'

interface SaveViewDialogProps {
  open: boolean
  defaultName: string
  onClose: () => void
  onSave: (name: string) => { ok: boolean; error?: string }
}

/**
 * Save View — captures current filters/search under a named view.
 * User picks the name; view appears in the View dropdown on this page.
 */
export function SaveViewDialog({ open, defaultName, onClose, onSave }: SaveViewDialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(defaultName)
    setError(null)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, defaultName, onClose])

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = onSave(name)
    if (!result.ok) {
      setError(result.error ?? 'Could not save view')
      return
    }
  }

  return (
    <div
      className="erp-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="erp-modal-panel max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between border-b border-erp-border px-0 pb-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-erp-text">Save View</h2>
            <p className="mt-0.5 text-[12px] text-erp-muted">
              Saves current search and filters. Select the saved view from the View dropdown to restore them.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 pt-4">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-erp-text">View name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null) }}
              className="erp-input h-9 w-full text-[13px]"
              placeholder="e.g. My Qualified Leads"
            />
          </label>
          {error ? <p className="text-[12px] text-red-600" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm">Save View</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
