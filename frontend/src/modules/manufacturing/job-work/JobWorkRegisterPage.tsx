import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Plus, Send, PackageCheck, Ban, Link2, Scale, Truck } from 'lucide-react'
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
import { getJobWorkOrders, getJobWorkRegisterSummary } from '@/services/manufacturing'
import type { JobWorkFilter, JobWorkOrder } from '@/types/manufacturingJobWork'
import { JW_STATUS_LABELS } from '@/types/manufacturingJobWork'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
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
  { id: 'overdue', label: 'Overdue' },
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
      header: 'Job Work Order',
      cell: ({ row }) => (
        <TableLink to={`/manufacturing/job-work/${row.original.id}`} className="font-mono">
          {row.original.jwNumber}
        </TableLink>
      ),
    },
    { accessorKey: 'workOrderNo', header: 'Work Order' },
    { accessorKey: 'vendorName', header: 'Vendor' },
    { accessorKey: 'process', header: 'Process' },
    {
      id: 'item',
      header: 'Item',
      cell: ({ row }) => (
        <div>
          <div className="text-[13px] font-medium">{row.original.itemCode}</div>
          <div className="text-[11px] text-erp-muted">{row.original.itemName}</div>
        </div>
      ),
    },
    { accessorKey: 'orderedQty', header: 'Ordered' },
    { accessorKey: 'sentQty', header: 'Sent' },
    { accessorKey: 'receivedQty', header: 'Received' },
    { accessorKey: 'acceptedQty', header: 'Accepted' },
    { accessorKey: 'pendingQty', header: 'Pending' },
    { accessorKey: 'materialBalance', header: 'Material Balance' },
    {
      accessorKey: 'expectedReturnDate',
      header: 'Expected Return',
      cell: ({ row }) => formatDate(row.original.expectedReturnDate),
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
        const items: RowActionItem[] = [
          { id: 'view', label: 'View', icon: Eye, onClick: () => navigate(`/manufacturing/job-work/${j.id}`) },
          {
            id: 'edit',
            label: 'Edit Draft',
            icon: Pencil,
            disabled: j.status !== 'draft' || !perms.canEditJobWork,
            disabledReason: 'Only drafts can be edited',
            onClick: () => navigate(`/manufacturing/job-work/${j.id}/edit`),
          },
          {
            id: 'send',
            label: 'Send Material',
            icon: Send,
            disabled: ['closed', 'cancelled'].includes(j.status) || !perms.canDispatchJobWork,
            onClick: () => navigate(`/manufacturing/job-work/${j.id}?action=dispatch`),
          },
          {
            id: 'receive',
            label: 'Receive Material',
            icon: PackageCheck,
            disabled: ['draft', 'closed', 'cancelled'].includes(j.status) || !perms.canReceiveJobWork,
            onClick: () => navigate(`/manufacturing/job-work/${j.id}?action=receive`),
          },
          {
            id: 'return',
            label: 'Return Material',
            icon: Scale,
            onClick: () => navigate(`/manufacturing/job-work/${j.id}?action=return`),
          },
          {
            id: 'reconcile',
            label: 'Reconcile',
            icon: Scale,
            onClick: () => navigate(`/manufacturing/job-work/${j.id}?action=reconcile`),
          },
          {
            id: 'invoice',
            label: 'Link Vendor Invoice',
            icon: Link2,
            onClick: () => navigate(`/manufacturing/job-work/${j.id}?action=invoice`),
          },
          {
            id: 'close',
            label: 'Close',
            onClick: () => navigate(`/manufacturing/job-work/${j.id}?action=close`),
          },
          {
            id: 'cancel',
            label: 'Cancel',
            icon: Ban,
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
      description="Select Work Order → Vendor → Send Material → Receive → Reconcile → Close"
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
              ? { id: 'new', label: 'New Job Work', icon: Plus, onClick: () => navigate('/manufacturing/job-work/new') }
              : undefined
          }
        />
      )}
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Open Job Work" value={summary.open} />
        <Card label="Material with Vendors" value={summary.materialWithVendors} />
        <Card label="Due This Week" value={summary.dueThisWeek} />
        <Card label="Overdue" value={summary.overdue} />
        <Card label="Reconciliation Difference" value={summary.reconciliationDifference} />
        <Card label="Vendor Invoice Pending" value={summary.vendorInvoicePending} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-erp-border pb-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-[12px] font-medium',
              tab === t.id ? 'bg-erp-primary/10 text-erp-primary' : 'text-erp-muted hover:bg-erp-surface-hover',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Job work, WO, vendor…" aria-label="Search job work" />
      </div>

      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState icon={Truck} title="No job work orders" description="Create a job work order from a work order." />
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={rows} />
        </div>
      )}
    </OperationalPageShell>
  )
}
