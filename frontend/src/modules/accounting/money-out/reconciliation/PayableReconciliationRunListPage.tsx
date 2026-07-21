import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { listPayableReconciliationRuns } from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { PayableReconciliationRunDto } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { parseDecimal, payableReconciliationRunStatusTone, payableReconciliationStatusTone } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function PayableReconciliationRunListPage() {
  const perms = useMoneyOutPermissions()
  const [rows, setRows] = useState<PayableReconciliationRunDto[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listPayableReconciliationRuns({
        legalEntityId: resolveLegalEntityId(),
        page: 1,
        pageSize: 50,
      })
      setRows(res.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load reconciliation runs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canReconcileView) void load()
  }, [load, perms.canReconcileView])

  if (!perms.canReconcileView) {
    return (
      <MoneyOutWorkspaceShell title="Reconciliation runs">
        <p className="text-[13px] text-erp-muted">You do not have permission to view AP reconciliation runs.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Reconciliation runs">
        <p className="text-[13px] text-erp-muted">AP reconciliation requires API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Reconciliation runs"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Link to="/accounting/money-out/reconciliation" className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]">
            Dashboard
          </Link>
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No reconciliation runs.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-2 font-medium">As of</th>
                <th className="py-2 pr-2 font-medium">Run status</th>
                <th className="py-2 pr-2 font-medium">Outcome</th>
                <th className="py-2 pr-2 text-right font-medium">Variance</th>
                <th className="py-2 pr-2 font-medium">Exceptions</th>
                <th className="py-2 pr-2 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                  <td className="py-2 pr-2">
                    <Link to={`/accounting/money-out/reconciliation/runs/${r.id}`} className="text-erp-accent hover:underline">
                      {r.asOfDate}
                    </Link>
                    {r.isStale ? <span className="ml-2 text-[11px] text-amber-700">stale</span> : null}
                  </td>
                  <td className="py-2 pr-2">
                    <ErpStatusChip label={r.runStatus} tone={payableReconciliationRunStatusTone(r.runStatus)} />
                  </td>
                  <td className="py-2 pr-2">
                    {r.status ? (
                      <ErpStatusChip label={r.status} tone={payableReconciliationStatusTone(r.status)} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(r.variance))}</td>
                  <td className="py-2 pr-2">{r.exceptionCount}</td>
                  <td className="py-2 pr-2">{r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
