import { useEffect, useMemo, useState } from 'react'
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
import { useAccountingStore } from '../../store/accountingStore'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { computeAgeingBuckets, computeAccountBalance } from '../../utils/accounting/ledgerEngine'
import { VOUCHER_TYPE_LABELS } from '../../types/accounting'
import { getCommercialCommitmentSummary } from '../../data/accounting/commercialCommitmentsSeed'
import type { CommercialCommitmentSummary } from '../../types/commercialCommitments'

export function AccountingDashboardPage() {
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
      ? { id: 'approve', label: `Approve ${pendingApproval.length} pending voucher(s)`, href: '/accounting/vouchers?status=pending_approval', priority: 'primary' as const }
      : null,
    approvedNotPosted.length > 0
      ? { id: 'post', label: `Post ${approvedNotPosted.length} approved voucher(s)`, href: '/accounting/vouchers?status=approved' }
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
        { id: 'ar', label: 'Receivables Outstanding', value: formatCurrency(totalReceivable), icon: ArrowDownToLine, accent: 'blue', href: '/accounting/receivables' },
        { id: 'ap', label: 'Payables Outstanding', value: formatCurrency(totalPayable), icon: ArrowUpFromLine, accent: 'amber', href: '/accounting/payables' },
        { id: 'cash', label: 'Cash & Bank Balance', value: formatCurrency(cashBankBalance), icon: Wallet, accent: 'green', href: '/accounting/bank-cash' },
        { id: 'pending', label: 'Vouchers Pending Approval', value: pendingApproval.length, icon: FileText, accent: pendingApproval.length ? 'red' : 'green', href: '/accounting/vouchers' },
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
          <DynamicsCommandButton primary icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/accounting/vouchers/new')}>
            New Voucher
          </DynamicsCommandButton>
          <DynamicsCommandButton icon={<BookOpen className="h-4 w-4" />} onClick={() => navigate('/accounting/chart-of-accounts')}>
            Chart of Accounts
          </DynamicsCommandButton>
          <DynamicsCommandButton icon={<Landmark className="h-4 w-4" />} onClick={() => navigate('/accounting/bank-cash')}>
            Bank &amp; Cash
          </DynamicsCommandButton>
          <DynamicsCommandButton icon={<IndianRupee className="h-4 w-4" />} onClick={() => navigate('/accounting/reports')}>
            Financial Reports
          </DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: 'Draft Vouchers', value: draftVouchers.length, tone: 'neutral', href: '/accounting/vouchers?status=draft' },
        { label: 'Pending Approval', value: pendingApproval.length, tone: pendingApproval.length ? 'warning' : 'success', href: '/accounting/vouchers?status=pending_approval' },
        { label: 'Approved (awaiting post)', value: approvedNotPosted.length, tone: 'primary', href: '/accounting/vouchers?status=approved' },
        { label: 'Overdue Customers', value: overdueReceivables.length, tone: overdueReceivables.length ? 'critical' : 'success', href: '/accounting/receivables/ageing' },
        { label: 'Open Period Tasks', value: openTasks, tone: openTasks ? 'warning' : 'success', href: '/accounting/period-close' },
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
                onClick={() => navigate('/accounting/commercial-commitments')}
              >
                View all →
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
                    href: '/accounting/commercial-commitments',
                  },
                  {
                    label: 'Potential Receivable',
                    value: commercialSummary.potentialReceivable,
                    helper: 'Confirmed but not invoiced',
                    href: '/accounting/commercial-commitments',
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

        <DynamicsDashboardPanel title="Recent Vouchers" actions={<span className="dyn-entity-list-meta">{vouchers.length} total</span>} noPadding>
          <table className="erp-table">
            <thead><tr><th>Voucher No</th><th>Type</th><th>Date</th><th>Status</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {recentVouchers.map((v) => (
                <tr key={v.id}>
                  <td><TableLink to={`/accounting/vouchers/${v.id}`}>{v.voucherNo}</TableLink></td>
                  <td>{VOUCHER_TYPE_LABELS[v.voucherType]}</td>
                  <td>{formatDate(v.voucherDate)}</td>
                  <td><AccountingStatusBadge status={v.status} /></td>
                  <td className="text-right tabular-nums">{formatCurrency(v.totalDebit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel title="Ageing — Top Overdue Customers" actions={<span className="dyn-entity-list-meta">{overdueReceivables.length} overdue</span>} noPadding>
          <table className="erp-table">
            <thead><tr><th>Customer</th><th className="text-right">31–60d</th><th className="text-right">61–90d</th><th className="text-right">90+d</th></tr></thead>
            <tbody>
              {overdueReceivables.slice(0, 6).map((row) => (
                <tr key={row.partyId}>
                  <td><TableLink to={`/accounting/receivables/customers/${row.partyId}`}>{row.partyName}</TableLink></td>
                  <td className="text-right tabular-nums">{formatCurrency(row.d31to60)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(row.d61to90)}</td>
                  <td className="text-right tabular-nums font-semibold text-erp-danger-fg">{formatCurrency(row.d90plus)}</td>
                </tr>
              ))}
              {overdueReceivables.length === 0 ? <tr><td colSpan={4} className="dyn-empty-hint">No overdue receivables</td></tr> : null}
            </tbody>
          </table>
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>
    </DynamicsModuleDashboard>
  )
}
