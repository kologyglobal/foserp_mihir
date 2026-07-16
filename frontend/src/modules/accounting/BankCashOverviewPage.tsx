import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  ClipboardList,
  Download,
  FileUp,
  Landmark,
  PiggyBank,
  Plus,
  ReceiptText,
  RefreshCw,
  ScrollText,
  Wallet,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  BankCashDemoBanner,
  BankCashEmptyState,
  BankCashSummaryCards,
  BankCashWorkspaceTabs,
  BankAccountStatusBadge,
  ReconciliationFlowStrip,
  ReconciliationStatusBadge,
} from '@/components/accounting/bankCash'
import { getBankCashDashboard, BankCashServiceError } from '@/services/accounting/bankCashService'
import type { BankCashDashboardData } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency, formatCompactCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { exportBankCashReport } from './bankCashUi'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error'

const SEVERITY_STYLES = {
  critical: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
} as const

export function BankCashOverviewPage() {
  const navigate = useNavigate()
  const perms = useBankCashPermissions()
  const [data, setData] = useState<BankCashDashboardData | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const result = await getBankCashDashboard()
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
    return [
      {
        id: 'bank-balance',
        label: 'Total Bank Balance',
        value: formatCompactCurrency(data.totalBankBalance),
        helper: formatCurrency(data.totalBankBalance),
        icon: Landmark,
        accent: 'blue',
        onClick: () => navigate('/accounting/bank-cash/bank-accounts'),
      },
      {
        id: 'cash-balance',
        label: 'Total Cash Balance',
        value: formatCompactCurrency(data.totalCashBalance),
        helper: formatCurrency(data.totalCashBalance),
        icon: Wallet,
        accent: 'green',
        onClick: () => navigate('/accounting/bank-cash/cash-accounts'),
      },
      {
        id: 'available',
        label: 'Available Balance',
        value: formatCompactCurrency(data.totalAvailableBalance),
        icon: PiggyBank,
        accent: 'blue',
      },
      {
        id: 'unreconciled',
        label: 'Unreconciled Transactions',
        value: data.unreconciledTransactionCount,
        helper: formatCurrency(data.unreconciledBankAmount),
        icon: ScrollText,
        accent: 'amber',
        onClick: () => navigate('/accounting/bank-cash/reconciliation'),
      },
      {
        id: 'payments-transit',
        label: 'Payments in Transit',
        value: formatCompactCurrency(data.paymentsInTransit),
        icon: Banknote,
        accent: 'amber',
        onClick: () => navigate('/accounting/bank-cash/transactions'),
      },
      {
        id: 'deposits-transit',
        label: 'Deposits in Transit',
        value: formatCompactCurrency(data.depositsInTransit),
        icon: ReceiptText,
        accent: 'amber',
        onClick: () => navigate('/accounting/bank-cash/deposits'),
      },
      {
        id: 'cheques-pending',
        label: 'Cheques Pending Clearance',
        value: data.chequesPendingClearance,
        icon: ClipboardList,
        accent: 'slate',
        onClick: () => navigate('/accounting/bank-cash/cheques'),
      },
      {
        id: 'cash-variance',
        label: 'Cash Variance',
        value: formatCompactCurrency(data.cashVarianceAmount),
        icon: AlertTriangle,
        accent: data.cashVarianceAmount > 0 ? 'red' : 'slate',
        onClick: () => navigate('/accounting/bank-cash/cash-counts'),
      },
    ]
  }, [data, navigate])

  const handleExport = async () => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const message = await exportBankCashReport('Bank & Cash Overview')
      notify.success(message)
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Export failed')
    }
  }

  if (!perms.canView || !perms.canViewDashboard) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Bank & Cash Management"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Bank & Cash' }]}
        autoBreadcrumbs={false}
      >
        <BankCashEmptyState title="Access denied" description="You cannot view the Bank & Cash dashboard." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Bank & Cash Management"
      description="Bank and cash positions, reconciliation status, fund transfers and pending actions — demo data only."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Bank & Cash' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateFundTransfer
              ? {
                  id: 'new-transfer',
                  label: 'New Fund Transfer',
                  icon: Plus,
                  variant: 'primary',
                  onClick: () => navigate('/accounting/bank-cash/transfers/new'),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'import-statement',
              label: 'Import Statement',
              icon: FileUp,
              disabled: !perms.canImportStatement,
              onClick: () => navigate('/accounting/bank-cash/statements/import'),
            },
            {
              id: 'cash-count',
              label: 'Record Cash Count',
              icon: Wallet,
              disabled: !perms.canManageCashCount,
              onClick: () => navigate('/accounting/bank-cash/cash-counts/new'),
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
      <BankCashWorkspaceTabs active="overview" />

      <div className="mt-4 space-y-3">
        <BankCashDemoBanner />
        <div className="rounded-md border border-erp-border bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-semibold text-erp-text">Recommended bank reconciliation flow</h2>
              <p className="text-[12px] text-erp-muted">
                The Reconciliation Workbench is the primary screen after statements are imported and validated.
              </p>
            </div>
            <button
              type="button"
              className="erp-btn erp-btn-secondary h-8 px-3 text-[12px]"
              onClick={() => navigate('/accounting/bank-cash/reconciliation')}
            >
              Open reconciliation
            </button>
          </div>
          <ReconciliationFlowStrip active="automatch" completedThrough="transactions" compact />
        </div>
      </div>

      {loadState === 'loading' ? <LoadingState variant="table" rows={8} className="mt-4" /> : null}

      {loadState === 'error' ? (
        <BankCashEmptyState
          title="Bank & Cash dashboard could not be loaded."
          description={errorMessage ?? undefined}
          actions={(
            <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => setRefreshToken((n) => n + 1)}>
              Retry
            </button>
          )}
        />
      ) : null}

      {loadState === 'ready' && data ? (
        <div className="space-y-4">
          <BankCashSummaryCards items={kpiItems} columns={4} />

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-erp-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Bank position</h2>
                <Link to="/accounting/bank-cash/bank-accounts" className="text-[12px] font-semibold text-erp-primary">
                  View all →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                      <th className="px-2 py-1">Account</th>
                      <th className="px-2 py-1 text-right">Book</th>
                      <th className="px-2 py-1 text-right">Unreconciled</th>
                      <th className="px-2 py-1">Recon.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bankAccounts.map((b) => (
                      <tr key={b.id} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">
                          <Link to={`/accounting/bank-cash/bank-accounts/${b.id}`} className="font-semibold text-erp-primary hover:underline">
                            {b.name}
                          </Link>
                          <p className="text-[11px] text-erp-muted">{b.bankName}</p>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(b.bookBalance)}</td>
                        <td className={cn('px-2 py-1.5 text-right tabular-nums', b.unreconciledAmount !== 0 && 'text-amber-700')}>
                          {formatCurrency(b.unreconciledAmount)}
                        </td>
                        <td className="px-2 py-1.5">
                          <ReconciliationStatusBadge status={b.reconciliationStatus} />
                        </td>
                      </tr>
                    ))}
                    {data.bankAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-center text-erp-muted">No bank accounts.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Cash position</h2>
                <Link to="/accounting/bank-cash/cash-accounts" className="text-[12px] font-semibold text-erp-primary">
                  View all →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                      <th className="px-2 py-1">Account</th>
                      <th className="px-2 py-1 text-right">Book</th>
                      <th className="px-2 py-1 text-right">Variance</th>
                      <th className="px-2 py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cashAccounts.map((c) => (
                      <tr key={c.id} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">
                          <Link to={`/accounting/bank-cash/cash-accounts/${c.id}`} className="font-semibold text-erp-primary hover:underline">
                            {c.name}
                          </Link>
                          <p className="text-[11px] text-erp-muted">{c.location}</p>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(c.bookBalance)}</td>
                        <td className={cn('px-2 py-1.5 text-right tabular-nums', c.variance !== 0 && 'text-amber-700')}>
                          {formatCurrency(c.variance)}
                        </td>
                        <td className="px-2 py-1.5">
                          <BankAccountStatusBadge status={c.status} />
                        </td>
                      </tr>
                    ))}
                    {data.cashAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-center text-erp-muted">No cash accounts.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Reconciliation status</h2>
              <dl className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-3">
                <div className="rounded-md bg-emerald-50 px-2 py-1.5">
                  <dt className="text-erp-muted">Reconciled</dt>
                  <dd className="font-semibold text-emerald-800">{data.reconciliationSummary.reconciled}</dd>
                </div>
                <div className="rounded-md bg-amber-50 px-2 py-1.5">
                  <dt className="text-erp-muted">Pending</dt>
                  <dd className="font-semibold text-amber-800">{data.reconciliationSummary.pending}</dd>
                </div>
                <div className="rounded-md bg-indigo-50 px-2 py-1.5">
                  <dt className="text-erp-muted">Partially reconciled</dt>
                  <dd className="font-semibold text-indigo-800">{data.reconciliationSummary.partiallyReconciled}</dd>
                </div>
                <div className="rounded-md bg-rose-50 px-2 py-1.5">
                  <dt className="text-erp-muted">Difference</dt>
                  <dd className="font-semibold text-rose-800">{formatCurrency(data.reconciliationSummary.difference)}</dd>
                </div>
                <div className="rounded-md bg-orange-50 px-2 py-1.5">
                  <dt className="text-erp-muted">Overdue</dt>
                  <dd className="font-semibold text-orange-800">{data.reconciliationSummary.overdue}</dd>
                </div>
              </dl>
              <Link to="/accounting/bank-cash/reconciliation" className="mt-2 inline-block text-[12px] font-semibold text-erp-primary">
                Open reconciliation workspace →
              </Link>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Pending actions</h2>
              {data.pendingActions.length === 0 ? (
                <p className="text-[12px] text-erp-muted">No pending actions — everything is up to date.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.pendingActions.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={a.href}
                        className={cn(
                          'flex items-center justify-between rounded-md border px-3 py-2 text-[12px] transition-colors hover:opacity-90',
                          SEVERITY_STYLES[a.severity],
                        )}
                      >
                        <span className="font-medium">{a.label}</span>
                        <span className="tabular-nums font-semibold">{a.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3 lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Recent transactions</h2>
                <Link to="/accounting/bank-cash/transactions" className="text-[12px] font-semibold text-erp-primary">
                  View all →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                      <th className="px-2 py-1">Date</th>
                      <th className="px-2 py-1">Number</th>
                      <th className="px-2 py-1">Account</th>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1 text-right">Debit</th>
                      <th className="px-2 py-1 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentTransactions.map((t) => (
                      <tr key={t.id} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">{formatDate(t.transactionDate)}</td>
                        <td className="px-2 py-1.5 font-mono">{t.transactionNumber}</td>
                        <td className="px-2 py-1.5">{t.accountName}</td>
                        <td className="px-2 py-1.5">{t.transactionType}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{t.debitAmount > 0 ? formatCurrency(t.debitAmount) : '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{t.creditAmount > 0 ? formatCurrency(t.creditAmount) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Bank balance trend</h2>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.bankBalanceTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                    <Line type="monotone" dataKey="balance" name="Bank balance" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Cash movement trend</h2>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.cashMovementTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="receipts" name="Receipts" fill="#10b981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="payments" name="Payments" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
