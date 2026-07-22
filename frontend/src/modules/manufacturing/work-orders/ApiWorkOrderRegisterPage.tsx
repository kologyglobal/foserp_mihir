import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Ban, CheckCircle2, Eye, FileInput, Pause, Play, Plus, Wrench } from 'lucide-react'
import { TableLink } from '@/components/ui/AppLink'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListFilterBar } from '@/components/crm/CrmListFilterBar'
import { SaveViewDialog } from '@/components/design-system/SaveViewDialog'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import { useSavedViews } from '@/hooks/useSavedViews'
import { WORK_ORDER_REGISTER_PRESETS } from '@/config/savedViewPresets'
import {
  DEFAULT_WORK_ORDER_LIST_FILTERS,
  WORK_ORDER_VIEW_OPTIONS,
  buildWorkOrderFilterFields,
  crmValuesToWorkOrderFilters,
  listParamsFromWorkOrderFilters,
  serializeWorkOrderFilters,
  workOrderFilterChipLabelResolver,
  workOrderFiltersToCrmValues,
  type WorkOrderListFilters,
  type WorkOrderRegisterView,
} from '@/config/workOrderFilterConfig'
import {
  cancelWorkOrder,
  getWorkOrdersSummary,
  holdWorkOrder,
  listWorkOrders,
  releaseWorkOrder,
  resumeWorkOrder,
  startWorkOrder,
} from '@/services/api/manufacturingApi'
import type { ProductionOrder, WorkOrderStatus, WorkOrdersSummary } from '@/types/manufacturingProduction'
import { useSetupLookup } from '../setup/useSetupLookups'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingWorkOrderPermissions } from '@/utils/permissions/manufacturing'
import {
  ProductionEmptyState,
  ProductionPageHeader,
  WorkOrderHealthBadge,
  WorkOrderStatusBadge,
  WO_STATUS_UI_LABELS,
} from '../ui'

const EMPTY_SUMMARY: WorkOrdersSummary = { total: 0, byStatus: [], byHealth: [] }

function sourceCustomerLabel(wo: ProductionOrder): string {
  const source =
    wo.sourceType === 'SALES_ORDER'
      ? 'Sales Order'
      : wo.sourceType.replace(/_/g, ' ')
  if (wo.customerId) return `${source} · ${wo.customerId.slice(0, 8)}…`
  return source
}

function completionPct(wo: ProductionOrder): string {
  const n = Number(wo.completionPercent)
  if (!Number.isFinite(n)) return '—'
  return `${Math.min(100, Math.max(0, Math.round(n)))}%`
}

