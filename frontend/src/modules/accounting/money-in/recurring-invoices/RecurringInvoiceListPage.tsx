import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  cancelRecurringSchedule,
  listRecurringSchedules,
} from '@/services/bridges/receivablesApiBridge'
import type { RecurringInvoiceScheduleDto, RecurringInvoiceScheduleStatus } from '@/services/api/receivablesApi'
import { useAccountingCustomerLookups } from '@/hooks/useAccountingLookups'
import { useMasterStore } from '@/store/masterStore'
import { partyMasterRoute } from '@/modules/accounting/shared/invoices'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { moneyInPath } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

export const RECURRING_FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-Yearly',
  YEARLY: 'Yearly',
}

function scheduleStatusTone(status: RecurringInvoiceScheduleStatus): ErpStatusChipTone {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'PAUSED':
      return 'warning'
    case 'CANCELLED':
      return 'critical'
    case 'COMPLETED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function scheduleTotal(schedule: RecurringInvoiceScheduleDto): number {
  const lines = schedule.template.lines ?? []
  const linesTotal = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0)
  return linesTotal + Number(schedule.template.freightAmount ?? 0) + Number(schedule.template.otherChargesAmount ?? 0)
}

export function RecurringInvoiceListPage() {
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<RecurringInvoiceScheduleDto[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

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
      const data = await listRecurringSchedules({})
      setRows(data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load recurring invoice schedules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canViewInvoice && isApiMode()) void load()
    else setLoading(false)
  }, [load, perms.canViewInvoice])

  const activeCount = useMemo(() => rows.filter((r) => r.status === 'ACTIVE').length, [rows])

  const onCancel = async (schedule: RecurringInvoiceScheduleDto) => {
    const reason = await appPromptNote({
      title: 'Cancel recurring invoice schedule?',
      description: `Stops future invoice generation for ${customerName(schedule.customerId)}. Any already-approved invoices are unaffected.`,
      tone: 'danger',
      confirmLabel: 'Cancel schedule',
      note: { required: false, label: 'Reason (optional)' },
    })
    if (reason === null) return
    setCancellingId(schedule.id)
    try {
      await cancelRecurringSchedule(schedule.id, reason || null)
      notify.success('Recurring invoice schedule cancelled')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to cancel schedule')
    } finally {
      setCancellingId(null)
    }
  }

  if (!perms.canViewInvoice) {
    return (
      <MoneyInWorkspaceShell title="Recurring Invoices">
        <p className="text-[13px] text-erp-muted">You do not have permission to view invoices.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Recurring Invoices"
      description="Standing invoice schedules — each due cycle appears in Upcoming for approval before a real Sales Invoice is created."
      actions={
        mergeAllowedAction(perms.canCreateInvoice) ? (
          <ErpButton variant="primary" icon={Plus} onClick={() => navigate(moneyInPath('invoices/new?recurring=1'))}>
            New Recurring Invoice
          </ErpButton>
        ) : null
      }
    >
      {!isApiMode() && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Recurring invoices are available in API mode only. Enable <code className="font-mono">VITE_USE_API=true</code>{' '}
          to manage schedules.
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <Link
          to={moneyInPath('recurring-invoices/upcoming')}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-erp-accent hover:underline"
        >
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          View Upcoming Queue
        </Link>
        <ErpButton variant="secondary" size="sm" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
        <span className="ml-auto text-[11px] text-erp-muted">
          {activeCount} active · {rows.length} schedules
        </span>
      </div>

      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="px-1 py-6 text-center text-[13px] text-erp-muted">
          {isApiMode() ? 'No recurring invoice schedules yet.' : 'No demo data — switch to API mode.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Frequency</th>
                <th className="px-3 py-2 font-medium">Start Date</th>
                <th className="px-3 py-2 font-medium">Next Invoice</th>
                <th className="px-3 py-2 font-medium">End Date</th>
                <th className="px-3 py-2 text-right font-medium">Amount / Cycle</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link to={partyMasterRoute('crm', s.customerId)} className="font-medium text-erp-accent hover:underline">
                      {customerName(s.customerId)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{RECURRING_FREQUENCY_LABELS[s.frequency] ?? s.frequency}</td>
                  <td className="px-3 py-2 tabular-nums">{s.startDate}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">
                    {s.status === 'ACTIVE' ? s.nextInvoiceDate : '-'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{s.endDate ?? '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(scheduleTotal(s))}</td>
                  <td className="px-3 py-2">
                    <ErpStatusChip label={s.status} tone={scheduleStatusTone(s.status)} />
                  </td>
                  <td className="px-3 py-2">
                    {s.status === 'ACTIVE' && mergeAllowedAction(perms.canCancelInvoice) ? (
                      <ErpButton
                        variant="ghost"
                        size="sm"
                        disabled={cancellingId === s.id}
                        onClick={() => void onCancel(s)}
                      >
                        {cancellingId === s.id ? 'Cancelling…' : 'Cancel'}
                      </ErpButton>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
