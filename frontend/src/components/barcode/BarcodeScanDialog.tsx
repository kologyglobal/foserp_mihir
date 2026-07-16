import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ScanLine, X } from 'lucide-react'
import { cn } from '../../utils/cn'

interface BarcodeScanDialogProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  onSubmit: (scan: string) => Promise<{ ok: boolean; message?: string; error?: string }> | { ok: boolean; message?: string; error?: string }
  fields?: ReactNode
  submitLabel?: string
}

export function BarcodeScanDialog({
  open,
  title,
  description,
  onClose,
  onSubmit,
  fields,
  submitLabel = 'Process Scan',
}: BarcodeScanDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [scan, setScan] = useState('')
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setScan('')
      setStatus(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!scan.trim() || busy) return
    setBusy(true)
    setStatus(null)
    const result = await onSubmit(scan.trim())
    if (result.ok) {
      setStatus({ type: 'ok', text: result.message ?? 'Scan processed' })
      setScan('')
      inputRef.current?.focus()
    } else {
      setStatus({ type: 'err', text: result.error ?? 'Scan failed' })
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-erp-border bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-erp-border px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-erp-text">{title}</h2>
            {description && <p className="mt-1 text-sm text-erp-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-erp-surface">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {fields}
          <label className="block text-sm font-medium text-erp-text">
            Scan barcode or QR
            <div className="relative mt-1">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-erp-muted" />
              <input
                ref={inputRef}
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder="VT-ITM-… or paste QR JSON"
                className="w-full rounded border border-erp-border py-2 pl-10 pr-3 font-mono text-sm"
                autoComplete="off"
              />
            </div>
          </label>
          {status && (
            <p
              className={cn(
                'rounded px-3 py-2 text-sm',
                status.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800',
              )}
            >
              {status.text}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded border border-erp-border px-3 py-2 text-sm">
              Close
            </button>
            <button
              type="submit"
              disabled={busy || !scan.trim()}
              className="rounded bg-erp-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Processing…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
