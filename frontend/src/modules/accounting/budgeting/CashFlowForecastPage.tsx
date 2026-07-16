import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { BudgetingShell } from '@/components/accounting/budgeting'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getCashFlowForecast } from '@/services/accounting/budgetingService'
import type { CashFlowSummary, CashFlowView } from '@/types/budgeting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'

const VIEWS: { id: CashFlowView; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'thirteen_week', label: '13-week' },
]

export function CashFlowForecastPage() {
  const [view, setView] = useState<CashFlowView>('monthly')
  const [data, setData] = useState<CashFlowSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getCashFlowForecast(view))
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <BudgetingShell
      title="Cash Flow Forecast"
      description="Opening → receipts / outflows → closing with surplus / shortfall chips."
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'r', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="mb-3 flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={cn(
              'rounded border px-2.5 py-1 text-[11px] font-semibold',
              view === v.id
                ? 'border-erp-primary bg-erp-primary/10 text-erp-primary'
                : 'border-erp-border text-erp-muted hover:bg-erp-surface',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {data ? (
        <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
            Surplus {formatCompactCurrency(data.surplus)}
          </span>
          <span className="rounded bg-rose-50 px-2 py-1 font-semibold text-rose-800">
            Shortfall {formatCompactCurrency(data.shortfall)}
          </span>
          <span className="rounded bg-amber-50 px-2 py-1 font-semibold text-amber-900">
            Threshold {formatCompactCurrency(data.minimumCashThreshold)}
          </span>
          <span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-800">
            Funding need {formatCompactCurrency(data.fundingRequirement)}
          </span>
        </div>
      ) : null}

      {loading ? <LoadingState /> : null}
      {!loading && data ? (
        <div className="overflow-x-auto rounded border border-erp-border">
          <table className="min-w-max text-left text-[11px]">
            <thead className="bg-erp-surface text-[10px] uppercase text-erp-muted">
              <tr>
                <th className="px-2 py-2">Period</th>
                <th className="px-2 py-2 text-right">Opening</th>
                <th className="px-2 py-2 text-right">Receipts</th>
                <th className="px-2 py-2 text-right">Vendor</th>
                <th className="px-2 py-2 text-right">Payroll</th>
                <th className="px-2 py-2 text-right">GST/TDS</th>
                <th className="px-2 py-2 text-right">Loans</th>
                <th className="px-2 py-2 text-right">CAPEX</th>
                <th className="px-2 py-2 text-right">OpEx</th>
                <th className="px-2 py-2 text-right">Other in</th>
                <th className="px-2 py-2 text-right">Other out</th>
                <th className="px-2 py-2 text-right">Closing</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-erp-border">
                  <td className="px-2 py-1.5 font-medium">{r.periodLabel}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(r.opening)}</td>
                  <td className="px-2 py-1.5 text-right text-emerald-800">{formatCurrency(r.customerReceipts)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(r.vendorPayments)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(r.payroll)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <Link className="text-erp-primary hover:underline" to="/accounting/tax-compliance">
                      {formatCurrency(r.gstTds)}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(r.loanRepayments)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(r.capex)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(r.operatingExpenses)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(r.otherInflows)}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(r.otherOutflows)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(r.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </BudgetingShell>
  )
}
