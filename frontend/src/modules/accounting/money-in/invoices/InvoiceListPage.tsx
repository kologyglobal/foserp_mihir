import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { ReceivablesSummaryCards } from '@/components/accounting/receivables'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { listSalesInvoices } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { SalesInvoiceDto, SalesInvoiceStatus } from '@/types/moneyIn'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { partyMasterRoute, sourceTypeLabel } from '@/modules/accounting/shared/invoices'
import { cn } from '@/utils/cn'
import { invoiceDisplayNumber, moneyInStatusTone, MONEY_IN_STATUS_LABELS, parseDecimal, resolveSettlementStatus, SETTLEMENT_STATUS_LABELS, settlementStatusTone } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

type InvoiceViewTab = 'all' | 'draft' | 'ready' | 'open' | 'overdue' | 'paid' | 'cancelled'

const VIEW_TABS: Array<{ id: InvoiceViewTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'ready', label: 'Ready to Post' },
  { id: 'open', label: 'Open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
  { id: 'cancelled', label: 'Cancelled' },
]

/** Legacy `?status=` deep links (from the old status dropdown) map onto view tabs. */
const STATUS_TO_TAB: Partial<Record<SalesInvoiceStatus, InvoiceViewTab>> = {
  DRAFT: 'draft',
  READY_TO_POST: 'ready',
  POSTED: 'open',
  CANCELLED: 'cancelled',
}

interface InvoiceRegisterRow {
  invoice: SalesInvoiceDto
  outstanding: number
  total: number
  /** Posted with an open balance. */
  isOpen: boolean
  isPaid: boolean
  overdueDays: number
  ageingBucket: string
}

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso)
  if (Number.isNaN(from.getTime())) return 0
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

function ageingBucketLabel(overdueDays: number): string {
  if (overdueDays <= 0) return 'Not Due'
  if (overdueDays <= 30) return '1-30 Days'
  if (overdueDays <= 60) return '31-60 Days'
  if (overdueDays <= 90) return '61-90 Days'
  if (overdueDays <= 180) return '91-180 Days'
  return 'Above 180 Days'
}

function toRegisterRow(invoice: SalesInvoiceDto, today: Date): InvoiceRegisterRow {
  const outstanding = parseDecimal(invoice.outstandingAmount)
  const total = parseDecimal(invoice.totalAmount)
  const isPosted = invoice.status === 'POSTED'
  const isOpen = isPosted && outstanding > 0
  const overdueDays = isOpen && invoice.dueDate ? Math.max(0, daysBetween(invoice.dueDate, today)) : 0
  return {
    invoice,
    outstanding,
    total,
    isOpen,
    isPaid: isPosted && outstanding <= 0,
    overdueDays,
    ageingBucket: isOpen ? ageingBucketLabel(overdueDays) : 'Not Due',
  }
}

function matchesTab(row: InvoiceRegisterRow, tab: InvoiceViewTab): boolean {
  switch (tab) {
    case 'all':
      return true
    case 'draft':
      return row.invoice.status === 'DRAFT'
    case 'ready':
      return row.invoice.status === 'READY_TO_POST'
    case 'open':
      return row.isOpen
    case 'overdue':
      return row.overdueDays > 0
    case 'paid':
      return row.isPaid
    case 'cancelled':
      return row.invoice.status === 'CANCELLED' || row.invoice.status === 'REVERSED'
  }
}

