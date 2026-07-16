import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Mail, MessageCircle, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { ReceivableDrawerShell, ReceivablesWorkspaceTabs } from '@/components/accounting/receivables'
import {
  createReminderPreview,
  DEFAULT_RECEIVABLE_FILTER,
  excludeReminderDemo,
  getPaymentReminders,
  markReminderDemo,
} from '@/services/accounting/receivablesService'
import type { PaymentReminder, ReceivableFilter, ReminderCategory } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const CATEGORIES: { id: ReminderCategory | ''; label: string }[] = [
  { id: '', label: 'All categories' },
  { id: 'Due Soon', label: 'Due Soon' },
  { id: 'Due Today', label: 'Due Today' },
  { id: '1–7 Days Overdue', label: '1–7 Days Overdue' },
  { id: '8–30 Days Overdue', label: '8–30 Days Overdue' },
  { id: '31–60 Days Overdue', label: '31–60 Days Overdue' },
  { id: 'Above 60 Days', label: 'Above 60 Days' },
  { id: 'Payment Promise Due', label: 'Payment Promise Due' },
  { id: 'Broken Promise', label: 'Broken Promise' },
]

export function ReminderCentrePage() {
  const perms = useReceivablesPermissions()
  const [filter, setFilter] = useState<ReceivableFilter>({ ...DEFAULT_RECEIVABLE_FILTER })
  const [rows, setRows] = useState<PaymentReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewChannel, setPreviewChannel] = useState<'email' | 'whatsapp' | 'print'>('email')
  const [previewBody, setPreviewBody] = useState<{ subject: string; body: string; disclaimer: string } | null>(null)
  const [activeReminder, setActiveReminder] = useState<PaymentReminder | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setRows(
      await getPaymentReminders({
        search: filter.search,
        reminderCategory: filter.reminderCategory || undefined,
      }),
    )
    setLoading(false)
  }, [filter.search, filter.reminderCategory])

  useEffect(() => {
    void load()
  }, [load])

  const kpiStrip = useMemo(
    () => [
      { id: 'due', label: 'Due soon / today', value: rows.filter((r) => r.category === 'Due Soon' || r.category === 'Due Today').length, accent: 'amber' as const },
      { id: 'od', label: 'Overdue', value: rows.filter((r) => r.overdueDays > 0).length, accent: 'red' as const },
      { id: 'amt', label: 'Outstanding', value: formatCompactCurrency(rows.reduce((s, r) => s + r.outstandingAmount, 0)), accent: 'blue' as const },
    ],
    [rows],
  )

  const openPreview = async (r: PaymentReminder, channel: 'email' | 'whatsapp' | 'print') => {
    const preview = await createReminderPreview(r.id, channel)
    setActiveReminder(r)
    setPreviewChannel(channel)
    setPreviewBody(preview)
    setPreviewOpen(true)
  }

  const markSent = async (r: PaymentReminder) => {
    await markReminderDemo(r.id)
    notify.success('Reminder marked as sent in demo mode. No message was delivered.')
    await load()
  }

  const exclude = async (r: PaymentReminder) => {
    await excludeReminderDemo(r.id)
    notify.info('Reminder excluded from this demo queue.')
    await load()
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Reminder Centre" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Reminders' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Reminder Centre"
      description="Payment reminder queue and previews — demo only. Email, WhatsApp and SMS are not connected."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Receivables', to: '/accounting/receivables' }, { label: 'Reminders' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/receivables/reminders"
      kpiStrip={kpiStrip}
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />}
    >
      <ReceivablesWorkspaceTabs active="reminders" />
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">
        Demo reminder centre — mark sent / exclude updates local state only. No real communications are sent.
      </p>
      <div className="mb-3 mt-3 space-y-3">
        <SearchInput value={filter.search} onChange={(v) => setFilter((f) => ({ ...f, search: v }))} placeholder="Search customer, invoice, email…" />
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id || 'all'}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset',
                filter.reminderCategory === cat.id ? 'bg-sky-50 text-sky-900 ring-sky-300' : 'bg-white text-erp-muted ring-erp-border',
              )}
              onClick={() => setFilter((f) => ({ ...f, reminderCategory: cat.id }))}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
      <EnterpriseRegisterTableShell>
        {loading ? <div className="p-6"><LoadingState variant="table" rows={6} /></div> : null}
        {!loading && rows.length === 0 ? <div className="p-6"><EmptyState icon={Bell} title="No reminders in queue" /></div> : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1100px] text-[13px]">
              <thead>
                <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Level</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2 text-left">Contact</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-erp-border/70 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/receivables/customer/${r.customerId}`}>{r.customerName}</TableLink>
                    </td>
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/receivables/invoice/${r.invoiceId}`}>{r.invoiceNumber}</TableLink>
                    </td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2">{r.reminderLevel}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.outstandingAmount)}</td>
                    <td className="px-3 py-2 text-[12px] text-erp-muted">{r.contactPerson} · {r.email}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {perms.canPreviewReminder ? (
                          <>
                            <button type="button" className="erp-btn erp-btn-ghost h-7 px-2 text-[11px]" onClick={() => void openPreview(r, 'email')}>
                              <Mail className="mr-1 inline h-3 w-3" />Email
                            </button>
                            <button type="button" className="erp-btn erp-btn-ghost h-7 px-2 text-[11px]" onClick={() => void openPreview(r, 'whatsapp')}>
                              <MessageCircle className="mr-1 inline h-3 w-3" />WhatsApp
                            </button>
                          </>
                        ) : null}
                        <button type="button" className="erp-btn erp-btn-secondary h-7 px-2 text-[11px]" onClick={() => void markSent(r)}>
                          Mark sent (demo)
                        </button>
                        <button type="button" className="erp-btn erp-btn-ghost h-7 px-2 text-[11px]" onClick={() => void exclude(r)}>
                          Exclude
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </EnterpriseRegisterTableShell>

      <ReceivableDrawerShell
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`${previewChannel} preview`}
        subtitle={activeReminder ? `${activeReminder.customerName} · ${activeReminder.invoiceNumber}` : ''}
        eyebrow="Reminder (demo)"
        footer={
          <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" onClick={() => setPreviewOpen(false)}>
            Close
          </button>
        }
      >
        {previewBody ? (
          <div className="space-y-3 text-[13px]">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">{previewBody.disclaimer}</p>
            <p className="font-semibold">{previewBody.subject}</p>
            <pre className="whitespace-pre-wrap rounded-md border border-erp-border bg-erp-surface-alt/30 p-3 text-[12px]">{previewBody.body}</pre>
          </div>
        ) : null}
      </ReceivableDrawerShell>
    </OperationalPageShell>
  )
}
