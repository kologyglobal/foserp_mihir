import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getAgeingReport } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { AgeingBasis, AgeingReportDto } from '@/types/moneyIn'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

export function AgeingPage() {
  const perms = useMoneyInPermissions()
  const [report, setReport] = useState<AgeingReportDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [basis, setBasis] = useState<AgeingBasis>('due_date')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setReport(await getAgeingReport({ legalEntityId: resolveLegalEntityId(), ageingBasis: basis }))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load ageing')
    } finally {
      setLoading(false)
    }
  }, [basis])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const chartData =
    report?.buckets.map((b) => ({
      name: String(b.bucket).replace(/_/g, ' '),
      amount: parseDecimal(b.baseOutstandingAmount),
      count: b.openItemCount,
    })) ?? []

  if (!perms.canView) {
    return (
      <MoneyInWorkspaceShell title="Ageing">
        <p className="text-[13px] text-erp-muted">You do not have permission to view ageing.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Ageing"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Select className="h-9 min-w-[160px] text-[12px]" value={basis} onChange={(e) => setBasis(e.target.value as AgeingBasis)}>
            <option value="due_date">Due date basis</option>
            <option value="invoice_age">Invoice age basis</option>
          </Select>
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="dashboard" />
      ) : !report ? (
        <p className="text-[13px] text-erp-muted">No ageing data.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-[12px] text-erp-muted">
            Report date: {report.reportDate} · Total outstanding:{' '}
            <strong>{formatCurrency(parseDecimal(report.totals.baseOutstandingAmount))}</strong> ({report.totals.openItemCount} items)
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                <Bar dataKey="amount" fill="var(--erp-accent, #0078d4)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border text-erp-muted">
                  <th className="py-2 pr-2">Bucket</th>
                  <th className="py-2 pr-2 text-right">Items</th>
                  <th className="py-2 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {report.buckets.map((b) => (
                  <tr key={String(b.bucket)} className="border-b border-erp-border/60">
                    <td className="py-2 pr-2">{String(b.bucket).replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{b.openItemCount}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(parseDecimal(b.baseOutstandingAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
