import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { HandCoins, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { AllocationStatusBadge, ReceiptStatusBadge, ReceivablesWorkspaceTabs } from '@/components/accounting/receivables'
import { DEFAULT_RECEIVABLE_FILTER, getCustomerReceipts } from '@/services/accounting/receivablesService'
import { isApiMode } from '@/config/apiConfig'
import type { CustomerReceipt, ReceivableFilter } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'

const TABS = [
  { id: 'all', label: 'All pending' },
  { id: 'unallocated', label: 'Unallocated' },
  { id: 'partially_allocated', label: 'Partially Allocated' },
  { id: 'posted', label: 'Posted (open balance)' },
]

export function AllocationsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useReceivablesPermissions()
  const customerIdFromUrl = searchParams.get('customerId') ?? ''
  const [filter, setFilter] = useState<ReceivableFilter>({ ...DEFAULT_RECEIVABLE_FILTER, receiptTab: 'unallocated' })
  const [allRows, setAllRows] = useState<CustomerReceipt[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setAllRows(await getCustomerReceipts({ search: filter.search, customerId: customerIdFromUrl }))
    setLoading(false)
  }, [filter.search, customerIdFromUrl])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    let list = allRows.filter((r) => r.voucherStatus !== 'Reversed' && r.voucherStatus !== 'Cancelled')
    if (filter.receiptTab === 'unallocated') list = list.filter((r) => r.allocationStatus === 'Unallocated')
    else if (filter.receiptTab === 'partially_allocated') list = list.filter((r) => r.allocationStatus === 'Partially Allocated')
    else if (filter.receiptTab === 'posted') list = list.filter((r) => r.voucherStatus === 'Posted' && r.unallocatedAmount > 0)
    else list = list.filter((r) => r.unallocatedAmount > 0)
    return list
  }, [allRows, filter.receiptTab])

  const pendingValue = rows.reduce((s, r) => s + r.unallocatedAmount, 0)

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Allocations" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Allocations' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Receipt Allocations"
      description="Receipts with unallocated or partial balances — allocate against open invoices."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Receivables', to: '/accounting/receivables' }, { label: 'Allocations' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/receivables/allocations"
      kpiStrip={[
        { id: 'count', label: 'Pending receipts', value: rows.length, accent: 'blue' },
        { id: 'value', label: 'Unallocated value', value: formatCompactCurrency(pendingValue), accent: 'amber' },
        { id: 'partial', label: 'Partial', value: rows.filter((r) => r.allocationStatus === 'Partially Allocated').length, accent: 'slate' },
      ]}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateReceipt
              ? { id: 'new', label: 'Record Receipt', icon: HandCoins, onClick: () => navigate('/accounting/receivables/receipts/new') }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <ReceivablesWorkspaceTabs active="allocations" />
      <div className="mb-3 mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={filter.search} onChange={(v) => setFilter((f) => ({ ...f, search: v }))} placeholder="Search receipt, customer…" />
          {customerIdFromUrl ? (
            <button
              type="button"
              className="text-[11px] font-semibold text-erp-muted hover:text-erp-text"
              onClick={() => setSearchParams({})}
            >
              Clear customer filter
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset',
                filter.receiptTab === tab.id ? 'bg-sky-50 text-sky-900 ring-sky-300' : 'bg-white text-erp-muted ring-erp-border',
              )}
              onClick={() => setFilter((f) => ({ ...f, receiptTab: tab.id }))}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <EnterpriseRegisterTableShell>
        {loading ? <div className="p-6"><LoadingState variant="table" rows={6} /></div> : null}
        {!loading && rows.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={HandCoins} title="No pending allocations" description="All posted receipts are fully allocated." />
          </div>
        ) : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[960px] text-[13px]">
              <thead>
                <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                  <th className="px-3 py-2 text-left">Receipt</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-right">Receipt amount</th>
                  <th className="px-3 py-2 text-right">Unallocated</th>
                  <th className="px-3 py-2 text-left">Allocation</th>
                  <th className="px-3 py-2 text-left">Voucher</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-erp-border/70 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/receivables/receipts/${r.id}`}>{r.receiptNumber}</TableLink>
                    </td>
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/receivables/customer/${r.customerId}`}>{r.customerName}</TableLink>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.receiptAmount)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-amber-800">{formatCurrency(r.unallocatedAmount)}</td>
                    <td className="px-3 py-2"><AllocationStatusBadge status={r.allocationStatus} /></td>
                    <td className="px-3 py-2"><ReceiptStatusBadge status={r.voucherStatus} /></td>
                    <td className="px-3 py-2">
                      {perms.canAllocate ? (
                        <button
                          type="button"
                          className="erp-btn erp-btn-secondary h-8 px-3 text-[12px]"
                          onClick={() => {
                            if (r.voucherStatus === 'Draft') {
                              navigate(`/accounting/receivables/receipts/${r.id}/edit`)
                            } else if (isApiMode() && r.voucherStatus === 'Posted') {
                              // Live allocation flow posts through the allocation batch API.
                              navigate(`/accounting/receivables/receipts/${r.id}/allocate`)
                            } else {
                              navigate(`/accounting/receivables/receipts/${r.id}`)
                            }
                          }}
                        >
                          Allocate
                        </button>
                      ) : null}
                    </td>
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
