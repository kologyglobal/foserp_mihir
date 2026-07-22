import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  Download,
  FileText,
  HandCoins,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  CustomerStatementPreview,
  ReceivableEmptyState,
  ReceivablesSummaryCards,
  ReceivablesWorkspaceTabs,
} from '@/components/accounting/receivables'
import {
  exportReceivables,
  getReceivablesDashboard,
  ReceivablesServiceError,
} from '@/services/accounting/receivablesService'
import type { ReceivablesDashboardData } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { isApiMode } from '@/config/apiConfig'
import { getCommercialCommitmentSummary } from '@/data/accounting/commercialCommitmentsSeed'
import type { CommercialCommitmentSummary } from '@/types/commercialCommitments'
import { formatCurrency, formatCompactCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { downloadTextFile } from './receivablesUi'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const SEVERITY_STYLES = {
  critical: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
} as const

export function ReceivablesDashboardPage() {
  const navigate = useNavigate()
  const perms = useReceivablesPermissions()
  const [data, setData] = useState<ReceivablesDashboardData | null>(null)
  const [commercialSummary, setCommercialSummary] = useState<CommercialCommitmentSummary | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [kpiActive] = useState<string | null>(null)
  const [statementOpen, setStatementOpen] = useState(false)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const [result, commercial] = await Promise.all([
        getReceivablesDashboard(),
        // Commercial commitments are a seed-backed panel — never surface seed data in API mode.
        isApiMode() ? Promise.resolve(null) : getCommercialCommitmentSummary(),
      ])
      if (signal?.cancelled) return
      setData(result)
      setCommercialSummary(commercial)
      setLoadState('ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Dashboard could not be loaded.')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const kpiItems: EnterpriseKpiItem[] = useMemo(() => {
    if (!data) return []
    const k = data.kpis
    return [
      {
        id: 'total',
        label: 'Total Receivables',
        value: formatCompactCurrency(k.totalReceivables),
        helper: formatCurrency(k.totalReceivables),
        icon: HandCoins,
        accent: 'blue',
        onClick: () => navigate('/accounting/receivables/outstanding'),
      },
      {
        id: 'current',
        label: 'Current',
        value: formatCompactCurrency(k.currentOutstanding),
        icon: FileText,
        accent: 'green',
        onClick: () => navigate('/accounting/receivables/outstanding?overdueStatus=current'),
      },
      {
        id: 'overdue',
        label: 'Overdue',
        value: formatCompactCurrency(k.overdueAmount),
        icon: AlertTriangle,
        accent: 'red',
        onClick: () => navigate('/accounting/receivables/outstanding?overdueStatus=overdue'),
      },
      {
        id: 'dueWeek',
        label: 'Due This Week',
        value: formatCompactCurrency(k.dueThisWeek),
        icon: CalendarClock,
        accent: 'amber',
        onClick: () => navigate('/accounting/receivables/invoices?invoiceTab=due_soon'),
      },
      {
        id: 'receiptsMonth',
        label: 'Receipts This Month',
        value: formatCompactCurrency(k.receiptsThisMonth),
        icon: Banknote,
        accent: 'green',
        onClick: () => navigate('/accounting/receivables/receipts'),
      },
      {
        id: 'unallocated',
        label: 'Unallocated Receipts',
        value: formatCompactCurrency(k.unallocatedReceipts),
        icon: Banknote,
        accent: 'amber',
        onClick: () => navigate('/accounting/receivables/receipts?receiptTab=unallocated'),
      },
      {
        id: 'overLimit',
        label: 'Over Credit Limit',
        value: k.customersOverCreditLimit,
        helper: 'customers',
        icon: Users,
        accent: 'red',
        onClick: () => navigate('/accounting/receivables/outstanding?creditStatus=Over%20Limit'),
      },
      {
        id: 'avgDays',
        label: 'Avg Collection Days',
        value: k.averageCollectionDays,
        helper: 'days',
        icon: CalendarClock,
        accent: 'slate',
        onClick: () => navigate('/accounting/receivables/ageing'),
      },
    ]
  }, [data, navigate])

  const handleExport = async () => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportReceivables({ scope: 'customer_outstanding', format: 'csv' })
      downloadTextFile(result.filename, result.content)
      notify.success(result.disclaimer)
    } catch (err) {
      notify.error(err instanceof ReceivablesServiceError ? err.message : 'Export failed')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Receivables"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Receivables' }]}
        autoBreadcrumbs={false}
      >
        <ReceivableEmptyState title="Access denied" description="You cannot view receivables." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Receivables"
      description="Monitor customer outstanding, overdue invoices, receipts, ageing and collection activity."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Receivables' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/receivables"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateReceipt
              ? {
                  id: 'record-receipt',
                  label: 'Record Receipt',
                  icon: Banknote,
                  variant: 'primary',
                  onClick: () => navigate('/accounting/receivables/receipts/new'),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'statement',
              label: 'Customer Statement',
              icon: FileText,
              disabled: !perms.canViewStatement,
              onClick: () => setStatementOpen(true),
            },
            {
              id: 'reminders',
              label: 'Send Reminder',
              icon: Send,
              disabled: !perms.canPreviewReminder,
              onClick: () => navigate('/accounting/receivables/reminders'),
            },
            {
              id: 'export',
              label: 'Export',
              icon: Download,
              disabled: !perms.canExport,
              onClick: () => void handleExport(),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => setRefreshToken((n) => n + 1),
            },
          ]}
        />
      )}
    >
      <ReceivablesWorkspaceTabs active="overview" />

      {loadState === 'loading' ? <LoadingState variant="table" rows={8} className="mt-4" /> : null}

      {loadState === 'error' ? (
        <ReceivableEmptyState
          title="Receivables dashboard could not be loaded."
          description={errorMessage ?? undefined}
          actions={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
              onClick={() => setRefreshToken((n) => n + 1)}
            >
              Retry
            </button>
          )}
        />
      ) : null}

      {loadState === 'ready' && data ? (
        <div className="mt-4 space-y-4">
          <ReceivablesSummaryCards items={kpiItems} activeId={kpiActive} />
          {commercialSummary ? (
            <Link
              to="/accounting/commercial-commitments"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 transition-colors hover:border-amber-300"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                  Pending Commercial Value
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-erp-text">
                  {formatCurrency(commercialSummary.potentialReceivable)}
                </p>
                <p className="mt-0.5 text-[12px] text-erp-muted">
                  {formatCurrency(commercialSummary.confirmedSalesOrdersValue)} confirmed but not invoiced · Not included in
                  customer outstanding
                </p>
              </div>
              <span className="text-[12px] font-semibold text-erp-primary">View Commercial Commitments →</span>
            </Link>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-erp-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Ageing buckets</h2>
                <Link to="/accounting/receivables/ageing" className="text-[12px] font-semibold text-erp-primary">
                  View all →
                </Link>
              </div>
              <div className="space-y-1.5">
                {data.ageing.map((row) => (
                  <Link
                    key={row.bucket}
                    to={`/accounting/receivables/invoices?ageingBucket=${encodeURIComponent(row.bucket)}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-[12px] hover:bg-erp-surface-alt"
                  >
                    <span>{row.bucket}</span>
                    <span className="tabular-nums font-semibold">
                      {formatCurrency(row.amount)}
                      <span className="ml-2 text-erp-muted">({row.count})</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Outstanding by customer</h2>
                <Link to="/accounting/receivables/outstanding" className="text-[12px] font-semibold text-erp-primary">
                  View all →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                      <th className="px-2 py-1">Customer</th>
                      <th className="px-2 py-1 text-right">Outstanding</th>
                      <th className="px-2 py-1 text-right">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outstandingByCustomer.map((row) => (
                      <tr key={row.customerId} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">
                          <Link
                            to={`/accounting/receivables/customer/${row.customerId}`}
                            className="font-semibold text-erp-primary hover:underline"
                          >
                            {row.customerName}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.totalOutstanding)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-rose-700">
                          {formatCurrency(row.overdueAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Upcoming due invoices</h2>
                <Link
                  to="/accounting/receivables/invoices?invoiceTab=due_soon"
                  className="text-[12px] font-semibold text-erp-primary"
                >
                  View all →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                      <th className="px-2 py-1">Invoice</th>
                      <th className="px-2 py-1">Due</th>
                      <th className="px-2 py-1 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.upcomingDueInvoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">
                          <Link
                            to={`/accounting/receivables/invoice/${inv.id}`}
                            className="font-mono text-erp-primary hover:underline"
                          >
                            {inv.invoiceNumber}
                          </Link>
                          <p className="text-[11px] text-erp-muted">{inv.customerName}</p>
                        </td>
                        <td className="px-2 py-1.5">{formatDate(inv.dueDate)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(inv.outstandingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Critical collection alerts</h2>
              <ul className="space-y-2">
                {data.criticalAlerts.map((alert) => (
                  <li key={alert.id}>
                    <Link
                      to={alert.href}
                      className={cn(
                        'block rounded-md border px-3 py-2 text-[12px] transition-colors hover:opacity-90',
                        SEVERITY_STYLES[alert.severity],
                      )}
                    >
                      <p className="font-semibold">{alert.title}</p>
                      <p className="text-[11px] opacity-80">{alert.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3 lg:col-span-2">
              <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Monthly billing & collection trend</h2>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.billingCollectionTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="billed" name="Billed" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Top overdue customers</h2>
                <Link
                  to="/accounting/receivables/outstanding?overdueStatus=overdue"
                  className="text-[12px] font-semibold text-erp-primary"
                >
                  View all →
                </Link>
              </div>
              <ul className="space-y-1.5">
                {data.topOverdueCustomers.map((row) => (
                  <li key={row.customerId}>
                    <Link
                      to={`/accounting/receivables/customer/${row.customerId}`}
                      className="flex justify-between rounded-md px-2 py-1.5 text-[12px] hover:bg-erp-surface-alt"
                    >
                      <span className="font-semibold">{row.customerName}</span>
                      <span className="tabular-nums text-rose-700">{formatCurrency(row.overdueAmount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Recent receipts</h2>
                <Link to="/accounting/receivables/receipts" className="text-[12px] font-semibold text-erp-primary">
                  View all →
                </Link>
              </div>
              <ul className="space-y-1.5">
                {data.recentReceipts.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/accounting/receivables/receipts/${r.id}`}
                      className="flex justify-between rounded-md px-2 py-1.5 text-[12px] hover:bg-erp-surface-alt"
                    >
                      <span>
                        <span className="font-mono font-semibold">{r.receiptNumber}</span>
                        <span className="ml-2 text-erp-muted">{r.customerName}</span>
                      </span>
                      <span className="tabular-nums">{formatCurrency(r.receiptAmount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3 lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Collection team activity</h2>
                <Link to="/accounting/receivables/collections" className="text-[12px] font-semibold text-erp-primary">
                  View worklist →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                      <th className="px-2 py-1">Date</th>
                      <th className="px-2 py-1">Customer</th>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Outcome</th>
                      <th className="px-2 py-1">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.collectionTeamActivity.map((act) => (
                      <tr key={act.id} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">{formatDate(act.activityDate)}</td>
                        <td className="px-2 py-1.5">{act.customerName}</td>
                        <td className="px-2 py-1.5">{act.activityType}</td>
                        <td className="px-2 py-1.5">{act.outcome}</td>
                        <td className="px-2 py-1.5 text-erp-muted">{act.collectionOwner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      <CustomerStatementPreview open={statementOpen} onClose={() => setStatementOpen(false)} />
    </OperationalPageShell>
  )
}
