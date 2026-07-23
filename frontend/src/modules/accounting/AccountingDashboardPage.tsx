import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  CheckCircle2,
  FileText,
  IndianRupee,
  Info,
  Landmark,
  Plus,
  Wallet,
} from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsDashboardGrid,
  DynamicsCommandButton,
} from '../../components/dynamics'
import { AccountingRoleBar, AccountingStatusBadge } from '../../components/accounting'
import { TableLink } from '../../components/ui/AppLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { useAccountingStore } from '../../store/accountingStore'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { computeAgeingBuckets, computeAccountBalance } from '../../utils/accounting/ledgerEngine'
import { VOUCHER_TYPE_LABELS } from '../../types/accounting'
import { getCommercialCommitmentSummary } from '../../data/accounting/commercialCommitmentsSeed'
import type { CommercialCommitmentSummary } from '../../types/commercialCommitments'
import { getReceivablesDashboard } from '@/services/accounting/receivablesService'
import { listJournals } from '@/services/bridges/journalApiBridge'
import { getPayableOverview } from '@/services/bridges/payablesApiBridge'
import { ensureLegalEntity } from '@/services/bridges/financeApiBridge'
import { fetchTreasuryDashboard } from '@/modules/accounting/treasury/liquidity/api/treasury-liquidity.api'
import type { Journal } from '@/types/journals'
import type { ReceivablesDashboardData } from '@/types/receivables'
import { Badge } from '@/components/ui/Badge'

type LiveMetrics = {
  totalReceivable: number
  totalPayable: number
  cashBankBalance: number
  draftCount: number
  pendingApprovalCount: number
  approvedCount: number
  overdueCustomerCount: number
  openReconSessions: number
  recentJournals: Journal[]
  topOverdue: ReceivablesDashboardData['topOverdueCustomers']
}

const EMPTY_LIVE: LiveMetrics = {
  totalReceivable: 0,
  totalPayable: 0,
  cashBankBalance: 0,
  draftCount: 0,
  pendingApprovalCount: 0,
  approvedCount: 0,
  overdueCustomerCount: 0,
  openReconSessions: 0,
  recentJournals: [],
  topOverdue: [],
}

function num(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function journalStatusTone(status: Journal['status']): 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple' {
  switch (status) {
    case 'DRAFT':
      return 'gray'
    case 'PENDING_APPROVAL':
      return 'yellow'
    case 'APPROVED':
      return 'blue'
    case 'POSTED':
      return 'green'
    case 'REJECTED':
    case 'CANCELLED':
      return 'red'
    case 'REVERSED':
      return 'purple'
    default:
      return 'gray'
  }
}

function journalStatusLabel(status: Journal['status']): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

