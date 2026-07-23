import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  listEligibleSalesOrders,
  listWorkOrders,
  releaseWorkOrder,
  resumeWorkOrder,
  startWorkOrder,
} from '@/services/api/manufacturingApi'
import type {
  EligibleSalesOrder,
  ProductionOrder,
  WorkOrderStatus,
  WorkOrdersSummary,
} from '@/types/manufacturingProduction'
import { useSetupLookup } from '../setup/useSetupLookups'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingWorkOrderPermissions } from '@/utils/permissions/manufacturing'
import { cn } from '@/utils/cn'
import {
  ProductionEmptyState,
  ProductionPageHeader,
  WorkOrderHealthBadge,
  WorkOrderStatusBadge,
  WO_STATUS_UI_LABELS,
} from '../ui'

const EMPTY_SUMMARY: WorkOrdersSummary = { total: 0, byStatus: [], byHealth: [] }

type RegisterTab = 'work_orders' | 'sales_orders'

function sourceLabel(wo: ProductionOrder): string {
  if (wo.sourceType === 'SALES_ORDER') return 'Sales Order'
  if (wo.sourceType === 'MANUAL') return 'Manual'
  return wo.sourceType.replace(/_/g, ' ')
}

function productTitle(wo: ProductionOrder, fallbackLabel: string): { name: string; code: string } {
  const name = wo.productItemName?.trim() || fallbackLabel
  const code = wo.productItemCode?.trim() || ''
  return { name, code }
}