export function ApiWorkOrderRegisterPage() {
  const navigate = useNavigate()
  const perms = useManufacturingWorkOrderPermissions()
  const { options: items } = useSetupLookup('items')

  const [filters, setFilters] = useState<WorkOrderListFilters>({ ...DEFAULT_WORK_ORDER_LIST_FILTERS })
  const [rows, setRows] = useState<ProductionOrder[]>([])
  const [summary, setSummary] = useState<WorkOrdersSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const itemLabel = useCallback(
    (id: string) => items.find((i) => i.id === id)?.label ?? `${id.slice(0, 8)}…`,
    [items],
  )

  const applyWoFilters = useCallback((saved: Record<string, string>) => {
    setFilters({
      ...DEFAULT_WORK_ORDER_LIST_FILTERS,
      search: saved.search ?? '',
      view: (WORK_ORDER_VIEW_OPTIONS.some((o) => o.value === saved.view)
        ? saved.view
        : '') as WorkOrderRegisterView,
      productItemId: saved.productItemId ?? '',
    })
  }, [])

  const savedViews = useSavedViews({
    pageId: '/manufacturing/work-orders',
    filters: serializeWorkOrderFilters(filters),
    onApply: applyWoFilters,
    systemPresets: WORK_ORDER_REGISTER_PRESETS,
  })

  const productOptions = useMemo(
    () => items.map((i) => ({ id: i.id, label: i.label })),
    [items],
  )

  const filterFields = useMemo(
    () => buildWorkOrderFilterFields({ productOptions }),
    [productOptions],
  )

  const chipLabelResolver = useCallback(
    (key: string, value: string) => workOrderFilterChipLabelResolver(key, value, itemLabel),
    [itemLabel],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: workOrderFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToWorkOrderFilters(next)),
    fields: filterFields,
    defaults: workOrderFiltersToCrmValues(DEFAULT_WORK_ORDER_LIST_FILTERS),
    chipLabelResolver,
  })

  const listParams = useMemo(() => listParamsFromWorkOrderFilters(filters), [filters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, sum] = await Promise.all([
        listWorkOrders({
          ...listParams,
          limit: 100,
        }),
        getWorkOrdersSummary(),
      ])
      setRows(list.data)
      setSummary(sum.data)
    } catch (e) {
      setRows([])
      notify.error(e instanceof Error ? e.message : 'Failed to load work orders')
    } finally {
      setLoading(false)
    }
  }, [listParams])

  useEffect(() => {
    void load()
  }, [load])

  const setView = useCallback((view: WorkOrderRegisterView) => {
    setFilters((prev) => ({ ...prev, view }))
  }, [])

  const runAction = useCallback(
    async (id: string, fn: () => Promise<unknown>, okMsg: string) => {
      setBusyId(id)
      try {
        await fn()
        notify.success(okMsg)
        await load()
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusyId(null)
      }
    },
    [load],
  )

  const view = filters.view

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(() => {
    const countFor = (statusValue: WorkOrderStatus) =>
      summary.byStatus.find((s) => s.status === statusValue)?.count ?? 0
    const healthFor = (h: 'DELAYED') => summary.byHealth.find((s) => s.healthStatus === h)?.count ?? 0
    return [
      { id: 'total', label: 'All', value: summary.total, accent: 'slate', active: view === '', onClick: () => setView('') },
      { id: 'draft', label: 'Draft', value: countFor('DRAFT'), accent: 'slate', active: view === 'DRAFT', onClick: () => setView('DRAFT') },
      { id: 'ready', label: 'Ready', value: countFor('READY'), accent: 'green', active: view === 'READY', onClick: () => setView('READY') },
      {
        id: 'running',
        label: 'Running',
        value: countFor('IN_PROGRESS'),
        accent: 'blue',
        active: view === 'IN_PROGRESS',
        onClick: () => setView('IN_PROGRESS'),
      },
      { id: 'hold', label: 'On Hold', value: countFor('ON_HOLD'), accent: 'amber', active: view === 'ON_HOLD', onClick: () => setView('ON_HOLD') },
      {
        id: 'delayed',
        label: 'Delayed',
        value: healthFor('DELAYED'),
        accent: 'red',
        active: view === 'DELAYED',
        onClick: () => setView('DELAYED'),
      },
    ]
  }, [summary, view, setView])

  const columns = useMemo<ColumnDef<ProductionOrder>[]>(
    () => [
      {
        accessorKey: 'workOrderNo',
        header: 'WO',
        cell: ({ row }) => (
          <TableLink to={`/manufacturing/work-orders/${row.original.id}`} className="font-mono font-semibold">
            {row.original.workOrderNo}
          </TableLink>
        ),
      },
      {
        id: 'product',
        header: 'Product',
        cell: ({ row }) => <span className="text-[12px] text-erp-text">{itemLabel(row.original.productItemId)}</span>,
      },
      {
        id: 'source',
        header: 'Source / Customer',
        cell: ({ row }) => <span className="text-[12px] text-erp-muted">{sourceCustomerLabel(row.original)}</span>,
      },
      {
        accessorKey: 'plannedQuantity',
        header: 'Qty',
        cell: ({ row }) => <span className="tabular-nums">{row.original.plannedQuantity}</span>,
      },
      {
        id: 'currentStage',
        header: 'Current Stage',
        cell: ({ row }) => (
          <span className="text-[12px] text-erp-muted">{row.original.currentStageId ? 'In progress' : '—'}</span>
        ),
      },
      {
        id: 'completion',
        header: 'Completion',
        cell: ({ row }) => <span className="tabular-nums font-medium text-erp-text">{completionPct(row.original)}</span>,
      },
      {
        accessorKey: 'requiredCompletionDate',
        header: 'Due',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.requiredCompletionDate ? formatDate(row.original.requiredCompletionDate) : '—'}
          </span>
        ),
      },
      {
        id: 'supervisor',
        header: 'Supervisor',
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-erp-muted">
            {row.original.supervisorId ? `${row.original.supervisorId.slice(0, 8)}…` : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <WorkOrderStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'healthStatus',
        header: 'Health',
        cell: ({ row }) => <WorkOrderHealthBadge health={row.original.healthStatus} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const wo = row.original
          const busy = busyId === wo.id
          const items: RowActionItem[] = [
            { id: 'view', label: 'View', icon: Eye, onClick: () => navigate(`/manufacturing/work-orders/${wo.id}`) },
            {
              id: 'release',
              label: 'Release',
              icon: Play,
              disabled: wo.status !== 'DRAFT' || !perms.canRelease || busy,
              onClick: () => void runAction(wo.id, () => releaseWorkOrder(wo.id), 'Work order released'),
            },
            {
              id: 'start',
              label: 'Start',
              icon: Play,
              disabled: wo.status !== 'READY' || !perms.canStart || busy,
              onClick: () => void runAction(wo.id, () => startWorkOrder(wo.id), 'Work order started'),
            },
            {
              id: 'hold',
              label: 'Hold',
              icon: Pause,
              disabled: wo.status !== 'IN_PROGRESS' || !perms.canHold || busy,
              onClick: () =>
                void runAction(wo.id, () => holdWorkOrder(wo.id, { reasonCategory: 'OTHER' }), 'Work order put on hold'),
            },
            {
              id: 'resume',
              label: 'Resume',
              icon: Play,
              disabled: wo.status !== 'ON_HOLD' || !perms.canResume || busy,
              onClick: () => void runAction(wo.id, () => resumeWorkOrder(wo.id), 'Work order resumed'),
            },
            {
              id: 'complete',
              label: 'Open to complete…',
              icon: CheckCircle2,
              disabled: wo.status !== 'IN_PROGRESS',
              onClick: () => navigate(`/manufacturing/work-orders/${wo.id}?action=complete`),
            },
            {
              id: 'cancel',
              label: 'Cancel',
              icon: Ban,
              disabled: ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(wo.status) || !perms.canCancel || busy,
              onClick: () => void runAction(wo.id, () => cancelWorkOrder(wo.id), 'Work order cancelled'),
            },
          ]
          return <EnterpriseRowActionsMenu actions={items} />
        },
      },
    ],
    [busyId, itemLabel, navigate, perms.canCancel, perms.canHold, perms.canRelease, perms.canResume, perms.canStart, runAction],
  )

  if (!perms.canViewWo) {
    return (
      <ProductionPageHeader title="Work Orders" favoritePath="/manufacturing/work-orders">
        <ProductionEmptyState icon={Wrench} title="Access denied" description="Missing work order view permission." />
      </ProductionPageHeader>
    )
  }

  const viewLabel =
    WORK_ORDER_VIEW_OPTIONS.find((t) => t.value === view)?.label ??
    (view ? WO_STATUS_UI_LABELS[view as WorkOrderStatus] : 'All')

  return (
    <>
      <ProductionPageHeader
        title="Work Orders"
        description="Release, run, and complete production work orders."
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'Work Orders' },
        ]}
        favoritePath="/manufacturing/work-orders"
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
        secondaryActions={
          perms.canCreateWo
            ? [
                {
                  id: 'from-so',
                  label: 'Create from Sales Order',
                  icon: FileInput,
                  onClick: () => navigate('/manufacturing/work-orders/new?mode=sales_order'),
                },
              ]
            : undefined
        }
        kpiStrip={loading && summary.total === 0 ? undefined : kpiStrip}
        filterBar={
          <CrmListFilterBar
            search={filters.search}
            onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
            searchPlaceholder="Search WO # / job number…"
            activeFilterCount={filterDrawer.activeCount}
            onOpenFilters={filterDrawer.openDrawer}
            chips={filterDrawer.chips}
            onRemoveChip={filterDrawer.removeChip}
            onClearAll={filterDrawer.clearAll}
            savedView={savedViews.activeView}
            onSavedViewChange={savedViews.selectView}
            savedViews={savedViews.viewNames}
            onSaveView={savedViews.openSaveDialog}
            showCommandPaletteHint={false}
          />
        }
      >
        <div className="space-y-3">
          {loading ? <LoadingState variant="table" rows={8} /> : null}
          {!loading && rows.length === 0 ? (
            <ProductionEmptyState
              icon={Wrench}
              title="No work orders"
              description={
                !view && !filters.search && !filters.productItemId
                  ? 'Create a work order or convert a confirmed sales order line.'
                  : `No work orders match “${viewLabel}”.`
              }
              action={
                perms.canCreateWo ? (
                  <button
                    type="button"
                    className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                    onClick={() => navigate('/manufacturing/work-orders/new')}
                  >
                    New Work Order
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
          {!loading && view && rows.length > 0 ? (
            <p className="text-[11px] text-erp-muted">
              Showing {viewLabel} view
              {filters.search ? ` · filtered by “${filters.search}”` : ''}
              {filters.productItemId ? ` · product ${itemLabel(filters.productItemId)}` : ''}
            </p>
          ) : null}
        </div>
      </ProductionPageHeader>

      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        title="Filter Work Orders"
        fields={filterFields}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
      />
      <SaveViewDialog
        open={savedViews.saveDialogOpen}
        defaultName={savedViews.activeView === 'My View' ? '' : savedViews.activeView}
        onClose={savedViews.closeSaveDialog}
        onSave={savedViews.saveCurrentView}
      />
    </>
  )
}
