import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { BudgetingShell } from '@/components/accounting/budgeting'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  applyRollingMethod,
  listRollingForecast,
  updateRollingMonth,
} from '@/services/accounting/budgetingService'
import type { ForecastMethod, FyMonth, RollingForecastRow } from '@/types/budgeting'
import { FORECAST_METHOD_LABELS, FY_MONTHS } from '@/types/budgeting'
import { useBudgetingPermissions } from '@/utils/permissions/budgeting'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const METHODS = Object.keys(FORECAST_METHOD_LABELS) as ForecastMethod[]

export function RollingForecastPage() {
  const perms = useBudgetingPermissions()
  const [rows, setRows] = useState<RollingForecastRow[]>([])
  const [method, setMethod] = useState<ForecastMethod>('manual')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listRollingForecast())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onMethod = async (next: ForecastMethod) => {
    setMethod(next)
    const res = await applyRollingMethod(next)
    setRows(res.rows)
    if (!res.ok) notify.info(res.message)
    else notify.success(res.message)
  }

  const onCell = async (rowId: string, month: FyMonth, value: number) => {
    if (!perms.canEdit) return
    try {
      const updated = await updateRollingMonth(rowId, month, value)
      setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)))
      setMethod('manual')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <BudgetingShell
      title="Rolling Forecast"
      description="Completed months = actual (locked); future = forecast. Non-manual methods are placeholders."
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'r', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-semibold text-erp-muted">
          Method
          <select
            className="ml-1 rounded border border-erp-border px-2 py-1 text-[12px]"
            value={method}
            onChange={(e) => void onMethod(e.target.value as ForecastMethod)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {FORECAST_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        {method !== 'manual' ? (
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-950">
            Engine placeholder — switch to Manual to edit cells.
          </span>
        ) : null}
      </div>

      {loading ? <LoadingState /> : null}
      {!loading ? (
        <div className="overflow-x-auto rounded border border-erp-border">
          <table className="min-w-max text-left text-[11px]">
            <thead className="bg-erp-surface text-[10px] uppercase text-erp-muted">
              <tr>
                <th className="px-2 py-1.5">Account</th>
                {FY_MONTHS.map((m) => (
                  <th key={m} className="px-1 py-1.5 text-right">
                    {m}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right">Full year</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border">
                  <td className="px-2 py-1 whitespace-nowrap">
                    <div className="font-medium">{row.accountCode}</div>
                    <div className="text-erp-muted">{row.accountName}</div>
                  </td>
                  {FY_MONTHS.map((m) => {
                    const isActual = row.monthIsActual[m]
                    return (
                      <td key={m} className="px-0.5 py-0.5">
                        <input
                          type="number"
                          title={isActual ? 'Actual (locked)' : 'Forecast'}
                          className={cn(
                            'w-[4.5rem] rounded border px-1 py-0.5 text-right focus:outline-none',
                            isActual
                              ? 'border-transparent bg-slate-50 text-erp-muted'
                              : 'border-transparent hover:border-erp-border focus:border-erp-primary',
                          )}
                          value={row.months[m]}
                          disabled={isActual || !perms.canEdit || method !== 'manual'}
                          onChange={(e) => void onCell(row.id, m, Number(e.target.value) || 0)}
                        />
                      </td>
                    )
                  })}
                  <td className="px-2 py-1 text-right font-semibold">{formatCurrency(row.fullYear)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </BudgetingShell>
  )
}
