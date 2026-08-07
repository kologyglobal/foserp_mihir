import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table'
import {
  Ban,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  Layers,
  ListTree,
  MapPin,
  Package,
  PauseCircle,
  Pencil,
  RefreshCw,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Modal } from '@/design-system/components/Modal'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise'
import { Select } from '@/components/forms/Inputs'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import {
  PurchasePlanningSummaryCards,
  type PlanningSummaryFilterKey,
} from '@/components/purchase/PurchasePlanningSummaryCards'
import { PurchasePlanningViewDrawer } from '@/components/purchase/PurchasePlanningViewDrawer'
import { PurchaseStockDualQtyCell } from '@/components/purchase/PurchaseStockDualQtyCell'
import { PurchasePlanningEditDrawer } from '@/components/purchase/PurchasePlanningEditDrawer'
import {
  PurchasePlanningCreatePoModal,
  type CreatePoModalForm,
} from '@/components/purchase/PurchasePlanningCreatePoModal'
import {
  bulkSelectPurchasePlanningVendor,
  bulkUpdatePurchasePlanningStatus,
  canSelectPlanningRowForPo,
  cancelPurchasePlanningRow,
  createPurchaseOrdersFromConsolidation,
  createPurchaseOrdersFromPlanningSelection,
  getPurchaseOrderSeriesOptions,
  getPurchasePlanningSheet,
  getPurchaseSetup,
  getPurchaseWarehouses,
  getVendors,
  holdPurchasePlanningRow,
  recalculatePurchasePlanningRows,
  splitPurchasePlanningRowByVendor,
  updatePurchasePlanningSheetRow,
  PurchaseServiceError,
  PURCHASE_PLANNING_PRIORITY_LABELS,
  PURCHASE_PLANNING_PURCHASE_TYPE_LABELS,
  PURCHASE_PLANNING_STATUS_LABELS,
  PURCHASE_PLANNING_PRIORITIES,
  PURCHASE_PLANNING_PURCHASE_TYPES,
  PURCHASE_PLANNING_STATUSES,
  type PlanningSheetSummary,
  type PurchasePlanningSheetInput,
  type PurchaseOrderSeriesOption,
} from '@/services/purchase'
import { PurchasePlanningAllocateModal } from '@/components/purchase/PurchasePlanningAllocateModal'
import {
  consolidatePlanningRows,
  type FeConsolidatedGroup,
} from '@/utils/purchase/purchasePlanningConsolidation'
import { usePurchasePermissions } from '@/utils/permissions'
import type {
  PurchasePlanningPurchaseType,
  PurchasePlanningSheetRow,
  PurchasePlanningStatus,
  Vendor,
} from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { purchaseBreadcrumbs } from '@/utils/purchaseNavigation'
import { notify } from '@/store/toastStore'
import { exportRowsToCsv } from '@/utils/exportCsv'
import { systemConfirm, systemPrompt } from '@/utils/systemConfirm'
import { cn } from '@/utils/cn'
import type { CrmFilterField, CrmFilterValues } from '@/types/crmListFilters'

type SortKey =
  | 'planningDate'
  | 'requiredByDate'
  | 'priority'
  | 'status'
  | 'planningNumber'
  | 'prNumberAsc'
  | 'prNumberDesc'

const DEFAULT_FILTERS: CrmFilterValues = {
  search: '',
  planningNumber: '',
  prNumber: '',
  item: '',
  department: '',
  vendor: '',
  priority: '',
  status: '',
  purchaseType: '',
  planningDateFrom: '',
  planningDateTo: '',
  requiredByFrom: '',
  requiredByTo: '',
  overdue: false,
  vendorPending: false,
  poPending: false,
}

const HIDDEN_FROM_PENDING_VIEW: PurchasePlanningStatus[] = [
  'po_created',
  'completed',
  'cancelled',
]

const PLANNING_SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'planningDate', label: 'Planning date' },
  { value: 'requiredByDate', label: 'Required by' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'planningNumber', label: 'Planning no.' },
  { value: 'prNumberAsc', label: 'PR number (A→Z)' },
  { value: 'prNumberDesc', label: 'PR number (Z→A)' },
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function isOverdue(row: PurchasePlanningSheetRow) {
  if (!row.requiredByDate) return false
  if (HIDDEN_FROM_PENDING_VIEW.includes(row.status)) return false
  return row.requiredByDate < todayIso()
}

function isSelectionDisabled(row: PurchasePlanningSheetRow) {
  return HIDDEN_FROM_PENDING_VIEW.includes(row.status)
}

function summarizePlanningRows(rows: PurchasePlanningSheetRow[]): PlanningSheetSummary {
  const today = todayIso()
  return {
    totalPendingPlanning: rows.filter((r) => r.status === 'draft').length,
    criticalItems: rows.filter((r) => r.priority === 'critical').length,
    overdueItems: rows.filter(
      (r) =>
        Boolean(r.requiredByDate) &&
        r.requiredByDate < today &&
        !['completed', 'cancelled', 'po_created'].includes(r.status),
    ).length,
    vendorSelectionPending: rows.filter(
      (r) => !r.preferredVendorId && ['draft', 'pending_review'].includes(r.status),
    ).length,
    poPending: rows.filter((r) => r.status === 'po_pending').length,
    poCreated: rows.filter((r) => r.status === 'po_created').length,
    totalEstimatedPurchaseValue: rows
      .filter((r) => !['cancelled', 'completed'].includes(r.status))
      .reduce((s, r) => s + (r.estimatedAmount || 0), 0),
  }
}

function priorityTone(priority: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (priority === 'critical') return 'danger'
  if (priority === 'high') return 'warning'
  if (priority === 'medium' || priority === 'normal') return 'info'
  return 'neutral'
}

/** Human-readable gaps preventing Create PO for one row (mirrors canSelectPlanningRowForPo). */
function planningRowPoGaps(row: PurchasePlanningSheetRow): string[] {
  const gaps: string[] = []
  if (!['vendor_selected', 'approved', 'po_pending'].includes(row.status)) {
    gaps.push(
      `status is ${PURCHASE_PLANNING_STATUS_LABELS[row.status] ?? row.status} (needs Vendor Selected / Approved / PO Pending)`,
    )
  }
  if (!row.preferredVendorId) gaps.push('no vendor selected')
  const qty = row.netPurchaseQuantity > 0 ? row.netPurchaseQuantity : row.requiredQuantity
  if (!(qty > 0)) gaps.push('quantity is 0')
  if (!(row.expectedRate > 0)) gaps.push('rate is 0')
  if (!row.requiredByDate) gaps.push('no required date')
  return gaps
}

/** Tooltip text for the header Create PO button when selected rows are not eligible. */
function createPoDisabledReason(selected: PurchasePlanningSheetRow[]): string | undefined {
  const blocked = selected
    .map((r) => ({ row: r, gaps: planningRowPoGaps(r) }))
    .filter((e) => e.gaps.length > 0)
  if (blocked.length === 0) return undefined
  const shown = blocked
    .slice(0, 3)
    .map((e) => `${e.row.planningNumber}: ${e.gaps.join(', ')}`)
  const more = blocked.length > 3 ? ` (+${blocked.length - 3} more row(s))` : ''
  return `${shown.join(' • ')}${more}`
}

