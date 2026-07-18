import { useCallback, useEffect, useState } from 'react'
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
import { parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

export function OutstandingPage() {
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
      setRows(res.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load outstanding')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  if (!perms.canView) {
    return (
      <MoneyInWorkspaceShell title="Outstanding">
        <p className="text-[13px] text-erp-muted">You do not have permission to view outstanding receivables.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Outstanding"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Input className="h-9 min-w-[200px] text-[12px]" placeholder="Search invoice / customer" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No open items.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-2 font-medium">Invoice</th>
                <th className="py-2 pr-2 font-medium">Customer</th>
                <th className="py-2 pr-2 font-medium">Due</th>
                <th className="py-2 pr-2 font-medium">Bucket</th>
                <th className="py-2 pr-2 text-right font-medium">Outstanding</th>
                <th className="py-2 pr-2 text-right font-medium">Days overdue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.openItemId} className="border-b border-erp-border/60 hover:bg-slate-50">
                  <td className="py-2 pr-2">
                    {r.salesInvoiceId ? (
                      <Link to={`/accounting/money-in/invoices/${r.salesInvoiceId}`} className="text-erp-accent hover:underline">
                        {r.invoiceNumber ?? '—'}
                      </Link>
                    ) : (
                      r.invoiceNumber ?? '—'
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <Link to={`/accounting/money-in/customers/${r.customerId}`} className="hover:underline">
                      {r.customerName}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{r.dueDate ?? '—'}</td>
                  <td className="py-2 pr-2">{String(r.dueDateBucket).replace(/_/g, ' ')}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(r.outstandingAmount))}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.daysOverdue ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
