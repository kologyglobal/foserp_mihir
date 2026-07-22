import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listOutstanding } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { OutstandingOpenItemDto } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { moneyInPath, parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

/** Thin collections worklist — open outstanding posted invoices for follow-up and receipt allocation. */
export function CollectionsPage() {
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<OutstandingOpenItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listOutstanding({
        legalEntityId: resolveLegalEntityId(),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(res.items.filter((r) => parseDecimal(r.outstandingAmount) > 0))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load collections worklist')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const summary = useMemo(() => {
    const overdue = rows.filter((r) => (r.daysOverdue ?? 0) > 0)
    return {
      count: rows.length,
      total: rows.reduce((s, r) => s + parseDecimal(r.outstandingAmount), 0),
      overdueCount: overdue.length,
      overdueTotal: overdue.reduce((s, r) => s + parseDecimal(r.outstandingAmount), 0),
    }
  }, [rows])

  if (!perms.canView) {
    return (
      <MoneyInWorkspaceShell title="Collections">
        <p className="text-[13px] text-erp-muted">You do not have permission to view the collections worklist.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Collections"
      description="Open receivable balances — view invoice detail or record a receipt to allocate."
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-9 min-w-[200px] text-[12px]"
            placeholder="Search invoice / customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded border border-erp-border bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase text-erp-muted">Open items</p>
          <p className="text-[18px] font-semibold tabular-nums">{summary.count}</p>
        </div>
        <div className="rounded border border-erp-border bg-slate-50 px-3 py-2">
          <p className="text-[11px] uppercase text-erp-muted">Total outstanding</p>
          <p className="text-[18px] font-semibold tabular-nums">{formatCurrency(summary.total)}</p>
        </div>
        <div className="rounded border border-rose-100 bg-rose-50/60 px-3 py-2">
          <p className="text-[11px] uppercase text-erp-muted">Overdue subset</p>
          <p className="text-[18px] font-semibold tabular-nums">
            {summary.overdueCount} · {formatCurrency(summary.overdueTotal)}
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No open receivable items for collection.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-2 font-medium">Invoice</th>
                <th className="py-2 pr-2 font-medium">Customer</th>
                <th className="py-2 pr-2 font-medium">Due</th>
                <th className="py-2 pr-2 text-right font-medium">Outstanding</th>
                <th className="py-2 pr-2 text-right font-medium">Days overdue</th>
                <th className="py-2 pr-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.openItemId} className="border-b border-erp-border/60 hover:bg-slate-50">
                  <td className="py-2 pr-2">
                    {r.salesInvoiceId ? (
                      <Link
                        to={moneyInPath(`invoices/${r.salesInvoiceId}`)}
                        className="font-medium text-erp-accent hover:underline"
                      >
                        {r.invoiceNumber ?? '—'}
                      </Link>
                    ) : (
                      r.invoiceNumber ?? '—'
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <Link to={moneyInPath(`customers/${r.customerId}`)} className="hover:underline">
                      {r.customerName}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{r.dueDate ?? '—'}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(r.outstandingAmount))}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {(r.daysOverdue ?? 0) > 0 ? (
                      <span className="font-medium text-rose-600">{r.daysOverdue}d</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex flex-wrap gap-1">
                      {r.salesInvoiceId && (
                        <Link to={moneyInPath(`invoices/${r.salesInvoiceId}`)}>
                          <ErpButton variant="ghost" size="sm">
                            Invoice
                          </ErpButton>
                        </Link>
                      )}
                      <Link to={moneyInPath('receipts')}>
                        <ErpButton variant="ghost" size="sm">
                          Receipts
                        </ErpButton>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
