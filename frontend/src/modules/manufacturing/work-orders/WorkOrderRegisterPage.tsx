import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Download,
  Eye,
  LayoutGrid,
  Pause,
  Play,
  Plus,
  Ban,
  CheckCircle2,
  Pencil,
  Package,
  ClipboardList,
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
import { ManufacturingDemoBanner, ShopfloorStatusChip } from '@/components/manufacturing'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  getWorkOrderRegisterSummary,
  getWorkOrders,
} from '@/services/manufacturing'
import type {
  WorkOrder,
  WorkOrderFilter,
  WorkOrderListStatus,
  WorkOrderMaterialStatus,
  WorkOrderSource,
} from '@/types/manufacturingWorkOrder'
import {
  WO_LIST_STATUS_LABELS,
  WO_MATERIAL_STATUS_LABELS,
  WO_QC_STATUS_LABELS,
  WO_SOURCE_LABELS,
  getWorkOrderListStatus,
  getWorkOrderOwnerLine,
  getWorkOrderQcStatus,
} from '@/types/manufacturingWorkOrder'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { cn } from '@/utils/cn'
import { seedWorkOrders } from '@/data/manufacturing/workOrderSeed'

const STATUS_TABS: { id: NonNullable<WorkOrderFilter['tab']>; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'ready', label: 'Ready' },
  { id: 'in_progress', label: 'Running' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'qc_pending', label: 'QC Pending' },
  { id: 'qc_hold', label: 'QC Hold' },
  { id: 'completed', label: 'Completed' },
  { id: 'closed', label: 'Closed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const FINISHED_ITEMS = Array.from(
  new Map(seedWorkOrders.map((w) => [w.finishedItemCode, w.finishedItemName])).entries(),
)

const OWNER_OPTIONS = Array.from(
  new Set(
    seedWorkOrders
      .map((w) => getWorkOrderOwnerLine(w))
      .filter((v) => v && v !== '—'),
  ),
).sort()

function progressTone(status: WorkOrderListStatus): string {
  switch (status) {
    case 'ready':
      return 'bg-teal-500'
    case 'in_progress':
      return 'bg-sky-500'
    case 'on_hold':
    case 'qc_hold':
      return 'bg-amber-500'
    case 'qc_pending':
      return 'bg-violet-500'
    case 'completed':
    case 'closed':
      return 'bg-emerald-500'
    case 'cancelled':
      return 'bg-rose-400'
    default:
      return 'bg-slate-400'
  }
}

function ProgressCell({ wo }: { wo: WorkOrder }) {
  const listStatus = getWorkOrderListStatus(wo)
  return (
    <div className="min-w-[88px]">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all', progressTone(listStatus))}
          style={{ width: `${Math.min(100, Math.max(0, wo.progressPercent))}%` }}
        />
      </div>
      <div className="mt-0.5 text-[10px] tabular-nums text-erp-muted">{wo.progressPercent}%</div>
    </div>
  )
}

