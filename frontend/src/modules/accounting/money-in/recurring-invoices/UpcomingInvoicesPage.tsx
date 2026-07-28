import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, ListOrdered, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { approveUpcomingInvoice, listUpcomingInvoices } from '@/services/bridges/receivablesApiBridge'
import type { UpcomingSalesInvoiceDto } from '@/services/api/receivablesApi'
import { useAccountingCustomerLookups } from '@/hooks/useAccountingLookups'
import { useMasterStore } from '@/store/masterStore'
import { partyMasterRoute } from '@/modules/accounting/shared/invoices'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { appConfirm } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { moneyInPath } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'
import { RECURRING_FREQUENCY_LABELS } from './RecurringInvoiceListPage'

function executionStatusTone(status: UpcomingSalesInvoiceDto['status']): ErpStatusChipTone {
  switch (status) {
    case 'SCHEDULED':
      return 'warning'
    case 'APPROVED':
      return 'success'
    case 'SKIPPED':
      return 'neutral'
    case 'CANCELLED':
      return 'critical'
    default:
      return 'neutral'
  }
}

function daysUntil(isoDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(isoDate)
  if (Number.isNaN(target.getTime())) return 0
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function UpcomingInvoicesPage() {
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<UpcomingSalesInvoiceDto[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const accountingCustomers = useAccountingCustomerLookups(true)
  const storeCustomers = useMasterStore((s) => s.customers)

  const customerName = useCallback(
    (customerId: string) => {
      const lookup = accountingCustomers?.find((c) => c.id === customerId)
      if (lookup) return lookup.name
      const stored = storeCustomers.find((c) => c.id === customerId)
      return stored?.customerName ?? customerId.slice(0, 8)
    },
    [accountingCustomers, storeCustomers],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listUpcomingInvoices({ status: 'SCHEDULED' })
      setRows(data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load upcoming invoices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canViewInvoice && isApiMode()) void load()
    else setLoading(false)
  }, [load, perms.canViewInvoice])

  const dueCount = useMemo(() => rows.filter((r) => daysUntil(r.invoiceDate) <= 0).length, [rows])

  const onApprove = async (row: UpcomingSalesInvoiceDto) => {
    const confirmed = await appConfirm({
      title: 'Approve this upcoming invoice?',
      description: `Creates a Sales Invoice draft for ${customerName(row.customerId)} dated ${row.invoiceDate}. Review and post it from Invoices afterwards.`,
      confirmLabel: 'Approve & Create Invoice',
      tone: 'success',
    })
    if (!confirmed) return
    setApprovingId(row.id)
    try {
      const invoice = await approveUpcomingInvoice(row.scheduleId, row.id)
      notify.success('Sales invoice draft created from recurring schedule')
      navigate(moneyInPath(`invoices/${invoice.id}`))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to approve upcoming invoice')
    } finally {
      setApprovingId(null)
    }
  }

  if (!perms.canViewInvoice) {
    return (
      <MoneyInWorkspaceShell title="Upcoming Invoices">
        <p className="text-[13px] text-erp-muted">You do not have permission to view invoices.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Upcoming Invoices"
      description="Recurring invoice occurrences due for approval. Approving creates a real Sales Invoice draft and schedules the next cycle."
    >
      {!isApiMode() && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Recurring invoices are available in API mode only. Enable <code className="font-mono">VITE_USE_API=true</code>{' '}
          to view the upcoming queue.
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <Link
          to={moneyInPath('recurring-invoices')}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-erp-accent hover:underline"
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden />
          View Schedules
        </Link>
        <ErpButton variant="secondary" size="sm" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
        <span className="ml-auto text-[11px] text-erp-muted">
          {dueCount} due now · {rows.length} scheduled
        </span>
      </div>

      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="px-1 py-6 text-center text-[13px] text-erp-muted">
          {isApiMode() ? 'No upcoming recurring invoices scheduled.' : 'No demo data — switch to API mode.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Frequency</th>
                <th className="px-3 py-2 font-medium">Invoice Date</th>
                <th className="px-3 py-2 font-medium">Due In</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const due = daysUntil(row.invoiceDate)
                return (
                  <tr key={row.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link to={partyMasterRoute('crm', row.customerId)} className="font-medium text-erp-accent hover:underline">
                        {customerName(row.customerId)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{RECURRING_FREQUENCY_LABELS[row.frequency] ?? row.frequency}</td>
                    <td className="px-3 py-2 tabular-nums">{row.invoiceDate}</td>
                    <td className="px-3 py-2">
                      {due <= 0 ? (
                        <span className="font-medium text-rose-600">{due === 0 ? 'Today' : `${Math.abs(due)}d overdue`}</span>
                      ) : (
                        `in ${due}d`
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ErpStatusChip label={row.status} tone={executionStatusTone(row.status)} />
                    </td>
                    <td className="px-3 py-2">
                      {row.scheduleStatus === 'ACTIVE' && mergeAllowedAction(perms.canCreateInvoice) ? (
                        <ErpButton
                          variant="primary"
                          size="sm"
                          icon={CheckCircle2}
                          disabled={approvingId === row.id}
                          onClick={() => void onApprove(row)}
                        >
                          {approvingId === row.id ? 'Approving…' : 'Approve'}
                        </ErpButton>
                      ) : (
                        '—'
                      )}
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
