import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { listPayableOutstanding } from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { PayableOutstandingOpenItemDto } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { parseDecimal } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

function documentLink(row: PayableOutstandingOpenItemDto) {
  if (row.vendorInvoiceId) {
    return `/accounting/money-out/vendor-invoices/${row.vendorInvoiceId}`
  }
  if (row.vendorAdjustmentId) {
    return `/accounting/money-out/vendor-adjustments/${row.vendorAdjustmentId}`
  }
  return null
}

export function OutstandingPage() {
  const perms = useMoneyOutPermissions()
  const [rows, setRows] = useState<PayableOutstandingOpenItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listPayableOutstanding({
        legalEntityId: resolveLegalEntityId(),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(res.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load outstanding payables')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  if (!perms.canView) {
    return (
      <MoneyOutWorkspaceShell title="Outstanding">
        <p className="text-[13px] text-erp-muted">You do not have permission to view outstanding payables.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Outstanding">
        <p className="text-[13px] text-erp-muted">
          Outstanding payables require API mode (<code>VITE_USE_API=true</code>).
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Outstanding"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-9 min-w-[200px] text-[12px]"
            placeholder="Search document / vendor"
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
        <p className="text-[13px] text-erp-muted">No open payable items.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-2 font-medium">Document</th>
                <th className="py-2 pr-2 font-medium">Vendor</th>
                <th className="py-2 pr-2 font-medium">Due</th>
                <th className="py-2 pr-2 font-medium">Bucket</th>
                <th className="py-2 pr-2 text-right font-medium">Outstanding</th>
                <th className="py-2 pr-2 text-right font-medium">Days overdue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const href = documentLink(r)
                const label = r.documentNumber ?? r.supplierInvoiceNumber ?? '—'
                return (
                  <tr key={r.openItemId} className="border-b border-erp-border/60 hover:bg-slate-50">
                    <td className="py-2 pr-2">
                      {href ? (
                        <Link to={href} className="text-erp-accent hover:underline">
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <Link to={`/accounting/money-out/vendors/${r.vendorId}`} className="hover:underline">
                        {r.vendorName}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{r.dueDate ?? '—'}</td>
                    <td className="py-2 pr-2">{String(r.dueDateBucket).replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {formatCurrency(parseDecimal(r.outstandingAmount))}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.daysOverdue ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