export function InvoiceListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<SalesInvoiceDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<InvoiceViewTab>(() => {
    const fromTab = searchParams.get('view') as InvoiceViewTab | null
    if (fromTab && VIEW_TABS.some((t) => t.id === fromTab)) return fromTab
    const fromStatus = searchParams.get('status') as SalesInvoiceStatus | null
    return (fromStatus && STATUS_TO_TAB[fromStatus]) || 'all'
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listSalesInvoices({
        legalEntityId: resolveLegalEntityId(),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    if (perms.canViewInvoice) void load()
  }, [load, perms.canViewInvoice])

  const registerRows = useMemo(() => {
    const today = new Date()
    return rows.map((inv) => toRegisterRow(inv, today))
  }, [rows])

  const summary = useMemo(
    () => ({
      total: registerRows.length,
      open: registerRows.filter((r) => r.isOpen).length,
      overdue: registerRows.filter((r) => r.overdueDays > 0).length,
      inProgress: registerRows.filter((r) => r.invoice.status === 'DRAFT' || r.invoice.status === 'READY_TO_POST')
        .length,
      outstanding: registerRows.reduce((s, r) => s + (r.isOpen ? r.outstanding : 0), 0),
    }),
    [registerRows],
  )

  const kpiItems: EnterpriseKpiItem[] = [
    { id: 'all', label: 'Invoices', value: summary.total, accent: 'blue', onClick: () => setTab('all') },
    { id: 'open', label: 'Open', value: summary.open, accent: 'blue', onClick: () => setTab('open') },
    { id: 'overdue', label: 'Overdue', value: summary.overdue, accent: 'red', onClick: () => setTab('overdue') },
    { id: 'draft', label: 'Draft / Ready', value: summary.inProgress, accent: 'amber', onClick: () => setTab('draft') },
    {
      id: 'outstanding',
      label: 'Total Outstanding',
      value: formatCompactCurrency(summary.outstanding),
      helper: formatCurrency(summary.outstanding),
      accent: 'slate',
    },
  ]

  const visibleRows = useMemo(() => registerRows.filter((r) => matchesTab(r, tab)), [registerRows, tab])

  if (!perms.canViewInvoice) {
    return (
      <MoneyInWorkspaceShell title="Invoices">
        <p className="text-[13px] text-erp-muted">You do not have permission to view invoices.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Invoices"
      actions={
        mergeAllowedAction(perms.canCreateInvoice) ? (
          <ErpButton variant="primary" icon={Plus} onClick={() => navigate('/accounting/money-in/invoices/new')}>
            New Invoice
          </ErpButton>
        ) : null
      }
    >
      {/* View sub-tabs — mirrors the Receivables register */}
      <div className="flex flex-wrap gap-1 border-b border-erp-border">
        {VIEW_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              'rounded-t-md px-3 py-2 text-[12px] font-semibold',
              tab === t.id
                ? 'border border-b-white border-erp-border bg-white text-erp-primary'
                : 'text-erp-muted hover:text-erp-text',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <ReceivablesSummaryCards items={kpiItems} activeId={tab === 'ready' ? 'draft' : tab} />
      </div>

      <div className="mb-2 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <Input
          className="h-9 w-full max-w-xs text-[12px]"
          placeholder="Invoice, customer, SO…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ErpButton variant="secondary" size="sm" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
        <span className="ml-auto text-[11px] text-erp-muted">
          {visibleRows.length} of {registerRows.length} invoices
        </span>
      </div>

      {loading ? (
        <LoadingState variant="table" />
      ) : visibleRows.length === 0 ? (
        <p className="px-1 py-6 text-center text-[13px] text-erp-muted">No invoices match your filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Invoice Date</th>
                <th className="px-3 py-2 font-medium">Due Date</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 text-right font-medium">Original</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
                <th className="px-3 py-2 text-right font-medium">Overdue</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Settlement</th>
                <th className="px-3 py-2 font-medium">Ageing</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ invoice: inv, total, outstanding, isOpen, overdueDays, ageingBucket }) => {
                const actions = inv.allowedActions
                const settlement = resolveSettlementStatus(inv)
                return (
                  <tr key={inv.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link
                        to={`/accounting/money-in/invoices/${inv.id}`}
                        className="font-medium text-erp-accent hover:underline"
                      >
                        {invoiceDisplayNumber(inv)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{inv.invoiceDate}</td>
                    <td className="px-3 py-2 tabular-nums">{inv.dueDate ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Link
                        to={partyMasterRoute('crm', inv.customerId)}
                        className="hover:text-erp-accent hover:underline"
                        title="Open CRM Company 360"
                      >
                        {inv.customerNameSnapshot}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{sourceTypeLabel(inv.sourceType)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {inv.status === 'POSTED' || inv.status === 'REVERSED' ? formatCurrency(outstanding) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {overdueDays > 0 ? (
                        <span className="font-medium text-rose-600">{overdueDays}d</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ErpStatusChip
                        label={
                          inv.status === 'POSTED' ? (isOpen ? 'Open' : 'Paid') : MONEY_IN_STATUS_LABELS[inv.status]
                        }
                        tone={inv.status === 'POSTED' && !isOpen ? 'success' : moneyInStatusTone(inv.status)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {settlement ? (
                        <ErpStatusChip
                          label={SETTLEMENT_STATUS_LABELS[settlement]}
                          tone={settlementStatusTone(settlement)}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-erp-muted">{isOpen ? ageingBucket : '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <ErpButton
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/accounting/money-in/invoices/${inv.id}`)}
                        >
                          View
                        </ErpButton>
                        {mergeAllowedAction(perms.canEditInvoice, actions?.edit) && (
                          <ErpButton
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/accounting/money-in/invoices/${inv.id}/edit`)}
                          >
                            Edit
                          </ErpButton>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
