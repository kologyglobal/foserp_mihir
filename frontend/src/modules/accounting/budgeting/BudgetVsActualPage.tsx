import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { BudgetingShell } from '@/components/accounting/budgeting'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listBudgetVsActual } from '@/services/accounting/budgetingService'
import type { BudgetVsActualRow, BvaDimension, BvaPeriodView } from '@/types/budgeting'
import { formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'

const DIMENSIONS: { id: BvaDimension; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'department', label: 'Department' },
  { id: 'cost_centre', label: 'Cost centre' },
  { id: 'plant', label: 'Plant' },
  { id: 'project', label: 'Project' },
]

const PERIODS: { id: BvaPeriodView; label: string }[] = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'ytd', label: 'YTD' },
]

export function BudgetVsActualPage() {
  const [dimension, setDimension] = useState<BvaDimension>('account')
  const [period, setPeriod] = useState<BvaPeriodView>('ytd')
  const [rows, setRows] = useState<BudgetVsActualRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listBudgetVsActual(dimension))
    } finally {
      setLoading(false)
    }
  }, [dimension])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <BudgetingShell
      title="Budget vs Actual"
      description="Multi-dimension variance — Actual → Ledger, Committed → Purchase."
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'r', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {DIMENSIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDimension(d.id)}
            className={cn(
              'rounded border px-2 py-1 text-[11px] font-semibold',
              dimension === d.id
                ? 'border-erp-primary bg-erp-primary/10 text-erp-primary'
                : 'border-erp-border text-erp-muted',
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={cn(
              'rounded border px-2 py-1 text-[11px] font-semibold',
              period === p.id
                ? 'border-erp-primary bg-erp-primary/10 text-erp-primary'
                : 'border-erp-border text-erp-muted',
            )}
          >
            {p.label}
          </button>
        ))}
        <span className="self-center text-[11px] text-erp-muted">
          Period view is UI-only in demo ({period}).
        </span>
      </div>

      {loading ? <LoadingState /> : null}
      {!loading ? (
        <div className="overflow-x-auto rounded border border-erp-border">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
              <tr>
                <th className="px-2 py-2">Label</th>
                <th className="px-2 py-2 text-right">Budget</th>
                <th className="px-2 py-2 text-right">Committed</th>
                <th className="px-2 py-2 text-right">Actual</th>
                <th className="px-2 py-2 text-right">Available</th>
                <th className="px-2 py-2 text-right">Variance</th>
                <th className="px-2 py-2 text-right">Forecast</th>
                <th className="px-2 py-2 text-right">Proj YE var</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-erp-border hover:bg-erp-surface/40">
                  <td className="px-2 py-2">
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[10px] text-erp-muted">{r.code}</div>
                  </td>
                  <td className="px-2 py-2 text-right">{formatCurrency(r.budget)}</td>
                  <td className="px-2 py-2 text-right">
                    <Link className="text-erp-primary hover:underline" to="/purchase/orders">
                      {formatCurrency(r.committed)}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link
                      className="text-erp-primary hover:underline"
                      to={`/accounting/ledger-entries?hint=${encodeURIComponent(r.code || r.label)}`}
                    >
                      {formatCurrency(r.actual)}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right">{formatCurrency(r.available)}</td>
                  <td className={cn('px-2 py-2 text-right', r.variance < 0 && 'text-rose-700')}>
                    {formatCurrency(r.variance)} ({r.variancePct}%)
                  </td>
                  <td className="px-2 py-2 text-right">{formatCurrency(r.forecast)}</td>
                  <td className="px-2 py-2 text-right">{formatCurrency(r.projectedYearEndVariance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </BudgetingShell>
  )
}
