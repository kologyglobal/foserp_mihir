import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listCustomerSummaries } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { CustomerReceivableDetailDto } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

export function CustomerListPage() {
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<CustomerReceivableDetailDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listCustomerSummaries({
        legalEntityId: resolveLegalEntityId(),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(res.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  if (!perms.canView) {
    return (
      <MoneyInWorkspaceShell title="Customers">
        <p className="text-[13px] text-erp-muted">You do not have permission to view customer receivables.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Customers"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Input className="h-9 min-w-[200px] text-[12px]" placeholder="Search customer" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No customers with open receivables.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-2 font-medium">Customer</th>
                <th className="py-2 pr-2 text-right font-medium">Open items</th>
                <th className="py-2 pr-2 text-right font-medium">Outstanding</th>
                <th className="py-2 pr-2 font-medium">Oldest due</th>
                <th className="py-2 pr-2 text-right font-medium">Max overdue days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customerId} className="border-b border-erp-border/60 hover:bg-slate-50">
                  <td className="py-2 pr-2">
                    <Link to={`/accounting/money-in/customers/${r.customerId}`} className="font-medium text-erp-accent hover:underline">
                      {r.customerName ?? r.customerCode}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.openItemCount}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(r.outstandingAmount))}</td>
                  <td className="py-2 pr-2 tabular-nums">{r.oldestDueDate ?? '—'}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.maxDaysOverdue ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
