import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, HandCoins, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import {
  PayablesCoreFlowStrip,
  PayablesWorkspaceTabs,
  PaymentAllocationStatusBadge,
  VendorPaymentStatusBadge,
} from '@/components/accounting/payables'
import { DEFAULT_PAYABLE_FILTER, getVendorPayments } from '@/services/accounting/payablesService'
import type { PayableFilter, VendorPayment } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'

const TABS = [
  { id: 'all', label: 'All pending' },
  { id: 'unallocated', label: 'Unallocated' },
  { id: 'partially_allocated', label: 'Partially Allocated' },
  { id: 'posted', label: 'Posted (open balance)' },
]

export function PaymentAllocationsPage() {
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [filter, setFilter] = useState<PayableFilter>({ ...DEFAULT_PAYABLE_FILTER, paymentTab: 'unallocated' })
  const [allRows, setAllRows] = useState<VendorPayment[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setAllRows(await getVendorPayments({ search: filter.search }))
    setLoading(false)
  }, [filter.search])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    let list = allRows.filter((p) => p.status !== 'Reversed' && p.status !== 'Cancelled')
    if (filter.paymentTab === 'unallocated') list = list.filter((p) => p.allocationStatus === 'Unallocated')
    else if (filter.paymentTab === 'partially_allocated') list = list.filter((p) => p.allocationStatus === 'Partially Allocated')
    else if (filter.paymentTab === 'posted') list = list.filter((p) => p.status === 'Posted' && p.unallocatedAmount > 0)
    else list = list.filter((p) => p.unallocatedAmount > 0)
    return list
  }, [allRows, filter.paymentTab])

  const pendingValue = rows.reduce((s, p) => s + p.unallocatedAmount, 0)

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Payment Allocations"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Payables', to: '/accounting/payables' },
          { label: 'Allocations' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Payment Allocations"
      description="Primary AP workspace — apply vendor payments to open invoices before posting preview and ledger review."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Payables', to: '/accounting/payables' },
        { label: 'Allocations' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/allocations"
      kpiStrip={[
        { id: 'count', label: 'Pending payments', value: rows.length, accent: 'blue' },
        { id: 'value', label: 'Unallocated value', value: formatCompactCurrency(pendingValue), accent: 'amber' },
        {
          id: 'partial',
          label: 'Partial',
          value: rows.filter((p) => p.allocationStatus === 'Partially Allocated').length,
          accent: 'slate',
        },
      ]}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreatePayment
              ? {
                  id: 'new',
                  label: 'New Payment',
                  icon: HandCoins,
                  onClick: () => navigate('/accounting/payables/payments/new?workspace=allocation'),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'planning',
              label: 'Payment Planning',
              icon: CalendarClock,
              onClick: () => navigate('/accounting/payables/payment-planning'),
            },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      }
    >
      <PayablesWorkspaceTabs active="allocations" />
      <PayablesCoreFlowStrip active="allocation" className="mt-3" />
      <div className="mb-3 mt-3 space-y-3">
        <SearchInput value={filter.search} onChange={(v) => setFilter((f) => ({ ...f, search: v }))} placeholder="Search payment, vendor…" />
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset',
                filter.paymentTab === tab.id ? 'bg-sky-50 text-sky-900 ring-sky-300' : 'bg-white text-erp-muted ring-erp-border',
              )}
              onClick={() => setFilter((f) => ({ ...f, paymentTab: tab.id }))}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <EnterpriseRegisterTableShell>
        {loading ? (
          <div className="p-6">
            <LoadingState variant="table" rows={6} />
          </div>
        ) : null}
        {!loading && rows.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={HandCoins} title="No pending allocations" description="All posted payments are fully allocated." />
          </div>
        ) : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[960px] text-[13px]">
              <thead>
                <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                  <th className="px-3 py-2 text-left">Payment</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-right">Payment amount</th>
                  <th className="px-3 py-2 text-right">Unallocated</th>
                  <th className="px-3 py-2 text-left">Allocation</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-erp-border/70 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/payables/payments/${p.id}`}>{p.paymentNumber}</TableLink>
                    </td>
                    <td className="px-3 py-2">{p.vendorName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.amount)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-amber-800">
                      {formatCurrency(p.unallocatedAmount)}
                    </td>
                    <td className="px-3 py-2">
                      <PaymentAllocationStatusBadge status={p.allocationStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <VendorPaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2">
                      {perms.canAllocatePayment ? (
                        <button
                          type="button"
                          className="erp-btn erp-btn-secondary h-8 px-3 text-[12px]"
                          onClick={() =>
                            navigate(
                              p.status === 'Draft'
                                ? `/accounting/payables/payments/${p.id}/edit?workspace=allocation`
                                : `/accounting/payables/payments/${p.id}?allocate=1`,
                            )
                          }
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
