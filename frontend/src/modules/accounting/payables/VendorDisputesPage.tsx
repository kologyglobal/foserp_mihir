import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileWarning, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import {
  PayableDisputeDrawer,
  PayablesSummaryCards,
  PayablesWorkspaceTabs,
  VendorDisputeStatusBadge,
} from '@/components/accounting/payables'
import {
  createVendorDispute,
  DEFAULT_PAYABLE_FILTER,
  getVendorDisputes,
  PayablesServiceError,
  updateVendorDispute,
} from '@/services/accounting/payablesService'
import type { PayableFilter, VendorDispute } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'awaiting_vendor', label: 'Awaiting Vendor' },
  { id: 'awaiting_internal_team', label: 'Awaiting Internal' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
]

export function VendorDisputesPage() {
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [filter, setFilter] = useState<PayableFilter>({ ...DEFAULT_PAYABLE_FILTER, disputeTab: 'open' })
  const [allRows, setAllRows] = useState<VendorDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editDispute, setEditDispute] = useState<VendorDispute | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAllRows(await getVendorDisputes({ search: filter.search }))
    } catch (e) {
      setError(e instanceof PayablesServiceError ? e.message : 'Failed to load disputes')
      setAllRows([])
    } finally {
      setLoading(false)
    }
  }, [filter.search])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    if (filter.disputeTab === 'all') return allRows
    const map: Record<string, VendorDispute['status']> = {
      open: 'Open',
      under_review: 'Under Review',
      awaiting_vendor: 'Awaiting Vendor',
      awaiting_internal_team: 'Awaiting Internal Team',
      resolved: 'Resolved',
      rejected: 'Rejected',
      closed: 'Closed',
    }
    const status = map[filter.disputeTab]
    return status ? allRows.filter((r) => r.status === status) : allRows
  }, [allRows, filter.disputeTab])

  const openAmount = allRows
    .filter((d) => !['Resolved', 'Rejected', 'Closed'].includes(d.status))
    .reduce((s, d) => s + d.disputedAmount, 0)

  const summaryCards = useMemo(
    () => [
      { id: 'open', label: 'Open disputes', value: String(allRows.filter((d) => d.status === 'Open').length), accent: 'red' as const },
      { id: 'amt', label: 'Disputed amount', value: formatCompactCurrency(openAmount), accent: 'amber' as const },
      { id: 'hold', label: 'Payment hold', value: String(allRows.filter((d) => d.paymentHold).length), accent: 'slate' as const },
      { id: 'review', label: 'Under review', value: String(allRows.filter((d) => d.status === 'Under Review').length), accent: 'blue' as const },
    ],
    [allRows, openAmount],
  )

  const handleSaved = async (payload: Partial<VendorDispute>) => {
    try {
      if (editDispute) {
        await updateVendorDispute(editDispute.id, payload)
      } else {
        await createVendorDispute({
          vendorId: payload.vendorId!,
          vendorName: payload.vendorName!,
          invoiceId: payload.invoiceId!,
          invoiceNumber: payload.invoiceNumber!,
          disputeDate: payload.disputeDate!,
          disputeType: payload.disputeType!,
          disputedAmount: payload.disputedAmount!,
          description: payload.description!,
          owner: payload.owner!,
          responsibleDepartment: payload.responsibleDepartment!,
          priority: payload.priority!,
          targetResolutionDate: payload.targetResolutionDate!,
          status: payload.status ?? 'Open',
          resolution: payload.resolution ?? null,
          debitNoteRequired: payload.debitNoteRequired ?? false,
          paymentHold: payload.paymentHold ?? false,
          supportingDocuments: [],
        })
      }
      await load()
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Save failed')
    }
  }

  const openCreate = () => {
    if (!perms.canManageDispute) {
      notify.error('You do not have permission to manage disputes.')
      return
    }
    setEditDispute(null)
    setDrawerOpen(true)
  }

  const openEdit = (dispute: VendorDispute) => {
    if (!perms.canManageDispute) {
      notify.error('You do not have permission to manage disputes.')
      return
    }
    setEditDispute(dispute)
    setDrawerOpen(true)
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Vendor Disputes"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Vendor Disputes' }]}
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
      title="Vendor Disputes"
      description="Vendor invoice disputes linked to purchase orders/GRNs, holds, and resolution tracking."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Payables', to: '/accounting/payables' },
        { label: 'Vendor Disputes' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/disputes"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canManageDispute
              ? { id: 'new', label: 'Raise dispute', icon: Plus, onClick: openCreate }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <PayablesWorkspaceTabs active="disputes" />
      <div className="mb-3 mt-3">
        <PayablesSummaryCards items={summaryCards} />
      </div>
      <div className="mb-3 space-y-3">
        <SearchInput
          value={filter.search}
          onChange={(v) => setFilter((f) => ({ ...f, search: v }))}
          placeholder="Search dispute, vendor, invoice…"
        />
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
        {loading ? (
          <div className="p-6">
            <LoadingState variant="table" rows={6} />
          </div>
        ) : null}
        {!loading && error ? (
          <div className="p-6">
            <EmptyState icon={FileWarning} title="Could not load disputes" description={error} />
          </div>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={FileWarning} title="No disputes" />
          </div>
        ) : null}
        {!loading && !error && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1180px] text-[13px]">
              <thead>
                <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                  <th className="px-3 py-2 text-left">Dispute</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">Purchase order</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-left">Owner</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-erp-border/70 hover:bg-erp-surface-alt/40"
                    onClick={() => openEdit(r)}
                  >
                    <td className="px-3 py-2 font-medium">{r.disputeNumber}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-sky-700 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/accounting/payables/vendor/${r.vendorId}`)
                        }}
                      >
                        {r.vendorName}
                      </button>
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <TableLink to={`/accounting/money-out/vendor-invoices/${r.invoiceId}`}>{r.invoiceNumber}</TableLink>
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {r.purchaseOrders?.length
                        ? r.purchaseOrders.map((po, index) => (
                            <span key={po.id}>
                              {index > 0 ? ', ' : null}
                              <TableLink to={`/purchase/orders/${po.id}`}>{po.number}</TableLink>
                            </span>
                          ))
                        : '—'}
                    </td>
                    <td className="px-3 py-2">{r.disputeType}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.disputedAmount)}</td>
                    <td className="px-3 py-2">{r.priority}</td>
                    <td className="px-3 py-2">{r.owner}</td>
                    <td className="px-3 py-2">
                      <VendorDisputeStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </EnterpriseRegisterTableShell>

      <PayableDisputeDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditDispute(null)
        }}
        dispute={editDispute}
        onSaved={(payload) => void handleSaved(payload)}
      />
    </OperationalPageShell>
  )
}