function filterRows(rows: PurchasePlanningSheetRow[], f: CrmFilterValues) {
  const q = String(f.search ?? '')
    .trim()
    .toLowerCase()
  const planningNo = String(f.planningNumber ?? '')
    .trim()
    .toLowerCase()
  const prNo = String(f.prNumber ?? '')
    .trim()
    .toLowerCase()
  const itemQ = String(f.item ?? '')
    .trim()
    .toLowerCase()

  return rows.filter((r) => {
    if (q) {
      const hay = [
        r.planningNumber,
        r.purchaseRequisitionNumber,
        r.itemCode,
        r.itemName,
        r.department,
        r.preferredVendorName,
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (planningNo && !r.planningNumber.toLowerCase().includes(planningNo)) return false
    if (prNo && !r.purchaseRequisitionNumber.toLowerCase().includes(prNo)) return false
    if (
      itemQ &&
      !`${r.itemCode} ${r.itemName}`.toLowerCase().includes(itemQ)
    ) {
      return false
    }
    if (f.department && r.department !== f.department) return false
    if (f.vendor && r.preferredVendorName !== f.vendor) return false
    if (f.priority && r.priority !== f.priority) return false
    if (f.status) {
      if (r.status !== f.status) return false
    } else if (HIDDEN_FROM_PENDING_VIEW.includes(r.status)) {
      // Default Pending Planning view (no Status column on grid): hide converted / terminal rows.
      // Pick Status = PO Created / Completed / Cancelled in filters to review them.
      return false
    }
    if (f.purchaseType && r.purchaseType !== f.purchaseType) return false
    if (f.planningDateFrom && r.planningDate < String(f.planningDateFrom)) return false
    if (f.planningDateTo && r.planningDate > String(f.planningDateTo)) return false
    if (f.requiredByFrom && r.requiredByDate < String(f.requiredByFrom)) return false
    if (f.requiredByTo && r.requiredByDate > String(f.requiredByTo)) return false
    if (f.overdue === true && !isOverdue(r)) return false
    if (f.vendorPending === true && Boolean(r.preferredVendorId)) return false
    if (f.poPending === true && r.status !== 'po_pending') return false
    return true
  })
}

function sortRows(rows: PurchasePlanningSheetRow[], sortBy: SortKey) {
  const list = [...rows]
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })
  switch (sortBy) {
    case 'planningNumber':
      return list.sort((a, b) => cmp(a.planningNumber, b.planningNumber))
    case 'prNumberAsc':
      return list.sort((a, b) =>
        cmp(a.purchaseRequisitionNumber, b.purchaseRequisitionNumber),
      )
    case 'prNumberDesc':
      return list.sort((a, b) =>
        cmp(b.purchaseRequisitionNumber, a.purchaseRequisitionNumber),
      )
    case 'requiredByDate':
      return list.sort((a, b) => cmp(a.requiredByDate, b.requiredByDate))
    case 'priority':
      return list.sort((a, b) => cmp(a.priority, b.priority))
    case 'status':
      return list.sort((a, b) => cmp(a.status, b.status))
    default:
      return list.sort((a, b) => cmp(b.planningDate, a.planningDate))
  }
}

function Truncate({ text, className }: { text: string; className?: string }) {
  const value = text.trim() || '—'
  return (
    <span className={cn('block max-w-[14rem] truncate', className)} title={value}>
      {value}
    </span>
  )
}

/** Product demand = consolidated Item+UOM+Location; document = one PPS row per PR line. */
type PlanningViewMode = 'product' | 'document'

