import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import type { PaymentPostingPreview } from '@/types/payables'

export function PaymentPostingPreviewModal({
  open,
  preview,
  onClose,
  onConfirmPost,
  busy,
}: {
  open: boolean
  preview: PaymentPostingPreview | null
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
        aria-labelledby="payment-post-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-erp-border bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-erp-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-erp-muted">Posting preview</p>
            <h2 id="payment-post-title" className="text-[15px] font-semibold text-erp-text">
              {preview.paymentNumber}
            </h2>
            <p className="text-[12px] text-erp-muted">
              {preview.vendorName} · Demo only — backend accounting posting is not connected
            </p>
          </div>
          <button type="button" className="rounded p-1.5 text-erp-muted hover:bg-erp-surface-alt" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">
            Confirming Post will mark this payment as Posted in demo mode. Vendor ledger, bank and GL are not updated.
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
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Payment amount</dt>
              <dd className="tabular-nums text-[13px] font-semibold">{formatCurrency(preview.paymentAmount)}</dd>
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
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Bank account</dt>
              <dd className="text-[13px]">{preview.bankAccountName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Vendor control</dt>
              <dd className="text-[13px]">{preview.vendorControlAccount}</dd>
            </div>
            {preview.tdsAmount > 0 ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase text-erp-muted">TDS</dt>
                <dd className="tabular-nums text-[13px]">{formatCurrency(preview.tdsAmount)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[11px] font-semibold uppercase text-erp-muted">Voucher</dt>
              <dd className="font-mono text-[13px]">{preview.voucherNumber}</dd>
            </div>
          </dl>

          {preview.lines.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-md border border-erp-border">
              <table className="erp-table w-full min-w-[480px] text-[12px]">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th>Narration</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((line, i) => (
                    <tr key={`${line.account}-${i}`}>
                      <td>{line.account}</td>
                      <td className="text-right tabular-nums">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                      <td className="text-right tabular-nums">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                      <td className="text-erp-muted">{line.narration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="mt-3 text-[11px] text-erp-muted">{preview.message}</p>
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
