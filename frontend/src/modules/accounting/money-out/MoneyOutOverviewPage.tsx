import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, BarChart3, ListOrdered, Scale } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getPayableAgeingReport,
  getPayableOverview,
  listPayableOutstanding,
  listPayableReconciliationRuns,
} from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { PayableReconciliationRunDto } from '@/types/moneyOut'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { isApiMode } from '@/config/apiConfig'
import { parseDecimal, payableReconciliationRunStatusTone, payableReconciliationStatusTone } from './moneyOutUi'
import { PayableAttentionPanel } from './components/PayableAttentionPanel'
import { MoneyOutWorkspaceShell } from './MoneyOutWorkspaceShell'

export function MoneyOutOverviewPage() {
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getPayableOverview>> | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [ageingBuckets, setAgeingBuckets] = useState<Array<{ name: string; amount: number }>>([])
  const [latestRecon, setLatestRecon] = useState<PayableReconciliationRunDto | null>(null)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const leId = resolveLegalEntityId()
      const tasks: Promise<unknown>[] = [
        getPayableOverview(leId),
        getPayableAgeingReport({ legalEntityId: leId, ageingBasis: 'due_date' }),
        listPayableOutstanding({ legalEntityId: leId }),
      ]
      if (perms.canReconcileView) {
        tasks.push(listPayableReconciliationRuns({ legalEntityId: leId, page: 1, pageSize: 1 }))
      }
      const results = await Promise.all(tasks)
      const ov = results[0] as Awaited<ReturnType<typeof getPayableOverview>>
      const ageing = results[1] as Awaited<ReturnType<typeof getPayableAgeingReport>>
      const outstanding = results[2] as Awaited<ReturnType<typeof listPayableOutstanding>>
      setOverview(ov)
      setOverdueCount(outstanding.items.filter((o) => (o.daysOverdue ?? 0) > 0).length)
      setAgeingBuckets(
        ageing.buckets.map((b) => ({
          name: String(b.bucket).replace(/_/g, ' '),
          amount: parseDecimal(b.baseOutstandingAmount),
        })),
      )
      if (perms.canReconcileView && results[3]) {
        const recon = results[3] as Awaited<ReturnType<typeof listPayableReconciliationRuns>>
        setLatestRecon(recon.items[0] ?? null)
      } else {
        setLatestRecon(null)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load Money Out overview')
    } finally {
      setLoading(false)
    }
  }, [perms.canReconcileView])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const kpis = useMemo(() => {
    if (!overview) return []
    return [
      { label: 'Outstanding', value: formatCompactCurrency(parseDecimal(overview.totals.baseOutstandingAmount)) },
      { label: 'Open items', value: String(overview.totals.openItemCount) },
      { label: 'Vendors', value: String(overview.totals.vendorCount) },
      { label: 'Ready to post', value: String(overview.readyToPostCount) },
    ]
  }, [overview])

  if (!perms.canView) {
    return (
      <MoneyOutWorkspaceShell title="Overview">
        <p className="text-[13px] text-erp-muted">You do not have permission to view Money Out.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Overview">
        <p className="text-[13px] text-erp-muted">
          Money Out requires API mode (<code>VITE_USE_API=true</code>). There is no separate AP demo workflow.
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Overview"
      commandBar={
        <ErpCommandBar
          primaryAction={
            mergeAllowedAction(perms.canCreateInvoice)
              ? {
                  id: 'new',
                  label: 'Create Vendor Invoice',
                  icon: Plus,
                  onClick: () => navigate('/accounting/money-out/vendor-invoices/new'),
                }
              : undefined
          }
          secondaryActions={[
            { id: 'outstanding', label: 'View Outstanding', icon: ListOrdered, onClick: () => navigate('/accounting/money-out/outstanding') },
            { id: 'ageing', label: 'View Ageing', icon: BarChart3, onClick: () => navigate('/accounting/money-out/ageing') },
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
              <PayableAttentionPanel
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

          {perms.canReconcileView ? (
            <section className="rounded border border-erp-border bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">AP reconciliation</h3>
                <Link to="/accounting/money-out/reconciliation" className="inline-flex items-center gap-1 text-[12px] text-erp-accent hover:underline">
                  <Scale className="h-3.5 w-3.5" />
                  Open
                </Link>
              </div>
              {!latestRecon ? (
                <p className="text-[12px] text-erp-muted">No reconciliation runs yet.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {latestRecon.status ? (
                      <ErpStatusChip label={latestRecon.status} tone={payableReconciliationStatusTone(latestRecon.status)} />
                    ) : (
                      <ErpStatusChip label={latestRecon.runStatus} tone={payableReconciliationRunStatusTone(latestRecon.runStatus)} />
                    )}
                    <span className="text-[12px] text-erp-muted">As of {latestRecon.asOfDate}</span>
                    {latestRecon.isStale ? <ErpStatusChip label="Stale" tone="warning" /> : null}
                  </div>
                  <p className="text-[12px] tabular-nums text-erp-text">
                    Variance {formatCurrency(parseDecimal(latestRecon.variance))} · {latestRecon.exceptionCount} exception(s)
                  </p>
                  <Link
                    to={`/accounting/money-out/reconciliation/runs/${latestRecon.id}`}
                    className="inline-block text-[12px] font-semibold text-erp-accent hover:underline"
                  >
                    View latest run →
                  </Link>
                </div>
              )}
            </section>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <ActionCard
              title="Outstanding"
              note="Open payable items and due dates."
              to="/accounting/money-out/outstanding"
            />
            <ActionCard title="Vendors" note="Payable position by vendor." to="/accounting/money-out/vendors" />
            <ActionCard
              title="Payment Planning"
              note="Read-only horizon view of upcoming dues."
              to="/accounting/money-out/payment-planning"
            />
          </div>

          <p className="text-[12px] text-erp-muted">
            Posted this month: <strong>{overview?.postedThisMonthCount ?? 0}</strong> ·{' '}
            <Link to="/accounting/money-out/vendor-invoices" className="text-erp-accent hover:underline">
              View all vendor invoices
            </Link>
          </p>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}

function ActionCard({ title, note, to }: { title: string; note: string; to: string }) {
  return (
    <Link to={to} className="rounded border border-erp-border bg-white p-3 hover:border-erp-accent">
      <div className="text-[13px] font-medium text-erp-text">{title}</div>
      <div className="mt-1 text-[11px] text-erp-muted">{note}</div>
      <div className="mt-2 text-[12px] text-erp-accent">Open →</div>
    </Link>
  )
}