function exportCsv(rows: WorkOrder[]) {
  const headers = [
    'WO No',
    'Source',
    'Finished Item',
    'Planned Qty',
    'Good Qty',
    'Due Date',
    'Material Status',
    'QC Status',
    'Production Status',
    'Owner / Line',
  ]
  const lines = rows.map((wo) => [
    wo.woNumber,
    WO_SOURCE_LABELS[wo.source],
    `${wo.finishedItemCode} ${wo.finishedItemName}`,
    String(wo.plannedQty),
    String(wo.producedQty),
    wo.dueDate,
    wo.materialStatus in WO_MATERIAL_STATUS_LABELS
      ? WO_MATERIAL_STATUS_LABELS[wo.materialStatus as WorkOrderMaterialStatus]
      : wo.materialStatus,
    WO_QC_STATUS_LABELS[getWorkOrderQcStatus(wo)],
    WO_LIST_STATUS_LABELS[getWorkOrderListStatus(wo)],
    getWorkOrderOwnerLine(wo),
  ])
  const csv = [headers, ...lines]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `work-orders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  notify.success(`Exported ${rows.length} work order(s)`)
}

export function WorkOrderRegisterPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [tab, setTab] = useState<NonNullable<WorkOrderFilter['tab']>>('all')
  const [search, setSearch] = useState('')
  const [listStatus, setListStatus] = useState<WorkOrderListStatus | ''>('')
  const [source, setSource] = useState<WorkOrderSource | ''>('')
  const [finishedItem, setFinishedItem] = useState('')
  const [dueDateFrom, setDueDateFrom] = useState('')
  const [dueDateTo, setDueDateTo] = useState('')
  const [materialStatus, setMaterialStatus] = useState<WorkOrderMaterialStatus | ''>('')
  const [qcRequired, setQcRequired] = useState<'' | 'yes' | 'no'>('')
  const [ownerLine, setOwnerLine] = useState('')
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
        getWorkOrders({
          tab,
          search: search || undefined,
          listStatus: listStatus || undefined,
          source: source || undefined,
          finishedItem: finishedItem || undefined,
          dueDateFrom: dueDateFrom || undefined,
          dueDateTo: dueDateTo || undefined,
          materialStatus: materialStatus || undefined,
          qcRequired: qcRequired === '' ? '' : qcRequired === 'yes',
          ownerLine: ownerLine || undefined,
        }),
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
  }, [tab, search, listStatus, source, finishedItem, dueDateFrom, dueDateTo, materialStatus, qcRequired, ownerLine])

  useEffect(() => {
    void load()
  }, [load])

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(
    () => [
      { id: 'open', label: 'Open', value: summary.open, accent: 'blue' },
      { id: 'running', label: 'Running', value: summary.inProgress, accent: 'green' },
      { id: 'due-today', label: 'Due Today', value: summary.dueToday, accent: 'amber' },
      { id: 'delayed', label: 'Delayed', value: summary.delayed, accent: 'red' },
      { id: 'shortage', label: 'Material Shortage', value: summary.materialShortage, accent: 'red' },
      { id: 'planned', label: 'Planned Qty', value: summary.plannedQty, accent: 'slate' },
      { id: 'good', label: 'Good Qty', value: summary.producedQty, accent: 'slate' },
    ],
    [summary],
  )

  const columns = useMemo<ColumnDef<WorkOrder>[]>(() => [
    {
      accessorKey: 'woNumber',
      header: 'WO No',
      cell: ({ row }) => (
        <div>
          <TableLink to={`/manufacturing/work-orders/${row.original.id}`} className="font-mono font-semibold">
            {row.original.woNumber}
          </TableLink>
          <div className="mt-1">
            <ProgressCell wo={row.original} />
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => (
        <div>
          <div className="text-[12px] font-medium text-erp-text">{WO_SOURCE_LABELS[row.original.source]}</div>
          <div className="font-mono text-[11px] text-erp-muted">{row.original.sourceDocumentNo}</div>
        </div>
      ),
    },
    {
      id: 'item',
      header: 'Finished Item',
      cell: ({ row }) => (
        <div>
          <div className="font-mono text-[12px] font-medium text-erp-text">{row.original.finishedItemCode}</div>
          <div className="line-clamp-1 text-[11px] text-erp-muted">{row.original.finishedItemName}</div>
        </div>
      ),
    },
    {
      accessorKey: 'plannedQty',
      header: 'Planned Qty',
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.plannedQty} {row.original.uom}</span>
      ),
    },
    {
      accessorKey: 'producedQty',
      header: 'Good Qty',
      cell: ({ row }) => (
        <span className="tabular-nums font-semibold text-erp-text">
          {row.original.producedQty} {row.original.uom}
        </span>
      ),
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }) => {
        const overdue =
          row.original.dueDate < new Date().toISOString().slice(0, 10)
          && !['completed', 'closed', 'cancelled'].includes(row.original.status)
        return (
          <span className={cn('tabular-nums', overdue && 'font-semibold text-rose-700')}>
            {formatDate(row.original.dueDate)}
          </span>
        )
      },
    },
    {
      accessorKey: 'materialStatus',
      header: 'Material Status',
      cell: ({ row }) => {
        const status = row.original.materialStatus
        const label =
          status in WO_MATERIAL_STATUS_LABELS
            ? WO_MATERIAL_STATUS_LABELS[status as WorkOrderMaterialStatus]
            : status === 'not_checked'
              ? 'Not checked'
              : status
        return <StatusDot tone={statusToneFromLabel(status)} label={label} />
      },
    },
    {
      id: 'qc',
      header: 'QC Status',
      cell: ({ row }) => {
        const qc = getWorkOrderQcStatus(row.original)
        return (
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
              qc === 'pending' || qc === 'hold'
                ? 'bg-violet-100 text-violet-800 ring-violet-200'
                : qc === 'required'
                  ? 'bg-sky-50 text-sky-800 ring-sky-200'
                  : qc === 'cleared'
                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                    : 'bg-slate-50 text-slate-600 ring-slate-200',
            )}
          >
            {WO_QC_STATUS_LABELS[qc]}
          </span>
        )
      },
    },
    {
      id: 'productionStatus',
      header: 'Production Status',
      cell: ({ row }) => <ShopfloorStatusChip status={getWorkOrderListStatus(row.original)} />,
    },
    {
      id: 'owner',
      header: 'Owner / Line',
      cell: ({ row }) => (
        <span className="text-[12px] text-erp-text">{getWorkOrderOwnerLine(row.original)}</span>
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
            onClick: () => navigate(`/manufacturing/work-orders/${wo.id}?action=start`),
          },
          {
            id: 'complete',
            label: 'Complete Production',
            icon: CheckCircle2,
            disabled: wo.status !== 'in_progress' || !perms.canCompleteProduction || readOnly,
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
  ], [navigate, perms])

  if (!perms.canViewWo) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Manufacturing"
        title="Work Orders"
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'Work Orders' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={Wrench} title="Access denied" description="Missing work order view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Work Orders"
      description="Release, run, and complete production work orders (demo data)."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Work Orders' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/manufacturing/work-orders"
      showDescription
      kpiStrip={kpiStrip}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateWo
              ? {
                  id: 'new',
                  label: 'New Work Order',
                  icon: Plus,
                  onClick: () => navigate('/manufacturing/work-orders/new'),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'import-plan',
              label: 'Import from Production Plan',
              icon: ClipboardList,
              onClick: () => navigate('/manufacturing/production-plan'),
            },
            {
              id: 'shopfloor',
              label: 'View Shopfloor',
              icon: LayoutGrid,
              onClick: () => navigate('/manufacturing/shopfloor'),
            },
            {
              id: 'export',
              label: 'Export',
              icon: Download,
              onClick: () => exportCsv(rows),
              disabled: rows.length === 0,
            },
          ]}
        />
      )}
    >
      <div className="space-y-3">
        <ManufacturingDemoBanner message="Work Orders are the center of this command center. Shopfloor and Job Work hang off this register." />

        <div className="flex flex-wrap gap-1 rounded-lg border border-erp-border bg-white p-1" role="tablist" aria-label="Work order status">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id)
                setListStatus('')
              }}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition',
                tab === t.id ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-erp-border bg-white p-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="WO / item / customer / line…"
            className="min-w-[180px] flex-1"
            aria-label="Search work orders"
          />
          <label className="text-[11px] font-medium text-erp-muted">
            Status
            <Select
              value={listStatus}
              onChange={(e) => {
                setListStatus(e.target.value as WorkOrderListStatus | '')
                setTab('all')
              }}
              className="mt-0.5 block w-40"
            >
              <option value="">All statuses</option>
              {(Object.keys(WO_LIST_STATUS_LABELS) as WorkOrderListStatus[]).map((s) => (
                <option key={s} value={s}>{WO_LIST_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            Source
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value as WorkOrderSource | '')}
              className="mt-0.5 block w-44"
            >
              <option value="">All sources</option>
              {(Object.keys(WO_SOURCE_LABELS) as WorkOrderSource[]).map((s) => (
                <option key={s} value={s}>{WO_SOURCE_LABELS[s]}</option>
              ))}
            </Select>
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            Finished Item
            <Select
              value={finishedItem}
              onChange={(e) => setFinishedItem(e.target.value)}
              className="mt-0.5 block w-48"
            >
              <option value="">All items</option>
              {FINISHED_ITEMS.map(([code, name]) => (
                <option key={code} value={code}>{code} — {name}</option>
              ))}
            </Select>
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            Due from
            <input
              type="date"
              className="mt-0.5 block h-9 rounded-lg border border-erp-border px-2 text-[13px]"
              value={dueDateFrom}
              onChange={(e) => setDueDateFrom(e.target.value)}
            />
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            Due to
            <input
              type="date"
              className="mt-0.5 block h-9 rounded-lg border border-erp-border px-2 text-[13px]"
              value={dueDateTo}
              onChange={(e) => setDueDateTo(e.target.value)}
            />
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            Material Status
            <Select
              value={materialStatus}
              onChange={(e) => setMaterialStatus(e.target.value as WorkOrderMaterialStatus | '')}
              className="mt-0.5 block w-36"
            >
              <option value="">All</option>
              {(Object.keys(WO_MATERIAL_STATUS_LABELS) as WorkOrderMaterialStatus[]).map((s) => (
                <option key={s} value={s}>{WO_MATERIAL_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            QC Required
            <Select
              value={qcRequired}
              onChange={(e) => setQcRequired(e.target.value as '' | 'yes' | 'no')}
              className="mt-0.5 block w-28"
            >
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            Owner / Line
            <Select
              value={ownerLine}
              onChange={(e) => setOwnerLine(e.target.value)}
              className="mt-0.5 block w-48"
            >
              <option value="">All</option>
              {OWNER_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          </label>
        </div>

        {loading ? <LoadingState variant="table" rows={8} /> : null}
        {!loading && rows.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No work orders"
            description="Create a work order or import demand from a production plan."
            action={
              perms.canCreateWo ? (
                <button
                  type="button"
                  className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                  onClick={() => navigate('/manufacturing/work-orders/new')}
                >
                  Create Work Order
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
    </OperationalPageShell>
  )
}
