import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  HandCoins,
  RefreshCw,
  Users,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  PayableEmptyState,
  PayablesSummaryCards,
  PayablesWorkspaceTabs,
  VendorStatementPreview,
} from '@/components/accounting/payables'
import {
  exportPayables,
  getPayablesDashboard,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type { PayablesDashboardData } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCurrency, formatCompactCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { downloadTextFile } from './payablesUi'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const SEVERITY_STYLES = {
  critical: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
} as const

export function PayablesDashboardPage() {
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [data, setData] = useState<PayablesDashboardData | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [kpiActive] = useState<string | null>(null)
  const [statementOpen, setStatementOpen] = useState(false)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const result = await getPayablesDashboard()
      if (signal?.cancelled) return
      setData(result)
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
        label: 'Total Payables',
        value: formatCompactCurrency(k.totalPayables),
        helper: formatCurrency(k.totalPayables),
        icon: HandCoins,
        accent: 'blue',
        onClick: () => navigate('/accounting/payables/outstanding'),
      },
      {
        id: 'current',
        label: 'Current',
        value: formatCompactCurrency(k.currentOutstanding),
        icon: FileText,
        accent: 'green',
        onClick: () => navigate('/accounting/payables/outstanding?overdueStatus=current'),
      },
      {
        id: 'overdue',
        label: 'Overdue',
        value: formatCompactCurrency(k.overdueAmount),
        icon: AlertTriangle,
        accent: 'red',
        onClick: () => navigate('/accounting/payables/outstanding?overdueStatus=overdue'),
      },
      {
        id: 'dueWeek',
        label: 'Due This Week',
        value: formatCompactCurrency(k.dueThisWeek),
        icon: CalendarClock,
        accent: 'amber',
        onClick: () => navigate('/accounting/payables/invoices?invoiceTab=due_soon'),
      },
      {
        id: 'paymentsMonth',
        label: 'Payments This Month',
        value: formatCompactCurrency(k.paymentsThisMonth),
        icon: Banknote,
        accent: 'green',
        onClick: () => navigate('/accounting/payables/payments'),
      },
      {
        id: 'unallocated',
        label: 'Unallocated Payments',
        value: formatCompactCurrency(k.unallocatedPayments),
        icon: Banknote,
        accent: 'amber',
        onClick: () => navigate('/accounting/payables/allocations'),
      },
      {
        id: 'proposals',
        label: 'Proposals Pending',
        value: k.proposalsPendingApproval,
        helper: 'proposals',
        icon: ClipboardList,
        accent: 'amber',
        onClick: () => navigate('/accounting/payables/payment-proposals?proposalTab=pending_approval'),
      },
      {
        id: 'msme',
        label: 'MSME Overdue',
        value: formatCompactCurrency(k.msmePaymentsDue),
        icon: Users,
        accent: 'red',
        onClick: () => navigate('/accounting/payables/ageing'),
      },
    ]
  }, [data, navigate])

  const handleExport = async () => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportPayables({ scope: 'vendor_outstanding', format: 'csv' })
      downloadTextFile(result.filename, result.content)
      notify.success(result.disclaimer)
    } catch (err) {
      notify.error(err instanceof PayablesServiceError ? err.message : 'Export failed')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Payables"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Payables' }]}
        autoBreadcrumbs={false}
      >
        <PayableEmptyState title="Access denied" description="You cannot view payables." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Payables"
      description="Monitor vendor outstanding, overdue invoices, payments, ageing and payment approval activity."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Payables' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreatePayment
              ? {
                  id: 'create-payment',
                  label: 'Create Payment',
                  icon: Banknote,
                  variant: 'primary',
                  onClick: () => navigate('/accounting/payables/payments/new'),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'proposal',
              label: 'Create Payment Proposal',
              icon: ClipboardList,
              disabled: !perms.canCreatePaymentProposal,
              onClick: () => navigate('/accounting/payables/payment-planning'),
            },
            {
              id: 'statement',
              label: 'Vendor Statement',
              icon: FileText,
              disabled: !perms.canViewStatement,
              onClick: () => setStatementOpen(true),
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
      <PayablesWorkspaceTabs active="overview" />

      {loadState === 'loading' ? <LoadingState variant="table" rows={8} className="mt-4" /> : null}

      {loadState === 'error' ? (
        <PayableEmptyState
          title="Payables dashboard could not be loaded."
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
          <PayablesSummaryCards items={kpiItems} activeId={kpiActive} />

          <section className="rounded-lg border border-erp-border bg-white p-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[13px] font-semibold text-erp-text">Core payables flow</h2>
              <p className="text-[11px] text-erp-muted">
                Focus: <span className="font-semibold text-erp-text">Outstanding</span> ·{' '}
                <span className="font-semibold text-erp-text">Planning</span> ·{' '}
                <span className="font-semibold text-erp-text">Allocation</span>
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
              {data.priorityFlow.map((step) => {
                const isPrimary =
                  step.id === 'vendor_outstanding' ||
                  step.id === 'payment_planning' ||
                  step.id === 'invoice_allocation'
                return (
                  <Link
                    key={step.id}
                    to={step.href}
                    className={
                      isPrimary
                        ? 'rounded-md border-2 border-erp-primary/40 bg-erp-primary-soft/40 px-3 py-2 text-[12px] transition-colors hover:bg-erp-primary-soft'
                        : 'rounded-md border border-erp-border px-3 py-2 text-[12px] transition-colors hover:bg-erp-surface-alt'
                    }
                  >
                    <p className="font-semibold text-erp-text">
                      {step.label}
                      {isPrimary ? (
                        <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-erp-primary">
                          Key
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-erp-muted">{step.description}</p>
                    <p className="mt-1 tabular-nums font-semibold text-erp-primary">
                      {step.count}
                      <span className="ml-1 text-[11px] font-normal text-erp-muted">{step.ctaLabel} →</span>
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-erp-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Ageing buckets</h2>
                <Link to="/accounting/payables/ageing" className="text-[12px] font-semibold text-erp-primary">
                  View all →
                </Link>
              </div>
              <div className="space-y-1.5">
                {data.ageingChart.map((row) => (
                  <Link
                    key={row.bucket}
                    to={`/accounting/payables/invoices?ageingBucket=${encodeURIComponent(row.bucket)}`}
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
                <h2 className="text-[13px] font-semibold text-erp-text">Upcoming payments</h2>
                <Link
                  to="/accounting/payables/invoices?invoiceTab=due_soon"
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
                    {data.dueSoonInvoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">
                          <Link
                            to={`/accounting/payables/invoice/${inv.id}`}
                            className="font-mono text-erp-primary hover:underline"
                          >
                            {inv.invoiceNumber}
                          </Link>
                          <p className="text-[11px] text-erp-muted">{inv.vendorName}</p>
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
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Top vendors</h2>
                <Link to="/accounting/payables/outstanding" className="text-[12px] font-semibold text-erp-primary">
                  View all →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                      <th className="px-2 py-1">Vendor</th>
                      <th className="px-2 py-1 text-right">Outstanding</th>
                      <th className="px-2 py-1 text-right">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topVendors.map((row) => (
                      <tr key={row.vendorId} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">
                          <Link
                            to={`/accounting/payables/vendor/${row.vendorId}`}
                            className="font-semibold text-erp-primary hover:underline"
                          >
                            {row.vendorName}
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
              <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Critical alerts</h2>
              <ul className="space-y-2">
                {data.alerts.length === 0 ? (
                  <li className="text-[12px] text-erp-muted">No critical alerts.</li>
                ) : (
                  data.alerts.map((alert) => (
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
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3 lg:col-span-2">
              <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Monthly invoicing & payment trend</h2>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.paymentTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="invoiced" name="Invoiced" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="paid" name="Paid" fill="#10b981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Recent payments</h2>
                <Link to="/accounting/payables/payments" className="text-[12px] font-semibold text-erp-primary">
                  View all →
                </Link>
              </div>
              <ul className="space-y-1.5">
                {data.recentPayments.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/accounting/payables/payments/${p.id}`}
                      className="flex justify-between rounded-md px-2 py-1.5 text-[12px] hover:bg-erp-surface-alt"
                    >
                      <span>
                        <span className="font-mono font-semibold">{p.paymentNumber}</span>
                        <span className="ml-2 text-erp-muted">{p.vendorName}</span>
                      </span>
                      <span className="tabular-nums">{formatCurrency(p.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Payment approval activity</h2>
                <Link
                  to="/accounting/payables/payment-proposals"
                  className="text-[12px] font-semibold text-erp-primary"
                >
                  View proposals →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[24rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                      <th className="px-2 py-1">Proposal</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1 text-right">Amount</th>
                      <th className="px-2 py-1">Created by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pendingProposals.map((prop) => (
                      <tr key={prop.id} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">
                          <Link
                            to={`/accounting/payables/payment-proposals/${prop.id}`}
                            className="font-mono text-erp-primary hover:underline"
                          >
                            {prop.proposalNumber}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5">{prop.status}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(prop.totalAmount)}</td>
                        <td className="px-2 py-1.5 text-erp-muted">{prop.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      <VendorStatementPreview open={statementOpen} onClose={() => setStatementOpen(false)} />
    </OperationalPageShell>
  )
}
