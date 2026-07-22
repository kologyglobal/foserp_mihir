import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Plus, Send, PackageCheck, Ban, Scale, Truck } from 'lucide-react'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { getJobWorkOrders, getJobWorkRegisterSummary } from '@/services/manufacturing'
import type { JobWorkFilter, JobWorkOrder } from '@/types/manufacturingJobWork'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { cn } from '@/utils/cn'
import {
  JobWorkStatusBadge,
  ProductionEmptyState,
  ProductionPageHeader,
} from '../ui'

const TABS: { id: NonNullable<JobWorkFilter['tab']>; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'material_sent', label: 'Material Sent' },
  { id: 'partially_received', label: 'Partially Received' },
  { id: 'received', label: 'Received' },
  { id: 'reconciliation_pending', label: 'Reconciliation' },
  { id: 'closed', label: 'Closed' },
  { id: 'cancelled', label: 'Cancelled' },
]

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

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(
    () => [
      { id: 'open', label: 'Open', value: summary.open, accent: 'blue' },
      { id: 'vendors', label: 'With Vendors', value: summary.materialWithVendors, accent: 'slate' },
      { id: 'due', label: 'Due This Week', value: summary.dueThisWeek, accent: 'amber' },
      { id: 'overdue', label: 'Overdue', value: summary.overdue, accent: 'red' },
      { id: 'recon', label: 'Recon Diff', value: summary.reconciliationDifference, accent: 'amber' },
      { id: 'invoice', label: 'Invoice Pending', value: summary.vendorInvoicePending, accent: 'slate' },
    ],
    [summary],
  )

  const columns = useMemo<ColumnDef<JobWorkOrder>[]>(
    () => [
      {
        accessorKey: 'jwNumber',
        header: 'JW #',
        cell: ({ row }) => (
          <TableLink to={`/manufacturing/job-work/${row.original.id}`} className="font-mono font-semibold">
            {row.original.jwNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'workOrderNo',
        header: 'WO',
        cell: ({ row }) => (
          <TableLink to={`/manufacturing/work-orders/${row.original.workOrderId}`} className="font-mono">
            {row.original.workOrderNo}
          </TableLink>
        ),
      },
      { accessorKey: 'vendorName', header: 'Vendor' },
      { accessorKey: 'process', header: 'Operation' },
      {
        id: 'sentReceived',
        header: 'Sent / Received',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.sentQty} / {row.original.receivedQty}
            {row.original.pendingQty > 0 ? (
              <span className="ml-1 text-[11px] text-erp-muted">({row.original.pendingQty} bal)</span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: 'expectedReturnDate',
        header: 'Expected Return',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatDate(row.original.expectedReturnDate)}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <JobWorkStatusBadge status={row.original.status} />,
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
    ],
    [navigate, perms],
  )

  return (
    <ProductionPageHeader
      title="Job Work"
      description="Outside processing for a Work Order — send material, receive, reconcile."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Job Work' },
      ]}
      favoritePath="/manufacturing/job-work"
      primaryAction={
        perms.canCreateJobWork
          ? { id: 'new', label: 'Create Job Work', icon: Plus, onClick: () => navigate('/manufacturing/job-work/new') }
          : undefined
      }
      kpiStrip={loading && summary.open === 0 && rows.length === 0 ? undefined : kpiStrip}
      filterBar={
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'rounded px-2.5 py-1 text-[12px] font-medium transition-colors',
                  tab === t.id
                    ? 'bg-erp-primary text-white'
                    : 'bg-erp-surface-alt text-erp-muted hover:text-erp-text',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search JW #, WO, vendor, operation…"
            className="min-w-[200px] max-w-md"
            aria-label="Search job work"
          />
        </div>
      }
    >
      <div className="space-y-3">
        {loading ? <LoadingState variant="table" rows={8} /> : null}
        {!loading && rows.length === 0 ? (
          <ProductionEmptyState
            icon={Truck}
            title="No job work orders"
            description="Create a job work from a work order to send material for outside processing."
            action={
              perms.canCreateJobWork ? (
                <button
                  type="button"
                  className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                  onClick={() => navigate('/manufacturing/job-work/new')}
                >
                  Create Job Work
                </button>
              ) : undefined
            }
          />
        ) : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
            <DataTable columns={columns} data={rows} />
          </div>
        ) : null}
      </div>
    </ProductionPageHeader>
  )
}
