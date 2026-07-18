import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getReconciliation } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { ReceivableReconciliationDto } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

function reconTone(status: ReceivableReconciliationDto['status']) {
  if (status === 'MATCHED') return 'success' as const
  if (status === 'MISMATCH') return 'critical' as const
  return 'warning' as const
}

export function ReconciliationPage() {
  const perms = useMoneyInPermissions()
  const [data, setData] = useState<ReceivableReconciliationDto | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getReconciliation(resolveLegalEntityId()))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load reconciliation')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canReconcile) void load()
  }, [load, perms.canReconcile])

  if (!perms.canReconcile) {
    return (
      <MoneyInWorkspaceShell title="Reconciliation">
        <p className="text-[13px] text-erp-muted">You do not have permission to view AR reconciliation (finance.ar.reconcile.view).</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Reconciliation"
      commandBar={
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : !data ? (
        <p className="text-[13px] text-erp-muted">No reconciliation data.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ErpStatusChip label={data.status} tone={reconTone(data.status)} />
            <span className="text-[12px] text-erp-muted">As of {data.asOfDate}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-erp-border bg-slate-50 p-3">
              <p className="text-[11px] uppercase text-erp-muted">Subledger</p>
              <p className="text-[16px] font-semibold tabular-nums">{formatCurrency(parseDecimal(data.subledgerTotal))}</p>
            </div>
            <div className="rounded border border-erp-border bg-slate-50 p-3">
              <p className="text-[11px] uppercase text-erp-muted">GL control</p>
              <p className="text-[16px] font-semibold tabular-nums">{formatCurrency(parseDecimal(data.glTotal))}</p>
            </div>
            <div className="rounded border border-erp-border bg-slate-50 p-3">
              <p className="text-[11px] uppercase text-erp-muted">Variance</p>
              <p className="text-[16px] font-semibold tabular-nums">{formatCurrency(parseDecimal(data.variance))}</p>
            </div>
          </div>

          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">By receivable account</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-erp-border text-erp-muted">
                    <th className="py-2 pr-2">Account</th>
                    <th className="py-2 pr-2 text-right">Subledger</th>
                    <th className="py-2 pr-2 text-right">GL</th>
                    <th className="py-2 pr-2 text-right">Variance</th>
                    <th className="py-2">Matched</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a) => (
                    <tr key={a.receivableAccountId} className="border-b border-erp-border/60">
                      <td className="py-2 pr-2">
                        {a.accountCode} — {a.accountName}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(a.subledgerBalance))}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(a.glBalance))}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(a.variance))}</td>
                      <td className="py-2">{a.matched ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {data.exceptions.length > 0 && (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-rose-700">Exceptions</h3>
              <ul className="space-y-2">
                {data.exceptions.map((ex, i) => (
                  <li key={i} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900">
                    <strong>{ex.code}</strong> — {ex.message}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
