import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import type { ReceiptPostingPreview } from '@/types/receivables'

export function ReceiptPostingPreviewModal({
  open,
  preview,
  onClose,
  onConfirmPost,
  busy,
}: {
  open: boolean
  preview: ReceiptPostingPreview | null
  onClose: () => void
  onConfirmPost: () => void
  busy?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !preview) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-post-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-erp-border bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-erp-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-erp-muted">Posting preview</p>
            <h2 id="receipt-post-title" className="text-[15px] font-semibold text-erp-text">
              {preview.receiptNumber}
            </h2>
            <p className="text-[12px] text-erp-muted">
              {preview.customerName} · Demo only — backend accounting posting is not connected
            </p>
          </div>
          <button type="button" className="rounded p-1.5 text-erp-muted hover:bg-erp-surface-alt" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">
            Confirming Post will mark this receipt as Posted in demo mode. Customer ledger, bank and GL are not updated.
          </p>
          {preview.warnings.length > 0 ? (
            <ul className="mb-3 space-y-1 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-900 ring-1 ring-rose-200">
              {preview.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          ) : null}
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Receipt amount</dt>
              <dd className="tabular-nums text-[13px] font-semibold">{formatCurrency(preview.receiptAmount)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Allocated</dt>
              <dd className="tabular-nums text-[13px]">{formatCurrency(preview.allocatedAmount)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Unallocated</dt>
              <dd className="tabular-nums text-[13px]">{formatCurrency(preview.unallocatedAmount)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Posting date</dt>
              <dd className="tabular-nums text-[13px]">{preview.postingDate}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Bank / Cash</dt>
              <dd className="text-[13px]">{preview.bankOrCashAccountName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Customer control</dt>
              <dd className="text-[13px]">{preview.customerControlAccount}</dd>
            </div>
            {preview.tdsAmount > 0 ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase text-erp-muted">TDS</dt>
                <dd className="tabular-nums text-[13px]">{formatCurrency(preview.tdsAmount)}</dd>
              </div>
            ) : null}
            {preview.bankCharges > 0 ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase text-erp-muted">Bank charges</dt>
                <dd className="tabular-nums text-[13px]">{formatCurrency(preview.bankCharges)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <footer className="flex justify-end gap-2 border-t border-erp-border bg-erp-surface px-4 py-3">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" onClick={onConfirmPost} disabled={busy}>
            {busy ? 'Posting…' : 'Confirm Post (Demo)'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
