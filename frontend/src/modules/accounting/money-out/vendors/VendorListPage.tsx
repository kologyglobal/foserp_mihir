import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { listVendorPayableSummaries } from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { VendorPayableDetailDto } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { parseDecimal } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function VendorListPage() {
  const perms = useMoneyOutPermissions()
  const [rows, setRows] = useState<VendorPayableDetailDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listVendorPayableSummaries({
        legalEntityId: resolveLegalEntityId(),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(res.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load vendors')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  if (!perms.canView) {
    return (
      <MoneyOutWorkspaceShell title="Vendors">
        <p className="text-[13px] text-erp-muted">You do not have permission to view vendor payables.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Vendors">
        <p className="text-[13px] text-erp-muted">
          Vendor payables require API mode (<code>VITE_USE_API=true</code>).
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Vendors"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-9 min-w-[200px] text-[12px]"
            placeholder="Search vendor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No vendors with open payables.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-2 font-medium">Vendor</th>
                <th className="py-2 pr-2 text-right font-medium">Open items</th>
                <th className="py-2 pr-2 text-right font-medium">Outstanding</th>
                <th className="py-2 pr-2 font-medium">Oldest due</th>
                <th className="py-2 pr-2 text-right font-medium">Max overdue days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vendorId} className="border-b border-erp-border/60 hover:bg-slate-50">
                  <td className="py-2 pr-2">
                    <Link
                      to={`/accounting/money-out/vendors/${r.vendorId}`}
                      className="font-medium text-erp-accent hover:underline"
                    >
                      {r.vendorName ?? r.vendorCode}
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
    </MoneyOutWorkspaceShell>
  )
}
