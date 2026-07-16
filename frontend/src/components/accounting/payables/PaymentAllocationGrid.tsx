import { useMemo } from 'react'
import { TableLink } from '@/components/ui/AppLink'
import { Input } from '@/components/forms/Inputs'
import { formatCurrency } from '@/utils/formatters/currency'
import { PayableInvoiceStatusBadge } from './PayableStatusBadge'
import type { PayableInvoice } from '@/types/payables'
import { cn } from '@/utils/cn'

export type PaymentAllocationMap = Record<string, number>

export function PaymentAllocationGrid({
  invoices,
  allocations,
  availableAmount,
  onChange,
  readOnly,
  search,
  selectedIds,
  onToggleSelect,
}: {
  invoices: PayableInvoice[]
  allocations: PaymentAllocationMap
  availableAmount: number
  onChange?: (invoiceId: string, amount: number) => void
  readOnly?: boolean
  search?: string
  selectedIds?: Set<string>
  onToggleSelect?: (invoiceId: string, selected: boolean) => void
}) {
  const filtered = useMemo(() => {
    const q = (search ?? '').trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter((i) =>
      `${i.invoiceNumber} ${i.poNumber ?? ''} ${i.reference ?? ''}`.toLowerCase().includes(q),
    )
  }, [invoices, search])

  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (v || 0), 0),
    [allocations],
  )

  const remaining = Math.max(0, availableAmount - totalAllocated)
  const showSelect = Boolean(onToggleSelect)

  return (
    <div className="overflow-x-auto rounded-lg border border-erp-border">
      <table className="erp-table w-full min-w-[960px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
            {showSelect ? <th className="px-3 py-2 font-semibold">Select</th> : null}
            <th className="px-3 py-2 font-semibold">Invoice</th>
            <th className="px-3 py-2 font-semibold">Due date</th>
            <th className="px-3 py-2 text-right font-semibold">Outstanding</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 text-right font-semibold">Allocate</th>
            <th className="px-3 py-2 text-right font-semibold">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((inv) => {
            const alloc = allocations[inv.id] ?? 0
            const maxForInvoice = inv.outstandingBalance
            const maxForPayment = remaining + alloc
            const cap = Math.min(maxForInvoice, maxForPayment)
            const after = inv.outstandingBalance - alloc
            const overInvoice = alloc > maxForInvoice + 0.001
            const overPayment = totalAllocated > availableAmount + 0.001
            const selected = selectedIds?.has(inv.id) ?? false
            return (
              <tr key={inv.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                {showSelect ? (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-erp-border"
                      checked={selected}
                      onChange={(e) => onToggleSelect?.(inv.id, e.target.checked)}
                      aria-label={`Select ${inv.invoiceNumber}`}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  <TableLink to={`/accounting/payables/invoices/${inv.id}`}>{inv.invoiceNumber}</TableLink>
                  <p className="text-[11px] text-erp-muted">{inv.invoiceDate}</p>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {inv.dueDate}
                  {inv.overdueDays > 0 ? (
                    <span className="ml-1 text-[10px] font-semibold text-rose-700">{inv.overdueDays}d overdue</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(inv.outstandingBalance)}</td>
                <td className="px-3 py-2">
                  <PayableInvoiceStatusBadge status={inv.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  {readOnly ? (
                    <span className="tabular-nums">{alloc > 0 ? formatCurrency(alloc) : '—'}</span>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={cap}
                      step="0.01"
                      value={alloc || ''}
                      onChange={(e) => {
                        const raw = Number(e.target.value)
                        const next = Number.isFinite(raw) ? Math.min(Math.max(0, raw), cap) : 0
                        onChange?.(inv.id, next)
                      }}
                      className={cn(
                        'ml-auto h-8 w-28 text-right tabular-nums',
                        (overInvoice || overPayment) && 'ring-2 ring-rose-300',
                      )}
                      aria-label={`Allocate to ${inv.invoiceNumber}`}
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-erp-muted">
                  {formatCurrency(Math.max(0, after))}
                </td>
              </tr>
            )
          })}
        </tbody>
        {!readOnly ? (
          <tfoot>
            <tr className="bg-erp-surface-alt/50 font-semibold">
              <td colSpan={showSelect ? 5 : 4} className="px-3 py-2 text-right">
                Totals
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totalAllocated)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-erp-muted">
                {formatCurrency(remaining)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-erp-muted">No outstanding invoices match your search.</p>
      ) : null}
    </div>
  )
}
