import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileWarning, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { DisputeStatusBadge, ReceivablesWorkspaceTabs } from '@/components/accounting/receivables'
import { DEFAULT_RECEIVABLE_FILTER, getCustomerDisputes } from '@/services/accounting/receivablesService'
import type { CustomerDispute, ReceivableFilter } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'

const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'awaiting_customer', label: 'Awaiting Customer' },
  { id: 'awaiting_internal_team', label: 'Awaiting Internal' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
]

export function DisputesPage() {
  const navigate = useNavigate()
  const perms = useReceivablesPermissions()
  const [filter, setFilter] = useState<ReceivableFilter>({ ...DEFAULT_RECEIVABLE_FILTER, disputeTab: 'open' })
  const [allRows, setAllRows] = useState<CustomerDispute[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setAllRows(await getCustomerDisputes({ search: filter.search }))
    setLoading(false)
  }, [filter.search])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    if (filter.disputeTab === 'all') return allRows
    const map: Record<string, CustomerDispute['status']> = {
      open: 'Open',
      under_review: 'Under Review',
      awaiting_customer: 'Awaiting Customer',
      awaiting_internal_team: 'Awaiting Internal Team',
      resolved: 'Resolved',
      rejected: 'Rejected',
      closed: 'Closed',
    }
    const status = map[filter.disputeTab]
    return status ? allRows.filter((r) => r.status === status) : allRows
  }, [allRows, filter.disputeTab])

  const openAmount = allRows.filter((d) => !['Resolved', 'Rejected', 'Closed'].includes(d.status)).reduce((s, d) => s + d.disputedAmount, 0)

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Disputes" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Disputes' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Disputes"
      description="Invoice disputes and resolution tracking — demo UI only."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Receivables', to: '/accounting/receivables' }, { label: 'Disputes' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/receivables/disputes"
      kpiStrip={[
        { id: 'open', label: 'Open disputes', value: allRows.filter((d) => d.status === 'Open').length, accent: 'red' },
        { id: 'amt', label: 'Disputed amount', value: formatCompactCurrency(openAmount), accent: 'amber' },
        { id: 'hold', label: 'Collection hold', value: allRows.filter((d) => d.collectionHold).length, accent: 'slate' },
      ]}
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />}
    >
      <ReceivablesWorkspaceTabs active="disputes" />
      <div className="mb-3 mt-3 space-y-3">
        <SearchInput value={filter.search} onChange={(v) => setFilter((f) => ({ ...f, search: v }))} placeholder="Search dispute, customer, invoice…" />
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset',
                filter.disputeTab === tab.id ? 'bg-sky-50 text-sky-900 ring-sky-300' : 'bg-white text-erp-muted ring-erp-border',
              )}
              onClick={() => setFilter((f) => ({ ...f, disputeTab: tab.id }))}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <EnterpriseRegisterTableShell>
        {loading ? <div className="p-6"><LoadingState variant="table" rows={6} /></div> : null}
        {!loading && rows.length === 0 ? <div className="p-6"><EmptyState icon={FileWarning} title="No disputes" /></div> : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1000px] text-[13px]">
              <thead>
                <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                  <th className="px-3 py-2 text-left">Dispute</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-erp-border/70 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2 font-medium">{r.disputeNumber}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="text-sky-700 hover:underline" onClick={() => navigate(`/accounting/receivables/customer/${r.customerId}`)}>
                        {r.customerName}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/receivables/invoice/${r.invoiceId}`}>{r.invoiceNumber}</TableLink>
                    </td>
                    <td className="px-3 py-2">{r.disputeType}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.disputedAmount)}</td>
                    <td className="px-3 py-2">{r.priority}</td>
                    <td className="px-3 py-2"><DisputeStatusBadge status={r.status} /></td>
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
