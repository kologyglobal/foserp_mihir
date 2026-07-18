import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, BarChart3, ListOrdered } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getAgeingReport, getReceivableOverview, listOutstanding } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { parseDecimal } from './moneyInUi'
import { AttentionPanel } from './components/AttentionPanel'
import { MoneyInWorkspaceShell } from './MoneyInWorkspaceShell'

export function MoneyInOverviewPage() {
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getReceivableOverview>> | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [ageingBuckets, setAgeingBuckets] = useState<Array<{ name: string; amount: number }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const leId = resolveLegalEntityId()
      const [ov, ageing, outstanding] = await Promise.all([
        getReceivableOverview(leId),
        getAgeingReport({ legalEntityId: leId, ageingBasis: 'due_date' }),
        listOutstanding({ legalEntityId: leId }),
      ])
      setOverview(ov)
      setOverdueCount(outstanding.items.filter((o) => (o.daysOverdue ?? 0) > 0).length)
      setAgeingBuckets(
        ageing.buckets.map((b) => ({
          name: String(b.bucket).replace(/_/g, ' '),
          amount: parseDecimal(b.baseOutstandingAmount),
        })),
      )
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load overview')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const kpis = useMemo(() => {
    if (!overview) return []
    return [
      { label: 'Outstanding', value: formatCompactCurrency(parseDecimal(overview.totals.baseOutstandingAmount)) },
      { label: 'Open items', value: String(overview.totals.openItemCount) },
      { label: 'Customers', value: String(overview.totals.customerCount) },
      { label: 'Ready to post', value: String(overview.readyToPostCount) },
    ]
  }, [overview])

  if (!perms.canView) {
    return (
      <MoneyInWorkspaceShell title="Overview">
        <p className="text-[13px] text-erp-muted">You do not have permission to view Money In.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Overview"
      commandBar={
        <ErpCommandBar
          primaryAction={
            mergeAllowedAction(perms.canCreateInvoice)
              ? { id: 'new', label: 'New Invoice', icon: Plus, onClick: () => navigate('/accounting/money-in/invoices/new') }
              : undefined
          }
          secondaryActions={[
            { id: 'outstanding', label: 'View Outstanding', icon: ListOrdered, onClick: () => navigate('/accounting/money-in/outstanding') },
            { id: 'ageing', label: 'View Ageing', icon: BarChart3, onClick: () => navigate('/accounting/money-in/ageing') },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="dashboard" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded border border-erp-border bg-slate-50 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-erp-muted">{k.label}</p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums text-erp-text">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Needs attention</h3>
              <AttentionPanel
                readyToPost={overview?.readyToPostCount ?? 0}
                overdueCount={overdueCount}
                exceptionCount={overview?.dataQualityExceptionCount ?? 0}
              />
            </section>
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Ageing (due date)</h3>
              {ageingBuckets.length === 0 ? (
                <p className="text-[12px] text-erp-muted">No open items.</p>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageingBuckets}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                      <Bar dataKey="amount" fill="var(--erp-accent, #0078d4)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>

          <p className="text-[12px] text-erp-muted">
            Posted this month: <strong>{overview?.postedThisMonthCount ?? 0}</strong> ·{' '}
            <Link to="/accounting/money-in/invoices" className="text-erp-accent hover:underline">
              View all invoices
            </Link>
          </p>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
