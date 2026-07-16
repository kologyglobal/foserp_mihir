import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Eye,
  Pause,
  Play,
  Plus,
  Printer,
  Ban,
  CheckCircle2,
  Pencil,
  Package,
  Wrench,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Select } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import {
  getWorkOrderRegisterSummary,
  getWorkOrders,
} from '@/services/manufacturing'
import type { WorkOrder, WorkOrderFilter, WorkOrderStatus } from '@/types/manufacturingWorkOrder'
import {
  WO_PRIORITY_LABELS,
  WO_SOURCE_LABELS,
  WO_STATUS_LABELS,
} from '@/types/manufacturingWorkOrder'
import { PRODUCTION_METHOD_LABELS } from '@/types/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { cn } from '@/utils/cn'

const TABS: { id: NonNullable<WorkOrderFilter['tab']>; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'completed', label: 'Completed' },
  { id: 'closed', label: 'Closed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'material_shortage', label: 'Material Shortage' },
  { id: 'delayed', label: 'Delayed' },
  { id: 'job_work', label: 'Job Work' },
]

function SummaryCard({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => href && navigate(href)}
      className="rounded-lg border border-erp-border bg-erp-surface px-3 py-2.5 text-left shadow-[var(--erp-shadow-card)] hover:bg-erp-surface-hover"
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-erp-text">{value}</div>
    </button>
  )
}