/** Live command center — posted finance documents only (no demo seed). */
function ApiAccountingDashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<LiveMetrics>(EMPTY_LIVE)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const legalEntity = await ensureLegalEntity()
      const legalEntityId = legalEntity.id

      const [arResult, apResult, journalsResult, treasuryResult] = await Promise.allSettled([
        getReceivablesDashboard(),
        getPayableOverview(legalEntityId),
        listJournals({ legalEntityId }),
        fetchTreasuryDashboard({ legalEntityId }),
      ])

      const ar = arResult.status === 'fulfilled' ? arResult.value : null
      const ap = apResult.status === 'fulfilled' ? apResult.value : null
      const journals = journalsResult.status === 'fulfilled' ? journalsResult.value : []
      const treasury = treasuryResult.status === 'fulfilled' ? treasuryResult.value : null

      const sortedJournals = [...journals].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      setMetrics({
        totalReceivable: ar?.kpis.totalReceivables ?? 0,
        totalPayable: ap ? num(ap.totals.baseOutstandingAmount) : 0,
        cashBankBalance: treasury ? num(treasury.position.totalBookBalance) : 0,
        draftCount: journals.filter((j) => j.status === 'DRAFT').length,
        pendingApprovalCount: journals.filter((j) => j.status === 'PENDING_APPROVAL').length,
        approvedCount: journals.filter((j) => j.status === 'APPROVED').length,
        overdueCustomerCount: ar?.topOverdueCustomers.length ?? 0,
        openReconSessions: treasury?.workflow.openReconciliationSessions ?? 0,
        recentJournals: sortedJournals.slice(0, 8),
        topOverdue: ar?.topOverdueCustomers.slice(0, 6) ?? [],
      })
    } catch (e) {
      setMetrics(EMPTY_LIVE)
      setError(e instanceof Error ? e.message : 'Failed to load accounting dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pendingActions = useMemo(() => {
    const actions: { id: string; label: string; href: string; priority?: 'primary' }[] = []
    if (metrics.pendingApprovalCount > 0) {
      actions.push({
        id: 'approve',
        label: `Approve ${metrics.pendingApprovalCount} pending voucher(s)`,
        href: '/accounting/entries/approvals',
        priority: 'primary',
      })
    }
    if (metrics.approvedCount > 0) {
      actions.push({
        id: 'post',
        label: `Post ${metrics.approvedCount} approved voucher(s)`,
        href: '/accounting/entries/journals',
      })
    }
    if (metrics.openReconSessions > 0) {
      actions.push({
        id: 'recon',
        label: `Complete ${metrics.openReconSessions} bank reconciliation session(s)`,
        href: '/accounting/bank-cash/reconciliation',
      })
    }
    return actions
  }, [metrics])

  if (loading) {
    return (
      <DynamicsModuleDashboard
        title="Accounting Command Center"
        subtitle="Loading live finance balances…"
        badge="Accounting"
        favoritePath="/accounting"
        healthScore={100}
        heroMetrics={[]}
        quickActions={null}
      >
        <LoadingState label="Loading posted finance data…" />
      </DynamicsModuleDashboard>
    )
  }

  return (
    <DynamicsModuleDashboard
      title="Accounting Command Center"
      subtitle="Live transaction workspace — balances from posted receivables, payables, journals, and treasury only."
      badge="Accounting"
      favoritePath="/accounting"
      healthScore={metrics.pendingApprovalCount > 3 ? 74 : 100}
      heroMetrics={[
        {
          id: 'ar',
          label: 'Receivables Outstanding',
          value: formatCurrency(metrics.totalReceivable),
          icon: ArrowDownToLine,
          accent: 'blue',
          href: '/accounting/money-in',
        },
        {
          id: 'ap',
          label: 'Payables Outstanding',
          value: formatCurrency(metrics.totalPayable),
          icon: ArrowUpFromLine,
          accent: 'amber',
          href: '/accounting/money-out',
        },
        {
          id: 'cash',
          label: 'Cash & Bank Balance',
          value: formatCurrency(metrics.cashBankBalance),
          icon: Wallet,
          accent: 'green',
          href: '/accounting/bank-cash',
        },
        {
          id: 'pending',
          label: 'Vouchers Pending Approval',
          value: metrics.pendingApprovalCount,
          icon: FileText,
          accent: metrics.pendingApprovalCount ? 'red' : 'green',
          href: '/accounting/entries/approvals',
        },
      ]}
      liveSections={
        error ? (
          <DynamicsDashboardPanel title="Pending Actions">
            <p className="text-[13px] text-erp-danger-fg">{error}</p>
          </DynamicsDashboardPanel>
        ) : pendingActions.length > 0 ? (
          <DynamicsDashboardPanel title="Pending Actions">
            <ul className="space-y-2">
              {pendingActions.map((action) => (
                <li key={action.id}>
                  <button
                    type="button"
                    onClick={() => navigate(action.href)}
                    className="flex w-full items-center justify-between rounded-md border border-erp-border px-3 py-2 text-left text-[13px] hover:border-erp-primary/40 hover:bg-erp-primary-soft"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-erp-warning-fg" />
                      {action.label}
                    </span>
                    <span className="text-erp-primary">Open →</span>
                  </button>
                </li>
              ))}
            </ul>
          </DynamicsDashboardPanel>
        ) : (
          <DynamicsDashboardPanel title="Pending Actions">
            <p className="flex items-center gap-2 text-[13px] text-erp-success-fg">
              <CheckCircle2 className="h-4 w-4" /> No pending actions — no unposted journals or open reconciliations.
            </p>
          </DynamicsDashboardPanel>
        )
      }
      quickActions={
        <>
          <DynamicsCommandButton
            primary
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/accounting/entries/journals/new')}
          >
            New Journal
          </DynamicsCommandButton>
          <DynamicsCommandButton
            icon={<BookOpen className="h-4 w-4" />}
            onClick={() => navigate('/accounting/settings/chart-of-accounts')}
          >
            Chart of Accounts
          </DynamicsCommandButton>
          <DynamicsCommandButton icon={<Landmark className="h-4 w-4" />} onClick={() => navigate('/accounting/bank-cash')}>
            Bank &amp; Cash
          </DynamicsCommandButton>
          <DynamicsCommandButton icon={<IndianRupee className="h-4 w-4" />} onClick={() => navigate('/accounting/ledger-entries')}>
            Ledger Entries
          </DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        {
          label: 'Draft Vouchers',
          value: metrics.draftCount,
          tone: 'neutral',
          href: '/accounting/entries/journals',
        },
        {
          label: 'Pending Approval',
          value: metrics.pendingApprovalCount,
          tone: metrics.pendingApprovalCount ? 'warning' : 'success',
          href: '/accounting/entries/approvals',
        },
        {
          label: 'Approved (awaiting post)',
          value: metrics.approvedCount,
          tone: 'primary',
          href: '/accounting/entries/journals',
        },
        {
          label: 'Overdue Customers',
          value: metrics.overdueCustomerCount,
          tone: metrics.overdueCustomerCount ? 'critical' : 'success',
          href: '/accounting/money-in',
        },
        {
          label: 'Open Recon Sessions',
          value: metrics.openReconSessions,
          tone: metrics.openReconSessions ? 'warning' : 'success',
          href: '/accounting/bank-cash/reconciliation',
        },
      ]}
    >
      <DynamicsDashboardGrid>
        <DynamicsDashboardPanel
          title="Recent Journals"
          actions={<span className="dyn-entity-list-meta">{metrics.recentJournals.length} shown</span>}
          noPadding
        >
          <table className="erp-table">
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Type</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentJournals.map((v) => (
                <tr key={v.id}>
                  <td>
                    <TableLink to={`/accounting/entries/journals/${v.id}`}>
                      {v.voucherNumber ?? v.draftReference ?? '—'}
                    </TableLink>
                  </td>
                  <td>Journal</td>
                  <td>{formatDate(v.documentDate)}</td>
                  <td>
                    <Badge color={journalStatusTone(v.status)} dot>
                      {journalStatusLabel(v.status)}
                    </Badge>
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(num(v.baseTotalDebit))}</td>
                </tr>
              ))}
              {metrics.recentJournals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="dyn-empty-hint">
                    No journals yet — create and post transactions to see activity here.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel
          title="Ageing — Top Overdue Customers"
          actions={<span className="dyn-entity-list-meta">{metrics.topOverdue.length} overdue</span>}
          noPadding
        >
          <table className="erp-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topOverdue.map((row) => (
                <tr key={row.customerId}>
                  <td>
                    <TableLink to={`/accounting/money-in/customers/${row.customerId}`}>{row.customerName}</TableLink>
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(row.totalOutstanding)}</td>
                  <td className="text-right tabular-nums font-semibold text-erp-danger-fg">
                    {formatCurrency(row.overdueAmount)}
                  </td>
                </tr>
              ))}
              {metrics.topOverdue.length === 0 ? (
                <tr>
                  <td colSpan={3} className="dyn-empty-hint">
                    No overdue receivables
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>
    </DynamicsModuleDashboard>
  )
}

