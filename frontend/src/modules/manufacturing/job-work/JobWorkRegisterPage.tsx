import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Plus, Send, PackageCheck, Ban, Scale, Truck } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { ManufacturingAiRail, ManufacturingDemoBanner } from '@/components/manufacturing'
import { getJobWorkOrders, getJobWorkRegisterSummary } from '@/services/manufacturing'
import type { JobWorkFilter, JobWorkOrder } from '@/types/manufacturingJobWork'
import { JW_STATUS_LABELS } from '@/types/manufacturingJobWork'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { buildJobWorkAiInsights } from '@/utils/manufacturing/insights'
import { cn } from '@/utils/cn'

const TABS: { id: NonNullable<JobWorkFilter['tab']>; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'material_sent', label: 'Material Sent' },
  { id: 'partially_received', label: 'Partially Received' },
  { id: 'received', label: 'Received' },
  { id: 'reconciliation_pending', label: 'Reconciliation Pending' },
  { id: 'closed', label: 'Closed' },
  { id: 'cancelled', label: 'Cancelled' },
]

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-erp-border bg-erp-surface px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase text-erp-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-erp-text">{value}</div>
    </div>
  )
}

export function JobWorkRegisterPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [tab, setTab] = useState<NonNullable<JobWorkFilter['tab']>>('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<JobWorkOrder[]>([])
  const [summary, setSummary] = useState({
    open: 0,
    materialWithVendors: 0,
    dueThisWeek: 0,
    overdue: 0,
    reconciliationDifference: 0,
    vendorInvoicePending: 0,
  })
  const [loading, setLoading] = useState(true)

  const aiSuggestions = useMemo(() => buildJobWorkAiInsights(rows), [rows])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, sum] = await Promise.all([
        getJobWorkOrders({ tab, search: search || undefined }),
        getJobWorkRegisterSummary(),
      ])
      setRows(list)
      setSummary(sum)
    } catch {
      notify.error('Failed to load job work')
    } finally {
      setLoading(false)
    }
  }, [tab, search])

  useEffect(() => {
    void load()
  }, [load])

  const columns = useMemo<ColumnDef<JobWorkOrder>[]>(() => [
    {
      accessorKey: 'jwNumber',
      header: 'Job Work No',
      cell: ({ row }) => (
        <TableLink to={`/manufacturing/job-work/${row.original.id}`} className="font-mono font-semibold">
          {row.original.jwNumber}
        </TableLink>
      ),
    },
    {
      accessorKey: 'workOrderNo',
      header: 'Linked WO',
      cell: ({ row }) => (
        <TableLink to={`/manufacturing/work-orders/${row.original.workOrderId}`} className="font-mono">
          {row.original.workOrderNo}
        </TableLink>
      ),
    },
    { accessorKey: 'vendorName', header: 'Vendor' },
    { accessorKey: 'process', header: 'Process' },
    {
      accessorKey: 'materialSentDate',
      header: 'Material Sent Date',
      cell: ({ row }) => (row.original.materialSentDate ? formatDate(row.original.materialSentDate) : '—'),
    },
    {
      accessorKey: 'sentQty',
      header: 'Sent Qty',
      cell: ({ row }) => <span className="tabular-nums">{row.original.sentQty}</span>,
    },
    {
      accessorKey: 'receivedQty',
      header: 'Received Qty',
      cell: ({ row }) => <span className="tabular-nums">{row.original.receivedQty}</span>,
    },
    {
      id: 'balance',
      header: 'Balance Qty',
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">{row.original.pendingQty}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusDot tone={statusToneFromLabel(row.original.status)} label={JW_STATUS_LABELS[row.original.status]} />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const j = row.original
        const closed = ['closed', 'cancelled'].includes(j.status)
        const items: RowActionItem[] = [
          { id: 'view', label: 'View', icon: Eye, onClick: () => navigate(`/manufacturing/job-work/${j.id}`) },
          {
            id: 'edit',
            label: 'Edit',
            icon: Pencil,
            disabled: j.status !== 'draft' || !perms.canEditJobWork,
            disabledReason: 'Only drafts can be edited',
            onClick: () => navigate(`/manufacturing/job-work/${j.id}/edit`),
          },
          {
            id: 'send',
            label: 'Send Material',
            icon: Send,
            disabled: closed || j.status === 'cancelled' || !perms.canDispatchJobWork,
            onClick: () => navigate(`/manufacturing/job-work/${j.id}?action=dispatch`),
          },
          {
            id: 'receive',
            label: 'Receive',
            icon: PackageCheck,
            disabled: ['draft', 'closed', 'cancelled'].includes(j.status) || !perms.canReceiveJobWork,
            onClick: () => navigate(`/manufacturing/job-work/${j.id}?action=receive`),
          },
          {
            id: 'reconcile',
            label: 'Reconcile',
            icon: Scale,
            disabled: closed || !perms.canReconcileJobWork,
            onClick: () => navigate(`/manufacturing/job-work/${j.id}?tab=reconciliation&action=reconcile`),
          },
          {
            id: 'cancel',
            label: 'Cancel',
            icon: Ban,
            disabled: closed || !perms.canCancelJobWork,
            onClick: () => navigate(`/manufacturing/job-work/${j.id}?action=cancel`),
          },
        ]
        return <EnterpriseRowActionsMenu actions={items} />
      },
    },
  ], [navigate, perms])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Job Work"
      description="Outside processing for a Work Order — send material, receive, reconcile. Not a separate production system."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Job Work' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/manufacturing/job-work"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateJobWork
              ? { id: 'new', label: 'Create Job Work', icon: Plus, onClick: () => navigate('/manufacturing/job-work/new') }
              : undefined
          }
        />
      )}
    >
      <ManufacturingAiRail title="Job Work Insights" suggestions={aiSuggestions}>
      <div className="space-y-3">
        <ManufacturingDemoBanner message="Job Work hangs off a Work Order for outside processing — no subcontracting accounting." />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Card label="Open" value={summary.open} />
          <Card label="With Vendors" value={summary.materialWithVendors} />
          <Card label="Due This Week" value={summary.dueThisWeek} />
          <Card label="Overdue" value={summary.overdue} />
          <Card label="Recon Diff" value={summary.reconciliationDifference} />
          <Card label="Invoice Pending" value={summary.vendorInvoicePending} />
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-erp-border bg-white p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition',
                tab === t.id ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <SearchInput value={search} onChange={setSearch} placeholder="Search JW no, WO, vendor, process…" aria-label="Search job work" />

        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No job work orders"
            description="Create a job work from a work order to send material for outside processing."
            action={
              perms.canCreateJobWork ? (
                <button type="button" className="erp-btn erp-btn-primary mt-3" onClick={() => navigate('/manufacturing/job-work/new')}>
                  Create Job Work
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-erp-border bg-white">
            <DataTable columns={columns} data={rows} />
          </div>
        )}
      </div>
      </ManufacturingAiRail>
    </OperationalPageShell>
  )
}
