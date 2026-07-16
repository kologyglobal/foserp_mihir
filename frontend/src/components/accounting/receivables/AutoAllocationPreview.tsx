import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import {
  AUTO_ALLOCATION_METHODS,
  type AutoAllocationMethod,
  type AutoAllocationPreview,
  type ReceiptAllocationLine,
} from '@/types/receivables'
import {
  getReceiptAllocationPreviewByMethod,
  ReceivablesServiceError,
} from '@/services/accounting/receivablesService'
import { notify } from '@/store/toastStore'

const inputCls =
  'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
const labelCls = 'block text-[12px] font-medium text-erp-text'

export function AutoAllocationPreview({
  open,
  onClose,
  customerId,
  availableAmount,
  onApply,
}: {
  open: boolean
  onClose: () => void
  customerId: string
  availableAmount: number
  onApply: (lines: ReceiptAllocationLine[]) => void
}) {
  const [method, setMethod] = useState<AutoAllocationMethod>('Oldest Due First')
  const [preview, setPreview] = useState<AutoAllocationPreview | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !customerId || !(availableAmount > 0)) {
      setPreview(null)
      return
    }
    setLoading(true)
    void getReceiptAllocationPreviewByMethod(customerId, availableAmount, method)
      .then(setPreview)
      .catch((e) => {
        setPreview(null)
        notify.error(e instanceof ReceivablesServiceError ? e.message : 'Failed to load allocation preview.')
      })
      .finally(() => setLoading(false))
  }, [open, customerId, availableAmount, method])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="Close dialog" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-allocation-title"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-erp-border bg-white shadow-xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-erp-border px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-erp-muted">Receivables · Allocation</p>
            <h2 id="auto-allocation-title" className="text-[15px] font-semibold text-erp-text">
              Auto allocation preview
            </h2>
            <p className="mt-0.5 text-[12px] text-erp-muted">
              Available {formatCurrency(availableAmount)} · Review before applying (demo)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-erp-muted hover:bg-erp-surface-alt"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <label className={cn(labelCls, 'mb-4 max-w-xs')}>
            Allocation method
            <select
              className={inputCls}
              value={method}
              onChange={(e) => setMethod(e.target.value as AutoAllocationMethod)}
            >
              {AUTO_ALLOCATION_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          {loading ? (
            <p className="py-8 text-center text-[13px] text-erp-muted">Calculating proposed allocation…</p>
          ) : preview ? (
            <>
              <dl className="mb-3 grid grid-cols-2 gap-2 rounded-md border border-erp-border bg-erp-surface-alt/40 p-3 text-[12px] sm:grid-cols-4">
                <div>
                  <dt className="text-erp-muted">Invoices</dt>
                  <dd className="font-semibold text-erp-text">{preview.invoiceCount}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Allocated</dt>
                  <dd className="font-semibold tabular-nums text-erp-text">
                    {formatCurrency(preview.totalAllocated)}
                  </dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Remaining</dt>
                  <dd className="font-semibold tabular-nums text-erp-text">
                    {formatCurrency(preview.remainingAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Method</dt>
                  <dd className="font-semibold text-erp-text">{preview.method}</dd>
                </div>
              </dl>

              <div className="overflow-x-auto rounded-md border border-erp-border">
                <table className="erp-table w-full min-w-[560px] text-[12px]">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Due</th>
                      <th className="text-right">Outstanding</th>
                      <th className="text-right">Proposed</th>
                      <th className="text-right">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.proposedLines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-erp-muted">
                          No open invoices match this method.
                        </td>
                      </tr>
                    ) : (
                      preview.proposedLines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            <span className="font-mono">{line.invoiceNumber}</span>
                            <span className="ml-1 text-erp-muted">{formatDate(line.invoiceDate)}</span>
                          </td>
                          <td>{formatDate(line.dueDate)}</td>
                          <td className="text-right tabular-nums">{formatCurrency(line.outstandingBalance)}</td>
                          <td className="text-right tabular-nums font-medium text-erp-primary">
                            {formatCurrency(line.allocationAmount)}
                          </td>
                          <td className="text-right tabular-nums">{formatCurrency(line.remainingBalance)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-[11px] text-erp-muted">
                Demo mode — allocation is not posted until you apply and save the receipt.
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-[13px] text-erp-muted">Unable to load allocation preview.</p>
          )}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-erp-border bg-erp-surface px-4 py-3">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="erp-btn erp-btn-primary h-9 px-3 text-[13px] font-semibold"
            disabled={!preview?.proposedLines.length}
            onClick={() => {
              if (preview?.proposedLines.length) {
                onApply(preview.proposedLines)
                onClose()
              }
            }}
          >
            Apply allocation
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