/** Demo seed dashboard — Zustand accountingStore only (VITE_USE_API=false). */
function DemoAccountingDashboardPage() {
  const navigate = useNavigate()
  const accounts = useAccountingStore((s) => s.accounts)
  const vouchers = useAccountingStore((s) => s.vouchers)
  const ledgerEntries = useAccountingStore((s) => s.ledgerEntries)
  const receivables = useAccountingStore((s) => s.receivables)
  const payables = useAccountingStore((s) => s.payables)
  const bankAccounts = useAccountingStore((s) => s.bankAccounts)
  const bankReconciliations = useAccountingStore((s) => s.bankReconciliations)
  const periodCloseChecklists = useAccountingStore((s) => s.periodCloseChecklists)
  const [commercialSummary, setCommercialSummary] = useState<CommercialCommitmentSummary | null>(null)

  useEffect(() => {
    void getCommercialCommitmentSummary().then(setCommercialSummary)
  }, [])

  const today = new Date().toISOString().slice(0, 10)

  const totalReceivable = useMemo(() => receivables.reduce((s, r) => s + r.balance, 0), [receivables])
  const totalPayable = useMemo(() => payables.reduce((s, p) => s + p.balance, 0), [payables])

  const cashBankBalance = useMemo(() => {
    return bankAccounts.reduce((sum, ba) => {
      const account = accounts.find((a) => a.id === ba.accountId)
      if (!account) return sum
      return sum + computeAccountBalance(account, ledgerEntries, today)
    }, 0)
  }, [bankAccounts, accounts, ledgerEntries, today])

  const pendingApproval = vouchers.filter((v) => v.status === 'pending_approval')
  const draftVouchers = vouchers.filter((v) => v.status === 'draft')
  const approvedNotPosted = vouchers.filter((v) => v.status === 'approved')
  const recentVouchers = [...vouchers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)

  const overdueReceivables = useMemo(() => {
    const buckets = computeAgeingBuckets(receivables, today)
    return buckets.filter((b) => b.d31to60 + b.d61to90 + b.d90plus > 0)
  }, [receivables, today])

  const activeReconciliation = bankReconciliations.find((r) => r.status === 'in_progress')
  const currentChecklist = periodCloseChecklists[periodCloseChecklists.length - 1]
  const openTasks = currentChecklist?.tasks.filter((t) => t.status !== 'done').length ?? 0

  const pendingActions = [
    pendingApproval.length > 0
      ? {
          id: 'approve',
          label: `Approve ${pendingApproval.length} pending voucher(s)`,
          href: '/accounting/entries/approvals',
          priority: 'primary' as const,
        }
      : null,
    approvedNotPosted.length > 0
      ? { id: 'post', label: `Post ${approvedNotPosted.length} approved voucher(s)`, href: '/accounting/entries/journals' }
      : null,
    activeReconciliation
      ? { id: 'recon', label: 'Complete bank reconciliation', href: '/accounting/bank-cash/reconciliation' }
      : null,
    openTasks > 0
      ? { id: 'close', label: `${openTasks} period close task(s) open`, href: '/accounting/period-close' }
      : null,
  ].filter(Boolean) as { id: string; label: string; href: string; priority?: 'primary' }[]

  return (
    <DynamicsModuleDashboard
      title="Accounting Command Center"
      subtitle="Vouchers, ledgers, receivables/payables, bank reconciliation and financial reports — demo module (UI only, no backend posting)."
      badge="Accounting"
      favoritePath="/accounting"
      healthScore={pendingApproval.length > 3 ? 74 : 92}
      heroMetrics={[
        {
          id: 'ar',
          label: 'Receivables Outstanding',
          value: formatCurrency(totalReceivable),
          icon: ArrowDownToLine,
          accent: 'blue',
          href: '/accounting/money-in',
        },
        {
          id: 'ap',
          label: 'Payables Outstanding',
          value: formatCurrency(totalPayable),
          icon: ArrowUpFromLine,
          accent: 'amber',
          href: '/accounting/money-out',
        },
        {
          id: 'cash',
          label: 'Cash & Bank Balance',
          value: formatCurrency(cashBankBalance),
          icon: Wallet,
          accent: 'green',
          href: '/accounting/bank-cash',
        },
        {
          id: 'pending',
          label: 'Vouchers Pending Approval',
          value: pendingApproval.length,
          icon: FileText,
          accent: pendingApproval.length ? 'red' : 'green',
          href: '/accounting/entries/approvals',
        },
      ]}
      liveSections={
        pendingActions.length > 0 ? (
          <DynamicsDashboardPanel title="Pending Actions">
            <ul className="space-y-2">
              {pendingActions.map((action) => (
                <li key={action.id}>
                  <button
                    type="button"
                    onClick={() => navigate(action.href)}
                    className="flex w-full items-center justify-between rounded-md border border-erp-border px-3 py-2 text-left text-[13px] hover:border-erp-primary/40 hover:bg-erp-primary-soft"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-erp-warning-fg" />
                      {action.label}
                    </span>
                    <span className="text-erp-primary">Open →</span>
                  </button>
                </li>
              ))}
            </ul>
          </DynamicsDashboardPanel>
        ) : (
          <DynamicsDashboardPanel title="Pending Actions">
            <p className="flex items-center gap-2 text-[13px] text-erp-success-fg">
              <CheckCircle2 className="h-4 w-4" /> No pending actions — all vouchers posted and reconciled.
            </p>
          </DynamicsDashboardPanel>
        )
      }
      quickActions={
        <>
          <DynamicsCommandButton
            primary
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/accounting/entries/journals/new')}
          >
            New Journal
          </DynamicsCommandButton>
          <DynamicsCommandButton
            icon={<BookOpen className="h-4 w-4" />}
            onClick={() => navigate('/accounting/settings/chart-of-accounts')}
          >
            Chart of Accounts
          </DynamicsCommandButton>
          <DynamicsCommandButton icon={<Landmark className="h-4 w-4" />} onClick={() => navigate('/accounting/bank-cash')}>
            Bank &amp; Cash
          </DynamicsCommandButton>
          <DynamicsCommandButton icon={<IndianRupee className="h-4 w-4" />} onClick={() => navigate('/accounting/ledger-entries')}>
            Ledger Entries
          </DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: 'Draft Vouchers', value: draftVouchers.length, tone: 'neutral', href: '/accounting/entries/journals' },
        {
          label: 'Pending Approval',
          value: pendingApproval.length,
          tone: pendingApproval.length ? 'warning' : 'success',
          href: '/accounting/entries/approvals',
        },
        {
          label: 'Approved (awaiting post)',
          value: approvedNotPosted.length,
          tone: 'primary',
          href: '/accounting/entries/journals',
        },
        {
          label: 'Overdue Customers',
          value: overdueReceivables.length,
          tone: overdueReceivables.length ? 'critical' : 'success',
          href: '/accounting/money-in/ageing',
        },
        {
          label: 'Open Period Tasks',
          value: openTasks,
          tone: openTasks ? 'warning' : 'success',
          href: '/accounting/period-close',
        },
      ]}
      alert={<AccountingRoleBar />}
    >
      <DynamicsDashboardGrid>
        {commercialSummary ? (
          <DynamicsDashboardPanel
            title="Commercial Commitments"
            actions={
              <button
                type="button"
                className="text-[12px] font-semibold text-erp-primary hover:underline"
                onClick={() => navigate('/crm/sales-orders')}
              >
                View sales orders →
              </button>
            }
          >
            <p className="mb-3 flex items-start gap-2 text-[12px] text-erp-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Non-posted commercial value only — excluded from receivables, revenue, GST, and financial reports.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    label: 'Open Sales Order Value',
                    value: commercialSummary.openSalesOrdersValue,
                    helper: `${commercialSummary.openSalesOrdersCount} open orders`,
                    href: '/crm/sales-orders?status=open',
                  },
                  {
                    label: 'Confirmed Sales Order Value',
                    value: commercialSummary.confirmedSalesOrdersValue,
                    helper: `${commercialSummary.confirmedSalesOrdersCount} confirmed orders · Not financially posted`,
                    href: '/crm/sales-orders?status=confirmed',
                    tip: 'Confirmed Sales Orders are commercial commitments. Accounting entries will be created only after invoice posting is implemented.',
                  },
                  {
                    label: 'Orders Pending Invoice',
                    value: commercialSummary.pendingInvoiceValue,
                    helper: `${commercialSummary.pendingInvoiceCount} orders`,
                    href: '/crm/sales-orders',
                  },
                  {
                    label: 'Potential Receivable',
                    value: commercialSummary.potentialReceivable,
                    helper: 'Confirmed but not invoiced',
                    href: '/accounting/money-in',
                  },
                ] as const
              ).map((card) => (
                <button
                  key={card.label}
                  type="button"
                  title={'tip' in card ? card.tip : undefined}
                  onClick={() => navigate(card.href)}
                  className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-left hover:border-amber-300"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{card.label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-erp-text">
                    {formatCurrency(card.value)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-amber-900">Non-posted commercial value</p>
                  <p className="mt-1 text-[11px] text-erp-muted">{card.helper}</p>
                  {card.href.includes('confirmed') ? (
                    <p className="mt-2 text-[11px] font-semibold text-erp-primary">View Confirmed Sales Orders →</p>
                  ) : null}
                </button>
              ))}
            </div>
          </DynamicsDashboardPanel>
        ) : null}

        <DynamicsDashboardPanel
          title="Recent Vouchers"
          actions={<span className="dyn-entity-list-meta">{vouchers.length} total</span>}
          noPadding
        >
          <table className="erp-table">
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Type</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentVouchers.map((v) => (
                <tr key={v.id}>
                  <td>
                    <TableLink to={`/accounting/ledger-entries/voucher/${v.id}`}>{v.voucherNo}</TableLink>
                  </td>
                  <td>{VOUCHER_TYPE_LABELS[v.voucherType]}</td>
                  <td>{formatDate(v.voucherDate)}</td>
                  <td>
                    <AccountingStatusBadge status={v.status} />
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(v.totalDebit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel
          title="Ageing — Top Overdue Customers"
          actions={<span className="dyn-entity-list-meta">{overdueReceivables.length} overdue</span>}
          noPadding
        >
          <table className="erp-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="text-right">31–60d</th>
                <th className="text-right">61–90d</th>
                <th className="text-right">90+d</th>
              </tr>
            </thead>
            <tbody>
              {overdueReceivables.slice(0, 6).map((row) => (
                <tr key={row.partyId}>
                  <td>
                    <TableLink to={`/accounting/money-in/customers/${row.partyId}`}>{row.partyName}</TableLink>
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(row.d31to60)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(row.d61to90)}</td>
                  <td className="text-right tabular-nums font-semibold text-erp-danger-fg">
                    {formatCurrency(row.d90plus)}
                  </td>
                </tr>
              ))}
              {overdueReceivables.length === 0 ? (
                <tr>
                  <td colSpan={4} className="dyn-empty-hint">
                    No overdue receivables
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>
    </DynamicsModuleDashboard>
  )
}

export function AccountingDashboardPage() {
  return isApiMode() ? <ApiAccountingDashboardPage /> : <DemoAccountingDashboardPage />
}
