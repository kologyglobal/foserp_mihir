import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import type { PayableInvoice, PaymentAllocationLine } from '@/types/payables'

export type PayableAutoAllocationMethod =
  | 'Oldest Due First'
  | 'Oldest Invoice First'
  | 'Exact Amount Match'
  | 'Largest Outstanding First'
  | 'User Priority'

export const PAYABLE_AUTO_ALLOCATION_METHODS: PayableAutoAllocationMethod[] = [
  'Oldest Due First',
  'Oldest Invoice First',
  'Exact Amount Match',
  'Largest Outstanding First',
  'User Priority',
]

export interface PayableAutoAllocationPreview {
  method: PayableAutoAllocationMethod
  invoiceCount: number
  totalAllocated: number
  remainingAmount: number
  proposedLines: PaymentAllocationLine[]
}

function buildPreview(
  invoices: PayableInvoice[],
  availableAmount: number,
  method: PayableAutoAllocationMethod,
): PayableAutoAllocationPreview {
  let sorted = [...invoices].filter((i) => i.outstandingBalance > 0 && i.status !== 'Cancelled')
  if (method === 'Oldest Due First') {
    sorted.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  } else if (method === 'Oldest Invoice First') {
    sorted.sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate))
  } else if (method === 'Largest Outstanding First') {
    sorted.sort((a, b) => b.outstandingBalance - a.outstandingBalance)
  } else if (method === 'Exact Amount Match') {
    sorted = sorted.filter((i) => Math.abs(i.outstandingBalance - availableAmount) < 0.01)
  }

  let remaining = availableAmount
  const proposedLines: PaymentAllocationLine[] = []

  for (const inv of sorted) {
    if (remaining <= 0) break
    const amount = Math.min(inv.outstandingBalance, remaining)
    if (amount <= 0) continue
    remaining -= amount
    proposedLines.push({
      id: `preview-${inv.id}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      originalAmount: inv.originalAmount,
      previousAllocation: inv.paidAmount,
      outstandingBalance: inv.outstandingBalance,
      overdueDays: inv.overdueDays,
      tdsDeducted: 0,
      allocationAmount: amount,
      remainingBalance: inv.outstandingBalance - amount,
      status: inv.status,
    })
  }

  return {
    method,
    invoiceCount: proposedLines.length,
    totalAllocated: availableAmount - remaining,
    remainingAmount: remaining,
    proposedLines,
  }
}

const inputCls =
  'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
const labelCls = 'block text-[12px] font-medium text-erp-text'

export function AutoAllocationPreviewModal({
  open,
  onClose,
  invoices,
  availableAmount,
  onApply,
}: {
  open: boolean
  onClose: () => void
  invoices: PayableInvoice[]
  availableAmount: number
  onApply: (lines: PaymentAllocationLine[]) => void
}) {
  const [method, setMethod] = useState<PayableAutoAllocationMethod>('Oldest Due First')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const preview = useMemo(() => {
    if (!open || !(availableAmount > 0)) return null
    return buildPreview(invoices, availableAmount, method)
  }, [open, invoices, availableAmount, method])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="Close dialog" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payable-auto-allocation-title"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-erp-border bg-white shadow-xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-erp-border px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-erp-muted">Payables · Allocation</p>
            <h2 id="payable-auto-allocation-title" className="text-[15px] font-semibold text-erp-text">
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
              onChange={(e) => setMethod(e.target.value as PayableAutoAllocationMethod)}
            >
              {PAYABLE_AUTO_ALLOCATION_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          {preview ? (
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
                Demo mode — allocation is not posted until you apply and save the payment.
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-[13px] text-erp-muted">Enter a payment amount to preview allocation.</p>
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