function completionPct(wo: ProductionOrder): number {
  const n = Number(wo.completionPercent)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

function soStatusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

function CompletionCell({ wo }: { wo: ProductionOrder }) {
  const pct = completionPct(wo)
  return (
    <div className="min-w-[96px]">
      <div className="mb-0.5 text-[11px] font-semibold tabular-nums text-erp-text">{pct}%</div>
      <div className="h-1.5 overflow-hidden rounded-full bg-erp-surface-alt">
        <div
          className={cn(
            'h-full rounded-full',
            pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-sky-500' : 'bg-slate-300',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function ApiWorkOrderRegisterPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useManufacturingWorkOrderPermissions()
  const { options: items } = useSetupLookup('items')

  const initialTab: RegisterTab =
    searchParams.get('tab') === 'sales_orders' ? 'sales_orders' : 'work_orders'
  const [registerTab, setRegisterTab] = useState<RegisterTab>(initialTab)

  const [filters, setFilters] = useState<WorkOrderListFilters>({ ...DEFAULT_WORK_ORDER_LIST_FILTERS })
  const [rows, setRows] = useState<ProductionOrder[]>([])
  const [summary, setSummary] = useState<WorkOrdersSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [eligibleSalesOrders, setEligibleSalesOrders] = useState<EligibleSalesOrder[]>([])
  const [soLoading, setSoLoading] = useState(false)
  const [soSearch, setSoSearch] = useState('')

  const itemLabel = useCallback(
    (id: string) => items.find((i) => i.id === id)?.label ?? 'Item',
    [items],
  )

  const setTab = useCallback(
    (tab: RegisterTab) => {
      setRegisterTab(tab)
      const next = new URLSearchParams(searchParams)
      if (tab === 'sales_orders') next.set('tab', 'sales_orders')
      else next.delete('tab')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
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

  const loadEligibleSalesOrders = useCallback(async () => {
    if (!perms.canCreateWo) {
      setEligibleSalesOrders([])
      return
    }
    setSoLoading(true)
    try {
      const res = await listEligibleSalesOrders()
      setEligibleSalesOrders(res.data)
    } catch (e) {
      setEligibleSalesOrders([])
      notify.error(e instanceof Error ? e.message : 'Failed to load sales orders needing work orders')
    } finally {
      setSoLoading(false)
    }
  }, [perms.canCreateWo])

  useEffect(() => {
    if (registerTab === 'sales_orders') void loadEligibleSalesOrders()
  }, [registerTab, loadEligibleSalesOrders])

  // Keep SO-to-convert KPI fresh even on the Work Orders tab.
  useEffect(() => {
    if (registerTab === 'work_orders' && perms.canCreateWo) void loadEligibleSalesOrders()
  }, [registerTab, perms.canCreateWo, loadEligibleSalesOrders])

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
    if (registerTab === 'sales_orders') {
      return [
        {
          id: 'so-open',
          label: 'SO needing WO',
          value: eligibleSalesOrders.length,
          accent: 'amber',
          active: true,
        },
      ]
    }
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
      {
        id: 'so-convert',
        label: 'SO to convert',
        value: eligibleSalesOrders.length,
        accent: 'amber',
        active: false,
        onClick: () => setTab('sales_orders'),
      },
    ]
  }, [summary, view, setView, registerTab, eligibleSalesOrders.length, setTab])

  const filteredSalesOrders = useMemo(() => {
    const q = soSearch.trim().toLowerCase()
    if (!q) return eligibleSalesOrders
    return eligibleSalesOrders.filter((so) => {
      const blob = `${so.salesOrderNo} ${so.customerName ?? ''} ${so.customerCode ?? ''} ${so.status}`.toLowerCase()
      return blob.includes(q)
    })
  }, [eligibleSalesOrders, soSearch])

  const soColumns = useMemo<ColumnDef<EligibleSalesOrder>[]>(
    () => [
      {
        accessorKey: 'salesOrderNo',
        header: 'Sales Order',
        cell: ({ row }) => (
          <div className="min-w-[120px]">
            <TableLink to={`/sales/orders/${row.original.id}`} className="font-mono text-[13px] font-semibold">
              {row.original.salesOrderNo}
            </TableLink>
            <p className="mt-0.5 text-[11px] capitalize text-erp-muted">{soStatusLabel(row.original.status)}</p>
          </div>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[240px]">
            <p className="truncate text-[13px] font-medium text-erp-text">
              {row.original.customerName?.trim() || '—'}
            </p>
            {row.original.customerCode ? (
              <p className="truncate font-mono text-[11px] text-erp-muted">{row.original.customerCode}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'orderDate',
        header: 'Order Date',
        cell: ({ row }) => (
          <span className="tabular-nums text-[12px]">
            {row.original.orderDate ? formatDate(row.original.orderDate) : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'requiredDate',
        header: 'Required',
        cell: ({ row }) => (
          <span className="tabular-nums text-[12px]">
            {row.original.requiredDate ? formatDate(row.original.requiredDate) : '—'}
          </span>
        ),
      },
      {
        id: 'lines',
        header: 'Lines',
        cell: ({ row }) => {
          const remaining = row.original.remainingLineCount ?? row.original.lineCount
          return (
            <div className="tabular-nums text-[12px]">
              <p className="font-semibold text-erp-text">
                {remaining} open
              </p>
              <p className="text-[10px] text-erp-muted">{row.original.lineCount} total</p>
            </div>
          )
        },
      },
      {
        id: 'remainingQty',
        header: 'Remaining Qty',
        cell: ({ row }) => (
          <span className="tabular-nums text-[12px] font-semibold text-erp-text">
            {row.original.remainingQuantity ?? '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const so = row.original
          const actions: RowActionItem[] = [
            {
              id: 'view-so',
              label: 'View Sales Order',
              icon: Eye,
              onClick: () => navigate(`/sales/orders/${so.id}`),
            },
            ...(perms.canCreateWo
              ? [
                  {
                    id: 'create-wo',
                    label: 'Create Work Order',
                    icon: FileInput,
                    onClick: () =>
                      navigate(
                        `/manufacturing/work-orders/new?mode=sales_order&salesOrderId=${encodeURIComponent(so.id)}`,
                      ),
                  } satisfies RowActionItem,
                ]
              : []),
          ]
          return (
            <div className="flex items-center gap-2">
              {perms.canCreateWo ? (
                <button
                  type="button"
                  className="erp-btn erp-btn-primary h-8 px-2.5 text-[12px]"
                  onClick={() =>
                    navigate(
                      `/manufacturing/work-orders/new?mode=sales_order&salesOrderId=${encodeURIComponent(so.id)}`,
                    )
                  }
                >
                  Create WO
                </button>
              ) : null}
              <EnterpriseRowActionsMenu actions={actions} />
            </div>
          )
        },
      },
    ],
    [navigate, perms.canCreateWo],
  )

  const columns = useMemo<ColumnDef<ProductionOrder>[]>(
    () => [
      {
        accessorKey: 'workOrderNo',
        header: 'WO',
        cell: ({ row }) => (
          <div className="min-w-[108px]">
            <TableLink to={`/manufacturing/work-orders/${row.original.id}`} className="font-mono text-[13px] font-semibold">
              {row.original.workOrderNo}
            </TableLink>
            {row.original.jobNumber ? (
              <p className="mt-0.5 text-[11px] text-erp-muted">Job {row.original.jobNumber}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'product',
        header: 'Item',
        cell: ({ row }) => {
          const product = productTitle(row.original, itemLabel(row.original.productItemId))
          return (
            <div className="min-w-0 max-w-[240px]">
              <p className="truncate text-[13px] font-medium text-erp-text">{product.name}</p>
              {product.code ? (
                <p className="truncate font-mono text-[11px] text-erp-muted">{product.code}</p>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'source',
        header: 'Source / Customer',
        cell: ({ row }) => {
          const wo = row.original
          const soNo = wo.salesOrderNo?.trim()
          const customer = wo.customerName?.trim() || wo.customerCode?.trim()
          return (
            <div className="min-w-0 max-w-[220px]">
              <p className="truncate text-[12px] font-medium text-erp-text">
                {sourceLabel(wo)}
                {soNo ? ` · ${soNo}` : ''}
              </p>
              <p className="truncate text-[11px] text-erp-muted">{customer || '—'}</p>
            </div>
          )
        },
      },
      {
        accessorKey: 'plannedQuantity',
        header: 'Qty',
        cell: ({ row }) => {
          const planned = row.original.plannedQuantity
          const done = row.original.completedGoodQuantity
          return (
            <div className="tabular-nums">
              <p className="text-[12px] font-semibold text-erp-text">{planned}</p>
              <p className="text-[10px] text-erp-muted">Done {done || '0'}</p>
            </div>
          )
        },
      },
      {
        id: 'currentStage',
        header: 'Current Stage',
        cell: ({ row }) => {
          const name = row.original.currentStageName?.trim()
          const code = row.original.currentStageCode?.trim()
          if (!name && !code) {
            return <span className="text-[12px] text-erp-muted">—</span>
          }
          return (
            <div className="min-w-0 max-w-[160px]">
              <p className="truncate text-[12px] font-medium text-erp-text">{name || code}</p>
              {name && code ? <p className="truncate font-mono text-[10px] text-erp-muted">{code}</p> : null}
            </div>
          )
        },
      },
      {
        id: 'completion',
        header: 'Completion',
        cell: ({ row }) => <CompletionCell wo={row.original} />,
      },
      {
        accessorKey: 'requiredCompletionDate',
        header: 'Due',
        cell: ({ row }) => (
          <span className="tabular-nums text-[12px] text-erp-text">
            {row.original.requiredCompletionDate ? formatDate(row.original.requiredCompletionDate) : '—'}
          </span>
        ),
      },
      {
        id: 'supervisor',
        header: 'Supervisor',
        cell: ({ row }) => (
          <span className="text-[12px] text-erp-text">{row.original.supervisorName?.trim() || '—'}</span>
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
          const actions: RowActionItem[] = [
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
          return <EnterpriseRowActionsMenu actions={actions} />
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
        description="Release, run, and complete production work orders — or convert open sales orders."
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
        kpiStrip={
          registerTab === 'sales_orders'
            ? soLoading && eligibleSalesOrders.length === 0
              ? undefined
              : kpiStrip
            : loading && summary.total === 0
              ? undefined
              : kpiStrip
        }
        filterBar={
          registerTab === 'work_orders' ? (
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
          ) : (
            <CrmListFilterBar
              search={soSearch}
              onSearchChange={setSoSearch}
              searchPlaceholder="Search SO # / customer…"
              activeFilterCount={0}
              chips={[]}
              onRemoveChip={() => undefined}
              onClearAll={() => setSoSearch('')}
              showCommandPaletteHint={false}
            />
          )
        }
      >
        <div className="space-y-3">
          <div
            className="flex flex-wrap items-center gap-1 rounded-lg border border-erp-border bg-white p-1"
            role="tablist"
            aria-label="Work order register tabs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={registerTab === 'work_orders'}
              onClick={() => setTab('work_orders')}
              className={cn(
                'rounded-md px-3 py-1.5 text-[12px] font-semibold transition',
                registerTab === 'work_orders'
                  ? 'bg-erp-primary text-white'
                  : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
              )}
            >
              Work Orders
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={registerTab === 'sales_orders'}
              onClick={() => setTab('sales_orders')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition',
                registerTab === 'sales_orders'
                  ? 'bg-erp-primary text-white'
                  : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
              )}
            >
              Sales Orders to Convert
              {eligibleSalesOrders.length > 0 ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                    registerTab === 'sales_orders' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900',
                  )}
                >
                  {eligibleSalesOrders.length}
                </span>
              ) : null}
            </button>
          </div>

          {registerTab === 'work_orders' ? (
            <>
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
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                          onClick={() => navigate('/manufacturing/work-orders/new')}
                        >
                          New Work Order
                        </button>
                        <button
                          type="button"
                          className="erp-btn erp-btn-secondary h-9 px-3 text-[13px]"
                          onClick={() => setTab('sales_orders')}
                        >
                          Sales Orders to Convert
                        </button>
                      </div>
                    ) : undefined
                  }
                />
              ) : null}
              {!loading && rows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-erp-border bg-white shadow-sm">
                  <DataTable columns={columns} data={rows} />
                </div>
              ) : null}
              {!loading && view && rows.length > 0 ? (
                <p className="text-[11px] text-erp-muted">
                  Showing {viewLabel} view
                  {filters.search ? ` · filtered by “${filters.search}”` : ''}
                  {filters.productItemId ? ` · item ${itemLabel(filters.productItemId)}` : ''}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-[12px] text-erp-muted">
                Confirmed / in-production sales orders with remaining quantity still available to convert into work
                orders.
              </p>
              {soLoading ? <LoadingState variant="table" rows={6} /> : null}
              {!soLoading && filteredSalesOrders.length === 0 ? (
                <ProductionEmptyState
                  icon={FileInput}
                  title="No sales orders need a work order"
                  description={
                    soSearch
                      ? `No sales orders match “${soSearch}”.`
                      : 'All confirmed sales order lines are fully converted, or none are eligible yet.'
                  }
                  action={
                    <button
                      type="button"
                      className="erp-btn erp-btn-secondary h-9 px-3 text-[13px]"
                      onClick={() => setTab('work_orders')}
                    >
                      Back to Work Orders
                    </button>
                  }
                />
              ) : null}
              {!soLoading && filteredSalesOrders.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-erp-border bg-white shadow-sm">
                  <DataTable columns={soColumns} data={filteredSalesOrders} />
                </div>
              ) : null}
            </>
          )}
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
