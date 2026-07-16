import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { ReceivablesWorkspaceTabs } from '@/components/accounting/receivables'
import { DEFAULT_RECEIVABLE_FILTER, getCreditNotes } from '@/services/accounting/receivablesService'
import type { CreditNote, ReceivableFilter } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_approval', label: 'Pending Approval' },
  { id: 'posted', label: 'Posted' },
  { id: 'applied', label: 'Applied' },
  { id: 'partially_applied', label: 'Partially Applied' },
  { id: 'unapplied', label: 'Unapplied' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function CreditNotesPage() {
  const perms = useReceivablesPermissions()
  const [filter, setFilter] = useState<ReceivableFilter>({ ...DEFAULT_RECEIVABLE_FILTER, creditNoteTab: 'all' })
  const [allRows, setAllRows] = useState<CreditNote[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await getCreditNotes({ search: filter.search })
    setAllRows(list)
    setLoading(false)
  }, [filter.search])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    if (filter.creditNoteTab === 'all') return allRows
    const map: Record<string, CreditNote['status']> = {
      draft: 'Draft',
      pending_approval: 'Pending Approval',
      posted: 'Posted',
      applied: 'Applied',
      partially_applied: 'Partially Applied',
      unapplied: 'Unapplied',
      cancelled: 'Cancelled',
    }
    const status = map[filter.creditNoteTab]
    return status ? allRows.filter((r) => r.status === status) : allRows
  }, [allRows, filter.creditNoteTab])

  const kpiStrip = useMemo(
    () => [
      { id: 'total', label: 'Credit notes', value: allRows.length, accent: 'blue' as const },
      { id: 'open', label: 'Unapplied value', value: formatCompactCurrency(allRows.filter((r) => r.remainingAmount > 0).reduce((s, r) => s + r.remainingAmount, 0)), accent: 'amber' as const },
      { id: 'posted', label: 'Posted', value: allRows.filter((r) => r.status === 'Posted').length, accent: 'green' as const },
    ],
    [allRows],
  )

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Credit Notes" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Credit Notes' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Credit Notes"
      description="Customer credit notes and application status — demo UI only."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Receivables', to: '/accounting/receivables' }, { label: 'Credit Notes' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/receivables/credit-notes"
      kpiStrip={kpiStrip}
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />}
    >
      <ReceivablesWorkspaceTabs active="credit_notes" />
      <div className="mb-3 mt-3 space-y-3">
        <SearchInput value={filter.search} onChange={(v) => setFilter((f) => ({ ...f, search: v }))} placeholder="Search credit note, customer…" />
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset',
                filter.creditNoteTab === tab.id ? 'bg-sky-50 text-sky-900 ring-sky-300' : 'bg-white text-erp-muted ring-erp-border',
              )}
              onClick={() => setFilter((f) => ({ ...f, creditNoteTab: tab.id }))}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <EnterpriseRegisterTableShell>
        {loading ? <div className="p-6"><LoadingState variant="table" rows={6} /></div> : null}
        {!loading && rows.length === 0 ? <div className="p-6"><EmptyState icon={FileText} title="No credit notes" /></div> : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                  <th className="px-3 py-2 text-left">Credit note</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Reference invoice</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Remaining</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-erp-border/70 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2 font-medium">{r.creditNoteNumber}</td>
                    <td className="px-3 py-2 tabular-nums">{r.creditNoteDate}</td>
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/receivables/customer/${r.customerId}`}>{r.customerName}</TableLink>
                    </td>
                    <td className="px-3 py-2">{r.referenceInvoiceNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.originalAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.remainingAmount)}</td>
                    <td className="px-3 py-2">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </EnterpriseRegisterTableShell>
    </OperationalPageShell>
  )
}
