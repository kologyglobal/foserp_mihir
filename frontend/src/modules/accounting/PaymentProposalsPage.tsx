import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, FileSpreadsheet, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { TableLink } from '@/components/ui/AppLink'
import { PayablesWorkspaceTabs, PaymentProposalStatusBadge } from '@/components/accounting/payables'
import {
  DEFAULT_PAYABLE_FILTER,
  exportPayables,
  getPaymentProposals,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type { PayableFilter, PaymentProposal } from '@/types/payables'
import { PAYMENT_PROPOSAL_STATUS_LABELS } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_approval', label: 'Pending Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'partially_processed', label: 'Partially Processed' },
  { id: 'processed', label: 'Processed' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
]

function proposalLabel(status: PaymentProposal['status']) {
  return PAYMENT_PROPOSAL_STATUS_LABELS[status] ?? status
}

function tabCount(rows: PaymentProposal[], tab: string) {
  if (tab === 'all') return rows.length
  if (tab === 'pending_approval') return rows.filter((r) => ['Submitted', 'Pending Approval'].includes(r.status)).length
  const map: Record<string, (r: PaymentProposal) => boolean> = {
    draft: (r) => r.status === 'Draft',
    approved: (r) => r.status === 'Approved',
    partially_processed: (r) => r.status === 'Partially Processed',
    processed: (r) => r.status === 'Processed',
    rejected: (r) => r.status === 'Rejected',
    cancelled: (r) => r.status === 'Cancelled',
  }
  return rows.filter(map[tab] ?? (() => true)).length
}

