import { useEffect, useState } from 'react'
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
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setError(null)
    }
  }, [open, defaultName])

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-erp-border bg-erp-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-erp-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-erp-text">Save View</h2>
            <p className="mt-0.5 text-[12px] text-erp-muted">
              Saves current search and filters. Select the saved view from the View dropdown to restore them.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-erp-text">View name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null) }}
              className="erp-input h-9 w-full text-[13px]"
              placeholder="e.g. My Qualified Leads"
              autoFocus
            />
          </label>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm">Save View</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