export function PurchasePlanningSheetPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = usePurchasePermissions()
  const [rows, setRows] = useState<PurchasePlanningSheetRow[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [warehouses, setWarehouses] = useState<
    Array<{ id: string; name: string; address?: string }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CrmFilterValues>(() => ({
    ...DEFAULT_FILTERS,
    search: searchParams.get('search') ?? '',
  }))
  const [sortBy, setSortBy] = useState<SortKey>('planningDate')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creatingPo, setCreatingPo] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [poModalOpen, setPoModalOpen] = useState(false)
  const [poModalRows, setPoModalRows] = useState<PurchasePlanningSheetRow[]>([])
  const [seriesOptions, setSeriesOptions] = useState<PurchaseOrderSeriesOption[]>([])
  const [viewRow, setViewRow] = useState<PurchasePlanningSheetRow | null>(null)
  const [editRow, setEditRow] = useState<PurchasePlanningSheetRow | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [splittingEdit, setSplittingEdit] = useState(false)
  const [bulkVendorOpen, setBulkVendorOpen] = useState(false)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkVendorId, setBulkVendorId] = useState('')
  const [bulkStatus, setBulkStatus] = useState('po_pending')
  /**
   * Product-centric demand is the default page view (groups Item + UOM + location).
   * Setup flag tracks tenant preference/messaging; on-page toggle switches to document lines.
   */
  const [viewMode, setViewMode] = useState<PlanningViewMode>('product')
  const [setupPrefersProduct, setSetupPrefersProduct] = useState(true)
  const consolidationEnabled = viewMode === 'product'
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>({})
  const [allocateGroup, setAllocateGroup] = useState<FeConsolidatedGroup | null>(null)
  const [allocating, setAllocating] = useState(false)
  const [summaryFilterKey, setSummaryFilterKey] = useState<PlanningSummaryFilterKey | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sheet, v, wh, setup] = await Promise.all([
        getPurchasePlanningSheet(),
        getVendors(),
        getPurchaseWarehouses(),
        getPurchaseSetup().catch(() => null),
      ])
      // Product-centric is the product goal (page defaults to product; toggle is sticky across reloads).
      // Explicit false in setup only updates the banner/hint about tenant default — not the active grid mode.
      const setupFlag = setup?.general?.planningConsolidationEnabled
      setSetupPrefersProduct(setupFlag !== false)
      const enriched = sheet.map((r) => {
        if (r.preferredVendorName || !r.preferredVendorId) return r
        const match = v.find((x) => x.id === r.preferredVendorId)
        if (!match) return r
        return {
          ...r,
          preferredVendorName: match.vendorName,
          preferredVendorCode: match.vendorCode || r.preferredVendorCode,
        }
      })
      setRows(enriched)
      setVendors(v)
      setWarehouses(
        wh.map((w) => ({ id: w.id, name: w.name, address: w.address || undefined })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load planning sheet')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const departmentOptions = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(),
    [rows],
  )
  const vendorOptions = useMemo(() => {
    const fromRows = rows
      .map(
        (r) =>
          r.preferredVendorName ||
          vendors.find((v) => v.id === r.preferredVendorId)?.vendorName ||
          '',
      )
      .filter(Boolean)
    return [...new Set(fromRows)].sort()
  }, [rows, vendors])

  const filterFields = useMemo<CrmFilterField[]>(
    () => [
      { key: 'planningNumber', label: 'Planning Number', type: 'select', options: [] },
      { key: 'prNumber', label: 'PR Number', type: 'select', options: [] },
      { key: 'item', label: 'Item', type: 'select', options: [] },
      {
        type: 'date-range',
        label: 'Planning Date',
        fromKey: 'planningDateFrom',
        toKey: 'planningDateTo',
      },
      {
        type: 'date-range',
        label: 'Required Date',
        fromKey: 'requiredByFrom',
        toKey: 'requiredByTo',
      },
      {
        key: 'department',
        label: 'Department',
        type: 'select',
        options: departmentOptions.map((d) => ({ value: d, label: d })),
      },
      {
        key: 'vendor',
        label: 'Vendor',
        type: 'select',
        options: vendorOptions.map((v) => ({ value: v, label: v })),
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        options: PURCHASE_PLANNING_PRIORITIES.map((p) => ({
          value: p,
          label: PURCHASE_PLANNING_PRIORITY_LABELS[p],
        })),
      },
      {
        key: 'purchaseType',
        label: 'Purchase Type',
        type: 'select',
        options: PURCHASE_PLANNING_PURCHASE_TYPES.map((t) => ({
          value: t,
          label: PURCHASE_PLANNING_PURCHASE_TYPE_LABELS[t],
        })),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: PURCHASE_PLANNING_STATUSES.map((s) => ({
          value: s,
          label: PURCHASE_PLANNING_STATUS_LABELS[s],
        })),
      },
      { key: 'overdue', label: 'Overdue only', type: 'boolean' },
      { key: 'poPending', label: 'PO Pending only', type: 'boolean' },
      { key: 'vendorPending', label: 'Vendor selection pending', type: 'boolean' },
    ],
    [departmentOptions, vendorOptions],
  )

  // Free-text fields: use search-select with empty options falls back poorly.
  // Replace planning/pr/item with text via search-select empty — CrmFilterDrawer may need select.
  // Use boolean + date-range + select; planning/pr/item go through search bar or we use select with dynamic options.
  const filterFieldsResolved = useMemo<CrmFilterField[]>(() => {
    const planningNos = [...new Set(rows.map((r) => r.planningNumber))].sort()
    const prNos = [...new Set(rows.map((r) => r.purchaseRequisitionNumber))].sort()
    const items = [
      ...new Set(rows.map((r) => `${r.itemCode} ${r.itemName}`.trim()).filter(Boolean)),
    ].sort()
    return filterFields.map((field) => {
      if ('key' in field && field.key === 'planningNumber') {
        return {
          ...field,
          type: 'search-select' as const,
          options: planningNos.map((v) => ({ value: v, label: v })),
        }
      }
      if ('key' in field && field.key === 'prNumber') {
        return {
          ...field,
          type: 'search-select' as const,
          options: prNos.map((v) => ({ value: v, label: v })),
        }
      }
      if ('key' in field && field.key === 'item') {
        return {
          ...field,
          type: 'search-select' as const,
          options: items.map((v) => ({ value: v, label: v })),
        }
      }
      return field
    })
  }, [filterFields, rows])

  const filterDrawer = useCrmFilterDrawer({
    values: filters,
    onChange: setFilters,
    fields: filterFieldsResolved,
    defaults: DEFAULT_FILTERS,
    chipLabelResolver: (key, value) => {
      if (key === 'priority')
        return (
          PURCHASE_PLANNING_PRIORITY_LABELS[value as keyof typeof PURCHASE_PLANNING_PRIORITY_LABELS] ??
          value
        )
      if (key === 'status') return PURCHASE_PLANNING_STATUS_LABELS[value as PurchasePlanningStatus] ?? value
      if (key === 'purchaseType')
        return (
          PURCHASE_PLANNING_PURCHASE_TYPE_LABELS[value as PurchasePlanningPurchaseType] ?? value
        )
      if (key === 'overdue' || key === 'poPending' || key === 'vendorPending')
        return value === 'true' || value === '1' ? 'Yes' : 'No'
      return undefined
    },
  })

  const filtered = useMemo(() => sortRows(filterRows(rows, filters), sortBy), [rows, filters, sortBy])

  const prHeaderSort = useMemo(() => {
    if (sortBy === 'prNumberAsc') return { columnId: 'prNumber', desc: false }
    if (sortBy === 'prNumberDesc') return { columnId: 'prNumber', desc: true }
    return null
  }, [sortBy])

  const handleDocumentHeaderSort = useCallback(
    (sort: { columnId: string; desc: boolean } | null) => {
      if (!sort) {
        setSortBy('planningDate')
        return
      }
      if (sort.columnId !== 'prNumber') return
      setSortBy(sort.desc ? 'prNumberDesc' : 'prNumberAsc')
    },
    [],
  )

  useEffect(() => {
    if (sortBy === 'prNumberAsc' || sortBy === 'prNumberDesc') {
      setViewMode('document')
    }
  }, [sortBy])

  const summary = useMemo(() => summarizePlanningRows(rows), [rows])

  const consolidatedGroups = useMemo(() => {
    if (!consolidationEnabled) return []
    return consolidatePlanningRows(
      filtered.map((r) => ({
        id: r.id,
        itemId: r.itemId || null,
        itemCode: r.itemCode,
        itemName: r.itemName,
        itemDescription: r.specification || r.itemName,
        uomId: r.uom || null,
        deliveryLocationId: r.deliveryLocationId ?? null,
        requiredQuantity: r.requiredQuantity,
        netPurchaseQuantity: r.netPurchaseQuantity,
        requiredDate: r.requiredByDate || null,
        purchaseRequisitionId: r.purchaseRequisitionId,
        purchaseRequisitionNumber: r.purchaseRequisitionNumber,
        purchaseRequisitionLineId: r.purchaseRequisitionLineId,
        preferredVendorId: r.preferredVendorId,
        selectedVendorId: r.preferredVendorId,
        preferredVendorName: r.preferredVendorName,
        expectedRate: r.expectedRate,
        negotiatedRate: r.negotiatedRate,
        status: r.status,
        planningNumber: r.planningNumber,
        currentStock: r.currentStock,
        openPoQuantity: r.openPoQuantity,
        orderedQuantity: r.orderedQuantity,
        remainingQuantity: r.remainingQuantity,
      })),
    )
  }, [consolidationEnabled, filtered])

  const onCreateFromConsolidation = async (
    allocations: Array<{ vendorId: string; quantity: number; rate: number }>,
  ) => {
    if (!allocateGroup) return
    setAllocating(true)
    try {
      const orders = await createPurchaseOrdersFromConsolidation({
        planningRowIds: allocateGroup.planningRowIds,
        allocations,
      })
      notify.success(
        orders.length === 1
          ? `Created ${orders[0].documentNumber}`
          : `Created ${orders.length} purchase orders`,
      )
      setAllocateGroup(null)
      await load()
      if (orders[0]?.id) navigate(`/purchase/orders/${orders[0].id}`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to create PO from allocation')
    } finally {
      setAllocating(false)
    }
  }

  const selectedRows = useMemo(
    () => filtered.filter((r) => rowSelection[r.id]),
    [filtered, rowSelection],
  )
  const selectedReadyCount = useMemo(
    () => selectedRows.filter((r) => canSelectPlanningRowForPo(r)).length,
    [selectedRows],
  )
  const allSelectedEligible =
    selectedRows.length > 0 && selectedReadyCount === selectedRows.length

  const patchRowLocal = (next: PurchasePlanningSheetRow) => {
    setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)))
    setViewRow((cur) => (cur?.id === next.id ? next : cur))
    setEditRow((cur) => (cur?.id === next.id ? next : cur))
  }

  const openCreatePoDialog = async (rowsOverride?: PurchasePlanningSheetRow[]) => {
    if (!perms.canCreatePoFromPlanning) {
      notify.error('You do not have permission to create purchase orders from planning')
      return
    }
    const target = rowsOverride ?? selectedRows
    if (target.length === 0) {
      notify.error('Select at least one planning row')
      return
    }
    const eligible = target.every((r) => canSelectPlanningRowForPo(r))
    if (!eligible) {
      notify.error(
        createPoDisabledReason(target) ??
          'All selected rows need vendor, quantity, rate, required date, and a ready status before Create PO',
      )
      return
    }
    try {
      const options = await getPurchaseOrderSeriesOptions()
      setSeriesOptions(options)
      setPoModalRows(target)
      setPoModalOpen(true)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not open Create PO')
    }
  }

  const confirmCreatePo = async (form: CreatePoModalForm) => {
    const series = seriesOptions[0]
    if (!series) {
      notify.error('Purchase Order number series is not configured in Setup')
      return
    }
    setCreatingPo(true)
    try {
      const orders = await createPurchaseOrdersFromPlanningSelection(
        poModalRows.map((r) => r.id),
        {
          seriesPrefix: series.prefix,
          orderDate: form.poDate,
          deliveryWarehouseId: form.warehouse || undefined,
          deliveryAddress: form.deliveryAddress.trim() || undefined,
          remarks: form.remarks.trim() || undefined,
          orderQuantities: form.orderQuantities,
        },
      )
      notify.success(
        orders.length === 1
          ? `Purchase order ${orders[0].documentNumber} created`
          : `${orders.length} purchase orders created`,
      )
      setPoModalOpen(false)
      setPoModalRows([])
      setRowSelection({})
      await load()
      if (orders.length === 1) navigate(`/purchase/orders/${orders[0].id}`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Could not create PO')
    } finally {
      setCreatingPo(false)
    }
  }

  const onRecalculate = async (ids?: string[]) => {
    if (!perms.canEditPlanning && !perms.canEditRequisition) {
      notify.error('You do not have permission to recalculate planning quantities')
      return
    }
    setRecalculating(true)
    try {
      await recalculatePurchasePlanningRows(ids?.length ? ids : rows.map((r) => r.id))
      notify.success('Stock and open PO quantities refreshed')
      await load()
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Recalculate failed')
    } finally {
      setRecalculating(false)
    }
  }

  const onSaveEdit = async (patch: PurchasePlanningSheetInput) => {
    if (!editRow) return
    setSavingEdit(true)
    try {
      const updated = await updatePurchasePlanningSheetRow(editRow.id, patch)
      patchRowLocal(updated)
      notify.success('Planning row updated')
      setEditRow(null)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
    } finally {
      setSavingEdit(false)
    }
  }

  const onSplitEdit = async (splits: Array<{ vendorId: string; allocatedQuantity: number }>) => {
    if (!editRow) return
    setSplittingEdit(true)
    try {
      await splitPurchasePlanningRowByVendor(editRow.id, splits)
      notify.success('Planning row split by vendor')
      setEditRow(null)
      await load()
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Split failed')
    } finally {
      setSplittingEdit(false)
    }
  }

  const runRowAction = async (
    row: PurchasePlanningSheetRow,
    work: () => Promise<PurchasePlanningSheetRow | void>,
    success: string,
  ) => {
    setBusyId(row.id)
    try {
      const result = await work()
      if (result) patchRowLocal(result)
      else await load()
      notify.success(success)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const buildRowActions = (row: PurchasePlanningSheetRow): RowActionItem[] => {
    const canEdit = perms.canEditPlanning || perms.canEditRequisition
    const terminal = isSelectionDisabled(row)
    return [
      {
        id: 'view',
        label: 'View',
        icon: Eye,
        onClick: () => setViewRow(row),
      },
      {
        id: 'edit',
        label: 'Edit Planning',
        icon: Pencil,
        onClick: () => setEditRow(row),
        disabled: !canEdit || terminal,
      },
      {
        id: 'select-vendor',
        label: 'Select Vendor',
        icon: Users,
        onClick: () => {
          setRowSelection({ [row.id]: true })
          setBulkVendorOpen(true)
        },
        disabled: !canEdit || terminal,
      },
      {
        id: 'recalculate',
        label: 'Recalculate',
        icon: RefreshCw,
        onClick: () => void onRecalculate([row.id]),
        disabled: !canEdit || recalculating,
      },
      {
        id: 'create-po',
        label: 'Create PO',
        icon: ShoppingCart,
        onClick: () => {
          void openCreatePoDialog([row])
        },
        disabled:
          !canSelectPlanningRowForPo(row) ||
          !perms.canCreatePoFromPlanning,
        disabledReason: !perms.canCreatePoFromPlanning
          ? 'You do not have permission to create purchase orders (purchase.planning.create_po)'
          : planningRowPoGaps(row).join(', ') || undefined,
      },
      {
        id: 'hold',
        label: 'Put on Hold',
        icon: PauseCircle,
        onClick: () =>
          void (async () => {
            const note = await systemPrompt({
              title: 'Put planning row on hold',
              description: 'Optional reason for hold.',
              confirmLabel: 'Hold',
              required: false,
            })
            if (note === null) return
            await runRowAction(
              row,
              () => holdPurchasePlanningRow(row.id, note || 'On hold'),
              `${row.planningNumber} put on hold`,
            )
          })(),
        disabled: !canEdit || terminal,
      },
      {
        id: 'cancel',
        label: 'Cancel',
        icon: Ban,
        onClick: () =>
          void (async () => {
            const ok = await systemConfirm({
              title: 'Cancel planning row?',
              description: `${row.planningNumber} will be cancelled.`,
              confirmLabel: 'Cancel row',
              variant: 'danger',
            })
            if (!ok) return
            await runRowAction(
              row,
              () => cancelPurchasePlanningRow(row.id, 'Cancelled from planning sheet'),
              `${row.planningNumber} cancelled`,
            )
          })(),
        disabled: !canEdit || terminal,
        danger: true,
      },
      {
        id: 'view-pr',
        label: 'View PR',
        icon: ClipboardList,
        onClick: () => navigate(`/purchase/requisitions/${row.purchaseRequisitionId}`),
      },
      {
        id: 'view-po',
        label: 'View PO',
        icon: ShoppingCart,
        onClick: () => {
          if (row.purchaseOrderId) navigate(`/purchase/orders/${row.purchaseOrderId}`)
        },
        disabled: !row.purchaseOrderId,
      },
    ]
  }

  const exportList = () => {
    exportRowsToCsv(
      `purchase-planning-sheet-${todayIso()}`,
      [
        'Planning Number',
        'Planning Date',
        'PR Number',
        'Department',
        'Item Code',
        'Item Name',
        'Required Qty',
        'Current Stock',
        'Open PO Qty',
        'Net Purchase Qty',
        'UOM',
        'Required Date',
        'Vendor',
        'Expected Rate',
        'Estimated Amount',
      ],
      filtered.map((r) => [
        r.planningNumber,
        r.planningDate,
        r.purchaseRequisitionNumber,
        r.department,
        r.itemCode,
        r.itemName,
        r.requiredQuantity,
        r.currentStock,
        r.openPoQuantity,
        r.netPurchaseQuantity,
        r.uom,
        r.requiredByDate,
        r.preferredVendorName ?? '',
        r.expectedRate,
        r.estimatedAmount,
      ]),
    )
    notify.success(`Exported ${filtered.length} row(s)`)
  }

  const columns = useMemo<ColumnDef<PurchasePlanningSheetRow, unknown>[]>(
    () => [
      {
        id: 'planningNumber',
        accessorKey: 'planningNumber',
        header: 'Planning Number',
        meta: { columnLabel: 'Planning Number' },
        cell: ({ row }) => (
          <button
            type="button"
            className={cn(
              'font-mono text-[12px] font-medium text-erp-primary hover:underline',
              row.original.priority === 'critical' && 'text-red-700',
            )}
            title={
              row.original.priority === 'critical'
                ? `Critical · ${row.original.planningNumber}`
                : row.original.planningNumber
            }
            onClick={() => setViewRow(row.original)}
          >
            {row.original.planningNumber}
          </button>
        ),
      },
      {
        id: 'planningDate',
        accessorKey: 'planningDate',
        header: 'Planning Date',
        meta: { columnLabel: 'Planning Date' },
        cell: ({ row }) => formatDate(row.original.planningDate),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusDot
            label={PURCHASE_PLANNING_STATUS_LABELS[row.original.status] ?? row.original.status}
            tone={statusToneFromLabel(row.original.status)}
          />
        ),
      },
      {
        id: 'priority',
        accessorKey: 'priority',
        header: 'Priority',
        meta: { columnLabel: 'Priority' },
        cell: ({ row }) => (
          <StatusDot
            label={
              PURCHASE_PLANNING_PRIORITY_LABELS[
                row.original.priority as keyof typeof PURCHASE_PLANNING_PRIORITY_LABELS
              ] ?? row.original.priority
            }
            tone={priorityTone(row.original.priority)}
          />
        ),
      },
      {
        id: 'prNumber',
        accessorKey: 'purchaseRequisitionNumber',
        header: 'PR Number',
        enableSorting: true,
        meta: { columnLabel: 'PR Number' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/requisitions/${row.original.purchaseRequisitionId}`}>
            {row.original.purchaseRequisitionNumber}
          </TableLink>
        ),
      },
      {
        id: 'department',
        accessorKey: 'department',
        header: 'Department',
        meta: { columnLabel: 'Department' },
        cell: ({ row }) => <Truncate text={row.original.department} />,
      },
      {
        id: 'itemCode',
        accessorKey: 'itemCode',
        header: 'Item Code',
        meta: { columnLabel: 'Item Code' },
        cell: ({ row }) => (
          <span className="font-mono text-[12px]">{row.original.itemCode || '—'}</span>
        ),
      },
      {
        id: 'itemName',
        accessorKey: 'itemName',
        header: 'Item Name',
        meta: { columnLabel: 'Item Name' },
        cell: ({ row }) => <Truncate text={row.original.itemName} />,
      },
      {
        id: 'requiredQuantity',
        accessorKey: 'requiredQuantity',
        header: 'Required Quantity',
        meta: { columnLabel: 'Required Quantity', align: 'right' },
        cell: ({ row }) => (
          <PurchaseStockDualQtyCell
            baseQty={row.original.requiredQuantity}
            itemId={row.original.itemId}
            bareWhenSingle
          />
        ),
      },
      {
        id: 'currentStock',
        accessorKey: 'currentStock',
        header: 'Current Stock',
        meta: { columnLabel: 'Current Stock', align: 'right' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.currentStock}</span>,
      },
      {
        id: 'openPoQuantity',
        accessorKey: 'openPoQuantity',
        header: 'Open PO Quantity',
        meta: { columnLabel: 'Open PO Quantity', align: 'right' },
        cell: ({ row }) => <span className="tabular-nums">{row.original.openPoQuantity}</span>,
      },
      {
        id: 'allocatedQuantity',
        accessorKey: 'allocatedQuantity',
        header: 'Allocated',
        meta: { columnLabel: 'Allocated', align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.allocatedQuantity}</span>
        ),
      },
      {
        id: 'orderedQuantity',
        accessorKey: 'orderedQuantity',
        header: 'Ordered',
        meta: { columnLabel: 'Ordered', align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.orderedQuantity}</span>
        ),
      },
      {
        id: 'remainingQuantity',
        accessorKey: 'remainingQuantity',
        header: 'Qty to order in PO',
        meta: { columnLabel: 'Qty to order in PO', align: 'right' },
        cell: ({ row }) => (
          <PurchaseStockDualQtyCell
            baseQty={row.original.remainingQuantity}
            itemId={row.original.itemId}
            className="font-medium"
            bareWhenSingle
          />
        ),
      },
      {
        id: 'netPurchaseQuantity',
        accessorKey: 'netPurchaseQuantity',
        header: 'Net Purchase Quantity',
        meta: { columnLabel: 'Net Purchase Quantity', align: 'right' },
        cell: ({ row }) => (
          <PurchaseStockDualQtyCell
            baseQty={row.original.netPurchaseQuantity}
            itemId={row.original.itemId}
            className="font-medium"
            bareWhenSingle
          />
        ),
      },
      {
        id: 'uom',
        accessorKey: 'uom',
        header: 'UOM',
        meta: { columnLabel: 'UOM' },
        cell: ({ row }) => row.original.uom || '—',
      },
      {
        id: 'requiredByDate',
        accessorKey: 'requiredByDate',
        header: 'Required Date',
        meta: { columnLabel: 'Required Date' },
        cell: ({ row }) => {
          const overdue = isOverdue(row.original)
          return (
            <span className={cn('tabular-nums', overdue && 'font-semibold text-red-700')}>
              {row.original.requiredByDate ? formatDate(row.original.requiredByDate) : '—'}
            </span>
          )
        },
      },
      {
        id: 'vendor',
        header: 'Selected Vendor',
        meta: { columnLabel: 'Selected Vendor' },
        cell: ({ row }) => {
          const r = row.original
          const name =
            r.preferredVendorName ||
            vendors.find((v) => v.id === r.preferredVendorId)?.vendorName ||
            ''
          return <Truncate text={name} />
        },
      },
      {
        id: 'expectedRate',
        accessorKey: 'expectedRate',
        header: 'Expected Rate',
        meta: { columnLabel: 'Expected Rate', align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.expectedRate)}</span>
        ),
      },
      {
        id: 'estimatedAmount',
        accessorKey: 'estimatedAmount',
        header: 'Estimated Amount',
        meta: { columnLabel: 'Estimated Amount', align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.estimatedAmount)}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { columnLabel: 'Actions', align: 'center', sticky: 'right' },
        cell: ({ row }) => (
          <div className={cn(busyId === row.original.id && 'pointer-events-none opacity-60')}>
            <EnterpriseRowActionsMenu actions={buildRowActions(row.original)} />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyId, recalculating, perms, vendors],
  )

  const canEdit = perms.canEditPlanning || perms.canEditRequisition

  return (
    <>
      <OperationalPageShell
        title="Purchase Planning Sheet"
        description="Review demand, assign vendors, and create purchase orders from approved requisitions."
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={purchaseBreadcrumbs('Purchase Planning Sheet')}
        favoritePath="/purchase/planning-sheet"
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'create-po',
              label:
                selectedRows.length > 0
                  ? `Create Purchase Order (${selectedRows.length})`
                  : 'Create Purchase Order',
              icon: ShoppingCart,
              onClick: () => void openCreatePoDialog(),
              disabled:
                creatingPo ||
                !allSelectedEligible ||
                !perms.canCreatePoFromPlanning,
              disabledReason: !perms.canCreatePoFromPlanning
                ? 'You do not have permission to create purchase orders (purchase.planning.create_po). Contact your administrator.'
                : creatingPo
                  ? 'Purchase order creation is in progress…'
                  : selectedRows.length === 0
                    ? 'Select at least one planning row first'
                    : createPoDisabledReason(selectedRows) ??
                      'Selected rows are not ready for PO (need vendor, quantity, rate, and required date)',
            }}
            secondaryActions={[
              {
                id: 'refresh-stock',
                label: recalculating ? 'Refreshing…' : 'Refresh Stock',
                icon: RefreshCw,
                onClick: () => void onRecalculate(),
                disabled: recalculating || loading || !canEdit,
                pin: true,
              },
              {
                id: 'export',
                label: 'Export',
                icon: Download,
                onClick: exportList,
                disabled: filtered.length === 0,
                pin: true,
              },
            ]}
            moreActions={[
              {
                id: 'bulk-vendor',
                label: 'Select Vendor',
                icon: Users,
                onClick: () => setBulkVendorOpen(true),
                disabled: selectedRows.length === 0 || !canEdit,
              },
              {
                id: 'bulk-status',
                label: 'Update Status',
                icon: ClipboardList,
                onClick: () => setBulkStatusOpen(true),
                disabled: selectedRows.length === 0 || !canEdit,
              },
            ]}
          />
        }
      >
        {loading ? (
          <LoadingState variant="table" rows={8} />
        ) : error ? (
          <EmptyState
            icon={ClipboardList}
            title="Could not load planning sheet"
            description={error}
            action={
              <button
                type="button"
                className="erp-btn erp-btn--primary text-[13px]"
                onClick={() => void load()}
              >
                Retry
              </button>
            }
          />
        ) : (
          <div className="purchase-planning-register min-w-0 space-y-3">
            <PurchasePlanningSummaryCards
              summary={summary}
              activeKey={summaryFilterKey}
              onSelect={(key, patch) => {
                setSummaryFilterKey(key)
                setFilters((f) => ({ ...f, ...patch }))
              }}
            />

            <div className="purchase-planning-register__toolbar">
              <div
                className="purchase-planning-register__view-switch erp-segmented-pills"
                role="tablist"
                aria-label="Planning view"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={consolidationEnabled}
                  className={cn(
                    'erp-segmented-pills__btn',
                    consolidationEnabled && 'erp-segmented-pills__btn--active',
                  )}
                  onClick={() => setViewMode('product')}
                >
                  <Layers className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  Product demand
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={!consolidationEnabled}
                  className={cn(
                    'erp-segmented-pills__btn',
                    !consolidationEnabled && 'erp-segmented-pills__btn--active',
                  )}
                  onClick={() => setViewMode('document')}
                >
                  <ListTree className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  Document lines
                </button>
              </div>

              <div className="purchase-planning-register__meta">
                {consolidationEnabled ? (
                  <>
                    <span className="purchase-planning-register__count">
                      {consolidatedGroups.length} item group
                      {consolidatedGroups.length === 1 ? '' : 's'}
                    </span>
                    <span className="purchase-planning-register__sep" aria-hidden>
                      ·
                    </span>
                    <span>
                      {filtered.length} PR line{filtered.length === 1 ? '' : 's'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="purchase-planning-register__count">
                      {filtered.length} of {rows.length} line
                      {rows.length === 1 ? '' : 's'}
                    </span>
                    {selectedRows.length > 0 ? (
                      <>
                        <span className="purchase-planning-register__sep" aria-hidden>
                          ·
                        </span>
                        <span className="purchase-planning-register__selected">
                          {selectedRows.length} selected
                          {selectedReadyCount < selectedRows.length
                            ? ` (${selectedReadyCount} ready for PO)`
                            : ''}
                        </span>
                      </>
                    ) : null}
                  </>
                )}
              </div>

              {!setupPrefersProduct && consolidationEnabled ? (
                <p className="purchase-planning-register__hint">
                  Tenant default is document lines — change in{' '}
                  <TableLink to="/purchase/setup">Purchase Setup</TableLink>.
                </p>
              ) : (
                <p className="purchase-planning-register__hint">
                  {consolidationEnabled
                    ? 'Same item + UOM + location from multiple PRs appears as one row. Expand for PR source lines.'
                    : 'One row per PR / planning line. Select rows to create POs or run bulk actions.'}
                </p>
              )}
            </div>

            {!consolidationEnabled && selectedRows.length > 0 ? (
              <div className="purchase-planning-register__selection-bar" role="status">
                <div className="purchase-planning-register__selection-text">
                  <strong>{selectedRows.length}</strong> row
                  {selectedRows.length === 1 ? '' : 's'} selected
                  {selectedReadyCount > 0 ? (
                    <span className="text-erp-muted">
                      {' '}
                      · {selectedReadyCount} ready for PO
                    </span>
                  ) : null}
                </div>
                <ErpButtonGroup className="shrink-0">
                  <ErpButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={Users}
                    disabled={!canEdit}
                    onClick={() => setBulkVendorOpen(true)}
                  >
                    Select vendor
                  </ErpButton>
                  <ErpButton
                    type="button"
                    size="sm"
                    variant="primary"
                    icon={ShoppingCart}
                    disabled={
                      creatingPo ||
                      !allSelectedEligible ||
                      !perms.canCreatePoFromPlanning
                    }
                    onClick={() => void openCreatePoDialog()}
                  >
                    Create PO
                  </ErpButton>
                  <ErpButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRowSelection({})}
                  >
                    Clear
                  </ErpButton>
                </ErpButtonGroup>
              </div>
            ) : null}

            {consolidationEnabled ? (
              <EnterpriseRegisterTableShell className="min-w-0 purchase-planning-register__grid">
                <div className="border-b border-erp-border bg-erp-surface-alt px-3 py-2">
                  <CrmListFilterBar
                    search={String(filters.search ?? '')}
                    onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
                    searchPlaceholder="Search item, PR, vendor…"
                    activeFilterCount={filterDrawer.activeCount}
                    onOpenFilters={filterDrawer.openDrawer}
                    chips={filterDrawer.chips}
                    onRemoveChip={filterDrawer.removeChip}
                    onClearAll={() => {
                      setFilters(DEFAULT_FILTERS)
                      setSummaryFilterKey(null)
                    }}
                    className="crm-list-filter-bar--embedded !border-0 !bg-transparent !p-0"
                    showCommandPaletteHint={false}
                    sort={
                      <CrmListSortSelect
                        value={sortBy}
                        onChange={(v) => setSortBy(v as SortKey)}
                        aria-label="Sort planning sheet"
                        options={PLANNING_SORT_OPTIONS}
                      />
                    }
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="purchase-planning-demand-table min-w-full text-left">
                    <thead>
                      <tr>
                        <th className="w-10" scope="col">
                          <span className="sr-only">Expand</span>
                        </th>
                        <th scope="col">Item</th>
                        <th scope="col">Location / UOM</th>
                        <th scope="col" className="text-right">
                          Total req
                        </th>
                        <th scope="col" className="text-right">
                          Net to buy
                        </th>
                        <th scope="col" className="text-right">
                          PO ordered
                        </th>
                        <th scope="col" className="text-right">
                          Remaining
                        </th>
                        <th scope="col" className="text-right">
                          PRs
                        </th>
                        <th scope="col">Earliest required</th>
                        <th scope="col">Suggested vendors</th>
                        <th scope="col" className="text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {consolidatedGroups.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="purchase-planning-demand-table__empty">
                            <div className="flex flex-col items-center gap-2 py-10 text-center">
                              <Package className="h-8 w-8 text-erp-muted opacity-50" aria-hidden />
                              <p className="text-[13px] font-medium text-erp-text">
                                No demand groups for current filters
                              </p>
                              <p className="max-w-sm text-[12px] text-erp-muted">
                                Adjust filters or switch to Document lines. Converted and cancelled rows are
                                hidden unless Status is set.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        consolidatedGroups.map((g) => {
                          const open = Boolean(expandedGroupKeys[g.groupKey])
                          const netQty = g.totalNetQty || g.totalRequiredQty
                          const poQty = g.totalOrderedQty
                          const remainingQty =
                            g.totalRemainingQty > 0
                              ? g.totalRemainingQty
                              : Math.max(0, netQty - poQty)
                          const allocateQty = remainingQty > 0 ? remainingQty : netQty
                          const overdueEarliest =
                            Boolean(g.earliestRequiredDate) && g.earliestRequiredDate! < todayIso()
                          return (
                            <Fragment key={g.groupKey}>
                              <tr
                                className={cn(
                                  'purchase-planning-demand-table__row',
                                  open && 'purchase-planning-demand-table__row--open',
                                )}
                              >
                                <td>
                                  <button
                                    type="button"
                                    className="purchase-planning-demand-table__expand"
                                    aria-expanded={open}
                                    aria-label={open ? 'Collapse PR lines' : 'Expand PR lines'}
                                    onClick={() =>
                                      setExpandedGroupKeys((prev) => ({
                                        ...prev,
                                        [g.groupKey]: !prev[g.groupKey],
                                      }))
                                    }
                                  >
                                    {open ? (
                                      <ChevronDown className="h-4 w-4" aria-hidden />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" aria-hidden />
                                    )}
                                  </button>
                                </td>
                                <td>
                                  <div className="purchase-planning-demand-table__item">
                                    <span className="purchase-planning-demand-table__code">
                                      {g.itemCode || '—'}
                                    </span>
                                    <span className="purchase-planning-demand-table__name">
                                      {g.itemName}
                                    </span>
                                    {g.description && g.description !== g.itemName ? (
                                      <span className="purchase-planning-demand-table__desc">
                                        {g.description}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td>
                                  <div className="purchase-planning-demand-table__loc">
                                    <span className="inline-flex items-center gap-1 text-erp-muted">
                                      <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                                      {g.deliveryLocationId
                                        ? warehouses.find((w) => w.id === g.deliveryLocationId)?.name ||
                                          g.deliveryLocationId
                                        : 'Any location'}
                                    </span>
                                    <span className="font-medium text-erp-text">
                                      {g.uomId || '—'}
                                    </span>
                                  </div>
                                </td>
                                <td className="text-right">
                                  <span className="purchase-planning-demand-table__qty tabular-nums">
                                    {g.totalRequiredQty}
                                  </span>
                                </td>
                                <td className="text-right">
                                  <span className="purchase-planning-demand-table__qty tabular-nums font-medium">
                                    {netQty}
                                  </span>
                                </td>
                                <td className="text-right">
                                  <span className="purchase-planning-demand-table__qty tabular-nums">
                                    {poQty}
                                  </span>
                                </td>
                                <td className="text-right">
                                  <span
                                    className={cn(
                                      'purchase-planning-demand-table__qty tabular-nums font-medium',
                                      remainingQty > 0 && 'text-erp-primary',
                                    )}
                                  >
                                    {remainingQty}
                                  </span>
                                </td>
                                <td className="text-right">
                                  <span className="purchase-planning-demand-table__pr-count tabular-nums">
                                    {g.prCount}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={cn(
                                      'tabular-nums',
                                      overdueEarliest && 'font-semibold text-red-700',
                                    )}
                                  >
                                    {g.earliestRequiredDate
                                      ? formatDate(g.earliestRequiredDate)
                                      : '—'}
                                  </span>
                                </td>
                                <td>
                                  {g.suggestedVendors.length ? (
                                    <div className="purchase-planning-demand-table__vendors">
                                      {g.suggestedVendors.slice(0, 2).map((v) => (
                                        <span
                                          key={v.id || v.name}
                                          className="purchase-planning-demand-table__vendor-chip"
                                        >
                                          {v.name}
                                        </span>
                                      ))}
                                      {g.suggestedVendors.length > 2 ? (
                                        <span className="text-[11px] text-erp-muted">
                                          +{g.suggestedVendors.length - 2}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <span className="text-erp-muted">—</span>
                                  )}
                                </td>
                                <td className="text-right">
                                  <ErpButton
                                    type="button"
                                    size="sm"
                                    variant="primary"
                                    icon={ShoppingCart}
                                    disabled={
                                      !perms.canCreatePoFromPlanning || allocateQty <= 0
                                    }
                                    onClick={() => setAllocateGroup(g)}
                                  >
                                    Allocate / Create PO
                                  </ErpButton>
                                </td>
                              </tr>
                              {open ? (
                                <tr className="purchase-planning-demand-table__detail">
                                  <td colSpan={11}>
                                    <div className="purchase-planning-demand-table__detail-inner">
                                      <div className="purchase-planning-demand-table__detail-head">
                                        Contributing PR lines
                                        <span className="text-erp-muted font-normal normal-case">
                                          {' '}
                                          · net {netQty} · remaining {remainingQty}
                                        </span>
                                      </div>
                                      <table className="purchase-planning-demand-table__nested">
                                        <thead>
                                          <tr>
                                            <th>PR</th>
                                            <th>Planning #</th>
                                            <th className="text-right">Req</th>
                                            <th className="text-right">Net</th>
                                            <th className="text-right">PO ordered</th>
                                            <th className="text-right">Remaining</th>
                                            <th className="text-right">Rate</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {g.members.map((m) => {
                                            const lineNet = m.netPurchaseQuantity || m.requiredQuantity
                                            const lineRemaining = Math.max(
                                              0,
                                              lineNet - (Number(m.orderedQuantity) || 0),
                                            )
                                            return (
                                            <tr key={m.planningRowId}>
                                              <td>
                                                <TableLink
                                                  to={`/purchase/requisitions/${m.purchaseRequisitionId}`}
                                                >
                                                  {m.purchaseRequisitionNumber}
                                                </TableLink>
                                              </td>
                                              <td className="font-mono text-[12px]">
                                                {m.planningNumber || '—'}
                                              </td>
                                              <td className="text-right tabular-nums">
                                                {m.requiredQuantity}
                                              </td>
                                              <td className="text-right tabular-nums">
                                                {lineNet}
                                              </td>
                                              <td className="text-right tabular-nums">
                                                {m.orderedQuantity}
                                              </td>
                                              <td className="text-right tabular-nums">
                                                {m.remainingQuantity > 0
                                                  ? m.remainingQuantity
                                                  : lineRemaining}
                                              </td>
                                              <td className="text-right tabular-nums">
                                                {m.expectedRate != null && m.expectedRate > 0
                                                  ? formatCurrency(m.expectedRate)
                                                  : '—'}
                                              </td>
                                            </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </EnterpriseRegisterTableShell>
            ) : (
              <EnterpriseRegisterTableShell className="min-w-0 purchase-planning-register__grid">
                <ErpDataGrid
                  data={filtered}
                  columns={columns}
                  getRowId={(r) => r.id}
                  showCompactSearch={false}
                  enableColumnSorting={false}
                  sortResetToken={sortBy}
                  pinnedHeaderSort={prHeaderSort}
                  onDocumentHeaderSortChange={handleDocumentHeaderSort}
                  columnLayoutKey="purchase-planning-document-lines"
                  stickyFirstColumn
                  selectable
                  getRowCanSelect={(r) => !isSelectionDisabled(r)}
                  rowSelection={rowSelection}
                  onRowSelectionChange={(updater) => {
                    setRowSelection((prev) => {
                      const next = typeof updater === 'function' ? updater(prev) : updater
                      const cleaned: RowSelectionState = {}
                      for (const [id, on] of Object.entries(next)) {
                        if (!on) continue
                        const row = rows.find((r) => r.id === id) ?? filtered.find((r) => r.id === id)
                        if (!row || isSelectionDisabled(row)) continue
                        cleaned[id] = true
                      }
                      return cleaned
                    })
                  }}
                  pageSizeOptions={[25, 50, 100]}
                  showToolbarView
                  showToolbarExport={false}
                  emptyMessage={
                    rows.length === 0
                      ? 'No planning rows yet. Approved PRs with RFQ Required = No create one row per item automatically.'
                      : 'No pending planning rows match filters. Converted (PO Created) / completed / cancelled rows are hidden by default — use Status filter to view them.'
                  }
                  registerBar={
                    <CrmListFilterBar
                      search={String(filters.search ?? '')}
                      onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
                      searchPlaceholder="Search planning no, PR, item, vendor…"
                      activeFilterCount={filterDrawer.activeCount}
                      onOpenFilters={filterDrawer.openDrawer}
                      chips={filterDrawer.chips}
                      onRemoveChip={filterDrawer.removeChip}
                      onClearAll={() => {
                        setFilters(DEFAULT_FILTERS)
                        setSummaryFilterKey(null)
                      }}
                      className="crm-list-filter-bar--embedded"
                      showCommandPaletteHint={false}
                      sort={
                        <CrmListSortSelect
                          value={sortBy}
                          onChange={(v) => setSortBy(v as SortKey)}
                          aria-label="Sort planning sheet"
                          options={PLANNING_SORT_OPTIONS}
                        />
                      }
                    />
                  }
                />
              </EnterpriseRegisterTableShell>
            )}
          </div>
        )}
      </OperationalPageShell>

      <CrmFilterDrawer
        open={filterDrawer.open}
        title="Filter planning sheet"
        fields={filterFieldsResolved}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
        onClose={filterDrawer.closeDrawer}
      />

      <PurchasePlanningViewDrawer
        open={Boolean(viewRow)}
        row={viewRow}
        onClose={() => setViewRow(null)}
        onEdit={
          viewRow && !isSelectionDisabled(viewRow)
            ? () => {
                setEditRow(viewRow)
                setViewRow(null)
              }
            : undefined
        }
      />

      <PurchasePlanningEditDrawer
        open={Boolean(editRow)}
        row={editRow}
        vendors={vendors}
        saving={savingEdit}
        splitting={splittingEdit}
        onClose={() => setEditRow(null)}
        onSave={onSaveEdit}
        onSplit={onSplitEdit}
      />

      <PurchasePlanningCreatePoModal
        open={poModalOpen}
        rows={poModalRows}
        warehouses={warehouses}
        vendors={vendors}
        creating={creatingPo}
        onClose={() => {
          setPoModalOpen(false)
          setPoModalRows([])
        }}
        onConfirm={(form) => void confirmCreatePo(form)}
      />

      <PurchasePlanningAllocateModal
        open={Boolean(allocateGroup)}
        group={allocateGroup}
        vendors={vendors}
        busy={allocating}
        onClose={() => setAllocateGroup(null)}
        onConfirm={(alloc) => void onCreateFromConsolidation(alloc)}
      />

      <Modal
        open={bulkVendorOpen}
        onClose={() => setBulkVendorOpen(false)}
        title="Bulk Select Vendor"
        description={`${selectedRows.length} selected row(s)`}
        size="sm"
        footer={
          <ErpButtonGroup className="justify-end">
            <ErpButton type="button" variant="secondary" onClick={() => setBulkVendorOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              type="button"
              variant="primary"
              disabled={!bulkVendorId}
              onClick={() =>
                void (async () => {
                  try {
                    await bulkSelectPurchasePlanningVendor(
                      selectedRows.map((r) => r.id),
                      bulkVendorId,
                    )
                    notify.success(`Vendor selected on ${selectedRows.length} row(s)`)
                    setBulkVendorOpen(false)
                    setRowSelection({})
                    await load()
                  } catch (err) {
                    notify.error(
                      err instanceof PurchaseServiceError ? err.message : 'Bulk vendor failed',
                    )
                  }
                })()
              }
            >
              Select Vendor
            </ErpButton>
          </ErpButtonGroup>
        }
      >
        <Select value={bulkVendorId} onChange={(e) => setBulkVendorId(e.target.value)}>
          <option value="">— Select vendor —</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.vendorName}
            </option>
          ))}
        </Select>
      </Modal>

      <Modal
        open={bulkStatusOpen}
        onClose={() => setBulkStatusOpen(false)}
        title="Bulk Status Update"
        description={`${selectedRows.length} selected row(s)`}
        size="sm"
        footer={
          <ErpButtonGroup className="justify-end">
            <ErpButton type="button" variant="secondary" onClick={() => setBulkStatusOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              type="button"
              variant="primary"
              onClick={() =>
                void (async () => {
                  try {
                    const apiStatus =
                      bulkStatus === 'cancelled'
                        ? 'CANCELLED'
                        : bulkStatus === 'pending_review'
                          ? 'ON_HOLD'
                          : bulkStatus === 'approved'
                            ? 'APPROVED'
                            : bulkStatus === 'po_pending'
                              ? 'PO_PENDING'
                              : bulkStatus.toUpperCase()
                    await bulkUpdatePurchasePlanningStatus(
                      selectedRows.map((r) => r.id),
                      apiStatus,
                    )
                    notify.success(`Status updated on ${selectedRows.length} row(s)`)
                    setBulkStatusOpen(false)
                    setRowSelection({})
                    await load()
                  } catch (err) {
                    notify.error(
                      err instanceof PurchaseServiceError ? err.message : 'Bulk status failed',
                    )
                  }
                })()
              }
            >
              Update
            </ErpButton>
          </ErpButtonGroup>
        }
      >
        <Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
          <option value="po_pending">PO Pending</option>
          <option value="approved">Approved</option>
          <option value="pending_review">On Hold</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </Modal>
    </>
  )
}