export function PaymentProposalsPage() {
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [filter, setFilter] = useState<PayableFilter>({ ...DEFAULT_PAYABLE_FILTER, proposalTab: 'all' })
  const [allRows, setAllRows] = useState<PaymentProposal[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const load = useCallback(async () => {
    if (!perms.canView) {
      setLoadState('error')
      setErrorMsg('You do not have permission to view payment proposals.')
      return
    }
    setLoadState('loading')
    try {
      const list = await getPaymentProposals({ search: filter.search })
      setAllRows(list)
      const filtered = await getPaymentProposals({ search: filter.search, proposalTab: filter.proposalTab })
      setLoadState(filtered.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load proposals')
      setLoadState('error')
    }
  }, [filter.search, filter.proposalTab, perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    return allRows.filter((r) => {
      if (filter.proposalTab === 'all') return true
      if (filter.proposalTab === 'pending_approval') return ['Submitted', 'Pending Approval'].includes(r.status)
      const map: Record<string, (x: PaymentProposal) => boolean> = {
        draft: (x) => x.status === 'Draft',
        approved: (x) => x.status === 'Approved',
        partially_processed: (x) => x.status === 'Partially Processed',
        processed: (x) => x.status === 'Processed',
        rejected: (x) => x.status === 'Rejected',
        cancelled: (x) => x.status === 'Cancelled',
      }
      return map[filter.proposalTab]?.(r) ?? true
    })
  }, [allRows, filter.proposalTab])

  const kpiItems: EnterpriseKpiItem[] = useMemo(
    () => [
      {
        id: 'total',
        label: 'Total proposals',
        value: allRows.length,
        accent: 'blue',
        active: filter.proposalTab === 'all',
        onClick: () => setFilter((f) => ({ ...f, proposalTab: 'all' })),
      },
      {
        id: 'draft',
        label: 'Draft',
        value: tabCount(allRows, 'draft'),
        accent: 'slate',
        active: filter.proposalTab === 'draft',
        onClick: () => setFilter((f) => ({ ...f, proposalTab: 'draft' })),
      },
      {
        id: 'pending',
        label: 'Pending approval',
        value: tabCount(allRows, 'pending_approval'),
        accent: 'amber',
        active: filter.proposalTab === 'pending_approval',
        onClick: () => setFilter((f) => ({ ...f, proposalTab: 'pending_approval' })),
      },
      {
        id: 'value',
        label: 'Approved value',
        value: formatCompactCurrency(
          allRows.filter((r) => r.status === 'Approved' || r.status === 'Partially Processed').reduce((s, r) => s + r.totalAmount, 0),
        ),
        accent: 'green',
        active: filter.proposalTab === 'approved',
        onClick: () => setFilter((f) => ({ ...f, proposalTab: 'approved' })),
      },
    ],
    [allRows, filter.proposalTab],
  )

  const handleExport = async () => {
    try {
      const result = await exportPayables({ scope: 'payment_proposals', format: 'csv', filter })
      notify.success(`${result.filename} — ${result.disclaimer}`)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Export failed')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Payment Proposals"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Payables', to: '/accounting/payables' },
          { label: 'Payment Proposals' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing accounting.payables.view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Payment Proposals"
      description="Batch payment proposals for vendor disbursement — demo UI only. No bank files are generated."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Payables', to: '/accounting/payables' },
        { label: 'Payment Proposals' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/payment-proposals"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpiItems : undefined}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreatePaymentProposal
              ? {
                  id: 'plan',
                  label: 'Payment Planning',
                  icon: Plus,
                  onClick: () => navigate('/accounting/payables/payment-planning'),
                }
              : undefined
          }
          secondaryActions={[
            ...(perms.canExport ? [{ id: 'export', label: 'Export', icon: FileSpreadsheet, onClick: () => void handleExport() }] : []),
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      }
    >
      <PayablesWorkspaceTabs active="payment_proposals" />
      <div className="mb-3 mt-3 flex flex-col gap-3">
        <SearchInput
          value={filter.search}
          onChange={(v) => setFilter((f) => ({ ...f, search: v }))}
          placeholder="Search proposal no, created by…"
        />
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Proposal status tabs">
          {TABS.map((tab) => {
            const count = tabCount(allRows, tab.id)
            const selected = filter.proposalTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset',
                  selected
                    ? 'bg-sky-50 text-sky-900 ring-sky-300'
                    : 'bg-white text-erp-muted ring-erp-border hover:bg-erp-surface-alt',
                )}
                onClick={() => setFilter((f) => ({ ...f, proposalTab: tab.id }))}
              >
                {tab.label}
                <span className="tabular-nums text-[11px] opacity-80">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? (
          <div className="p-6">
            <LoadingState variant="table" rows={8} />
          </div>
        ) : null}
        {loadState === 'error' ? (
          <div className="p-6">
            <EmptyState icon={FileSpreadsheet} title="Could not load proposals" description={errorMsg} />
          </div>
        ) : null}
        {loadState === 'empty' ? (
          <div className="p-6">
            <EmptyState
              icon={FileSpreadsheet}
              title="No proposals match"
              description="Generate a payment plan to create a batch proposal."
              action={
                perms.canCreatePaymentProposal ? (
                  <button
                    type="button"
                    className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                    onClick={() => navigate('/accounting/payables/payment-planning')}
                  >
                    Open payment planning
                  </button>
                ) : null
              }
            />
          </div>
        ) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1000px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                  <th className="px-3 py-2 font-semibold">Proposal No</th>
                  <th className="px-3 py-2 font-semibold">Payment date</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 text-right font-semibold">Vendors</th>
                  <th className="px-3 py-2 text-right font-semibold">Invoices</th>
                  <th className="px-3 py-2 font-semibold">Created by</th>
                  <th className="px-3 py-2 font-semibold">Created at</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/payables/payment-proposals/${r.id}`}>{r.proposalNumber}</TableLink>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.proposedPaymentDate}</td>
                    <td className="px-3 py-2">
                      <PaymentProposalStatusBadge status={r.status} />
                      {proposalLabel(r.status) !== r.status ? (
                        <span className="ml-1 text-[11px] text-erp-muted">({proposalLabel(r.status)})</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.totalAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.vendorCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.invoiceCount}</td>
                    <td className="px-3 py-2">{r.createdBy}</td>
                    <td className="px-3 py-2 tabular-nums text-[12px] text-erp-muted">{formatDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                        title="View"
                        onClick={() => navigate(`/accounting/payables/payment-proposals/${r.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
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
