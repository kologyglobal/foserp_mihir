import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import type { AccountingVoucher } from '@/types/vouchers'
import { VOUCHER_DOCUMENT_TYPE_LABELS } from '@/types/vouchers'

export function VoucherPostingPreviewModal({
  open,
  voucher,
  onClose,
  onConfirmPost,
  busy,
}: {
  open: boolean
  voucher: AccountingVoucher | null
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

  if (!open || !voucher) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-post-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-erp-border bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-erp-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-erp-muted">Posting preview</p>
            <h2 id="voucher-post-title" className="text-[15px] font-semibold text-erp-text">
              {voucher.voucherNumber}
            </h2>
            <p className="text-[12px] text-erp-muted">
              {VOUCHER_DOCUMENT_TYPE_LABELS[voucher.voucherType]} · Demo only — no real GL posting
            </p>
          </div>
          <button type="button" className="rounded p-1.5 text-erp-muted hover:bg-erp-surface-alt" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">
            Confirming Post will set status to Posted in this demo session. Ledger, bank, GST and TDS are not updated.
          </p>
          <table className="erp-table w-full text-[13px]">
            <thead>
              <tr className="border-b border-erp-border text-left text-[11px] uppercase text-erp-muted">
                <th className="py-2">Account</th>
                <th className="py-2 text-right">Debit</th>
                <th className="py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {voucher.lines.map((l) => (
                <tr key={l.id} className="border-b border-erp-border/70">
                  <td className="py-1.5">
                    <span className="font-medium tabular-nums">{l.accountCode}</span> {l.accountName}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{l.debit ? formatCurrency(l.debit) : '—'}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.credit ? formatCurrency(l.credit) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2">Totals</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(voucher.totalDebit)}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(voucher.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <footer className="flex justify-end gap-2 border-t border-erp-border bg-erp-surface px-4 py-3">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
            onClick={onConfirmPost}
            disabled={busy || !voucher.isBalanced}
          >
            {busy ? 'Posting…' : 'Confirm Post (Demo)'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

export function VoucherReversalModal({
  open,
  voucher,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean
  voucher: AccountingVoucher | null
  onClose: () => void
  onConfirm: (reason: string) => void
  busy?: boolean
}) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open])

  if (!open || !voucher) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-rev-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-erp-border bg-white shadow-xl"
      >
        <header className="border-b border-erp-border px-4 py-3">
          <h2 id="voucher-rev-title" className="text-[15px] font-semibold text-erp-text">
            Reverse voucher
          </h2>
          <p className="text-[12px] text-erp-muted">{voucher.voucherNumber} — demo reversal creates an offsetting voucher</p>
        </header>
        <div className="space-y-3 px-4 py-3">
          <p className="text-[12px] text-erp-muted">
            Original totals: Dr {formatCurrency(voucher.totalDebit)} / Cr {formatCurrency(voucher.totalCredit)}
          </p>
          <label className="block text-[12px] font-medium text-erp-text">
            Reason <span className="text-red-600">*</span>
            <textarea
              className="mt-1 w-full rounded-md border border-erp-border px-3 py-2 text-[13px]"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this voucher being reversed?"
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-erp-border px-4 py-3">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
            disabled={busy || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? 'Reversing…' : 'Create reversal'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