export function WorkOrderRegisterPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [tab, setTab] = useState<NonNullable<WorkOrderFilter['tab']>>('all')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<WorkOrderStatus | ''>('')
  const [rows, setRows] = useState<WorkOrder[]>([])
  const [summary, setSummary] = useState({
    open: 0,
    inProgress: 0,
    dueToday: 0,
    delayed: 0,
    materialShortage: 0,
    plannedQty: 0,
    producedQty: 0,
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, sum] = await Promise.all([
        getWorkOrders({ tab, search: search || undefined, status: status || undefined }),
        getWorkOrderRegisterSummary(),
      ])
      setRows(list)
      setSummary(sum)
    } catch {
      setRows([])
      notify.error('Failed to load work orders')
    } finally {
      setLoading(false)
    }
  }, [tab, search, status])

  useEffect(() => {
    void load()
  }, [load])

  const columns = useMemo<ColumnDef<WorkOrder>[]>(() => {
    return [
      {
        accessorKey: 'woNumber',
        header: 'Work Order',
        cell: ({ row }) => (
          <TableLink to={`/manufacturing/work-orders/${row.original.id}`} className="font-mono">
            {row.original.woNumber}
          </TableLink>
        ),
      },
      {
        id: 'item',
        header: 'Finished Item',
        cell: ({ row }) => (
          <div>
            <div className="text-[13px] font-medium text-erp-text">{row.original.finishedItemCode}</div>
            <div className="text-[11px] text-erp-muted">{row.original.finishedItemName}</div>
          </div>
        ),
      },
      {
        accessorKey: 'productionMethod',
        header: 'Production Method',
        cell: ({ row }) => PRODUCTION_METHOD_LABELS[row.original.productionMethod],
      },
      { accessorKey: 'plannedQty', header: 'Planned Qty' },
      { accessorKey: 'producedQty', header: 'Produced Qty' },
      { accessorKey: 'remainingQty', header: 'Remaining Qty' },
      {
        accessorKey: 'startDate',
        header: 'Start Date',
        cell: ({ row }) => formatDate(row.original.startDate),
      },
      {
        accessorKey: 'dueDate',
        header: 'Due Date',
        cell: ({ row }) => formatDate(row.original.dueDate),
      },
      {
        accessorKey: 'materialStatus',
        header: 'Material Status',
        cell: ({ row }) => (
          <StatusDot tone={statusToneFromLabel(row.original.materialStatus)} label={row.original.materialStatus} />
        ),
      },
      {
        accessorKey: 'progressPercent',
        header: 'Progress',
        cell: ({ row }) => (
          <div className="min-w-[80px]">
            <div className="h-1.5 rounded bg-erp-border">
              <div
                className="h-1.5 rounded bg-erp-primary"
                style={{ width: `${row.original.progressPercent}%` }}
              />
            </div>
            <div className="mt-0.5 text-[11px] text-erp-muted">{row.original.progressPercent}%</div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot tone={statusToneFromLabel(row.original.status)} label={WO_STATUS_LABELS[row.original.status]} />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const wo = row.original
          const readOnly = wo.status === 'closed' || wo.status === 'cancelled'
          const items: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/manufacturing/work-orders/${wo.id}`),
            },
            {
              id: 'edit',
              label: 'Edit Draft',
              icon: Pencil,
              disabled: wo.status !== 'draft' || !perms.canEditWo,
              disabledReason: wo.status !== 'draft' ? 'Only drafts can be edited' : undefined,
              onClick: () => navigate(`/manufacturing/work-orders/${wo.id}/edit`),
            },
            {
              id: 'start',
              label: 'Start',
              icon: Play,
              disabled: wo.status !== 'draft' || !perms.canStartWo || readOnly,
              disabledReason: wo.status !== 'draft' ? 'Start from Draft only' : undefined,
              onClick: () => navigate(`/manufacturing/work-orders/${wo.id}?action=start`),
            },
            {
              id: 'complete',
              label: 'Complete Production',
              icon: CheckCircle2,
              disabled: wo.status !== 'in_progress' || !perms.canCompleteProduction || readOnly,
              disabledReason: wo.status !== 'in_progress' ? 'Available when In Progress' : undefined,
              onClick: () => navigate(`/manufacturing/work-orders/${wo.id}?action=complete`),
            },
            {
              id: 'hold',
              label: 'Put on Hold',
              icon: Pause,
              disabled: wo.status !== 'in_progress' || !perms.canHoldWo || readOnly,
              onClick: () => navigate(`/manufacturing/work-orders/${wo.id}?action=hold`),
            },
            {
              id: 'resume',
              label: 'Resume',
              icon: Play,
              disabled: wo.status !== 'on_hold' || !perms.canResumeWo || readOnly,
              onClick: () => navigate(`/manufacturing/work-orders/${wo.id}?action=resume`),
            },
            {
              id: 'materials',
              label: 'View Materials',
              icon: Package,
              onClick: () => navigate(`/manufacturing/work-orders/${wo.id}?tab=materials`),
            },
            {
              id: 'print',
              label: 'Print Job Card',
              icon: Printer,
              disabled: true,
              disabledReason: 'Optional — Job Cards disabled by default',
              onClick: () => undefined,
            },
            {
              id: 'close',
              label: 'Close',
              icon: CheckCircle2,
              disabled: !['completed', 'in_progress'].includes(wo.status) || !perms.canCloseWo || readOnly,
              onClick: () => navigate(`/manufacturing/work-orders/${wo.id}?action=close`),
            },
            {
              id: 'cancel',
              label: 'Cancel',
              icon: Ban,
              disabled: readOnly || !perms.canCancelWo,
              onClick: () => navigate(`/manufacturing/work-orders/${wo.id}?action=cancel`),
            },
          ]
          return <EnterpriseRowActionsMenu actions={items} />
        },
      },
    ]
  }, [navigate, perms])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Work Orders"
      description="Central production workspace — select source, confirm quantity, complete inside the Work Order."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Work Orders' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/manufacturing/work-orders"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateWo
              ? { id: 'new', label: 'New Work Order', icon: Plus, onClick: () => navigate('/manufacturing/work-orders/new') }
              : undefined
          }
        />
      )}
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        <SummaryCard label="Open Work Orders" value={summary.open} href="/manufacturing/work-orders" />
        <SummaryCard label="In Progress" value={summary.inProgress} />
        <SummaryCard label="Due Today" value={summary.dueToday} />
        <SummaryCard label="Delayed" value={summary.delayed} />
        <SummaryCard label="Material Shortage" value={summary.materialShortage} />
        <SummaryCard label="Planned Quantity" value={summary.plannedQty} />
        <SummaryCard label="Produced Quantity" value={summary.producedQty} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-erp-border pb-2" role="tablist" aria-label="Work order status tabs">
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Work order, item, customer…"
          className="min-w-[200px] flex-1"
          aria-label="Search work orders"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as WorkOrderStatus | '')}
          className="w-40"
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          {(Object.keys(WO_STATUS_LABELS) as WorkOrderStatus[]).map((s) => (
            <option key={s} value={s}>{WO_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState icon={Wrench} title="No work orders" description="Create a work order from a sales order or manually." />
      ) : (
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={rows} />
        </div>
      )}

      <p className="mt-3 text-[11px] text-erp-muted">
        Source labels: {Object.values(WO_SOURCE_LABELS).join(' · ')} · Priority: {Object.values(WO_PRIORITY_LABELS).join(', ')}
      </p>
    </OperationalPageShell>
  )
}
