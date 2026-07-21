import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table'
import {
  Ban,
  ClipboardList,
  Download,
  Eye,
  PauseCircle,
  Pencil,
  RefreshCw,
  ShoppingCart,
  UserCheck,
  Users,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
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
import { PurchasePlanningViewDrawer } from '@/components/purchase/PurchasePlanningViewDrawer'
import { PurchasePlanningEditDrawer } from '@/components/purchase/PurchasePlanningEditDrawer'
import {
  PurchasePlanningCreatePoModal,
  type CreatePoModalForm,
} from '@/components/purchase/PurchasePlanningCreatePoModal'
import {
  bulkAssignPurchasePlanningBuyer,
  bulkSelectPurchasePlanningVendor,
  bulkUpdatePurchasePlanningStatus,
  canSelectPlanningRowForPo,
  cancelPurchasePlanningRow,
  createPurchaseOrdersFromPlanningSelection,
  getPurchaseOrderSeriesOptions,
  getPurchasePlanningSheet,
  getPurchaseWarehouses,
  getVendors,
  holdPurchasePlanningRow,
  recalculatePurchasePlanningRows,
  updatePurchasePlanningSheetRow,
  PurchaseServiceError,
  PURCHASE_PLANNING_PRIORITY_LABELS,
  PURCHASE_PLANNING_PURCHASE_TYPE_LABELS,
  PURCHASE_PLANNING_STATUS_LABELS,
  PURCHASE_PLANNING_PRIORITIES,
  PURCHASE_PLANNING_PURCHASE_TYPES,
  PURCHASE_PLANNING_STATUSES,
  type PurchasePlanningSheetInput,
  type PurchaseOrderSeriesOption,
} from '@/services/purchase'
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

type SortKey = 'planningDate' | 'requiredByDate' | 'priority' | 'status' | 'planningNumber'

const DEFAULT_FILTERS: CrmFilterValues = {
  search: '',
  planningNumber: '',
  prNumber: '',
  item: '',
  department: '',
  vendor: '',
  buyer: '',
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

/** Human-readable gaps preventing Create PO for one row (mirrors canSelectPlanningRowForPo). */
function planningRowPoGaps(row: PurchasePlanningSheetRow): string[] {
  const gaps: string[] = []
  if (!['vendor_selected', 'approved', 'po_pending'].includes(row.status)) {
    gaps.push(
      `status is ${PURCHASE_PLANNING_STATUS_LABELS[row.status] ?? row.status} (needs Vendor Selected / Approved / PO Pending)`,
    )
  }
  if (!row.actionMessage) gaps.push('Action Message off')
  if (!row.preferredVendorId) gaps.push('no vendor')
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
        r.buyerName,
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
    if (f.buyer && r.buyerName !== f.buyer) return false
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

export function PurchasePlanningSheetPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = usePurchasePermissions()
  const [rows, setRows] = useState<PurchasePlanningSheetRow[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([])
  const [buyers, setBuyers] = useState<Array<{ id: string; name: string }>>([])
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
  const [bulkBuyerOpen, setBulkBuyerOpen] = useState(false)
  const [bulkVendorOpen, setBulkVendorOpen] = useState(false)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkBuyerId, setBulkBuyerId] = useState('')
  const [bulkVendorId, setBulkVendorId] = useState('')
  const [bulkStatus, setBulkStatus] = useState('po_pending')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sheet, v, wh] = await Promise.all([
        getPurchasePlanningSheet(),
        getVendors(),
        getPurchaseWarehouses(),
      ])
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
      setWarehouses(wh.map((w) => ({ id: w.id, name: w.name })))
      const buyerMap = new Map<string, string>()
      for (const row of enriched) {
        if (row.buyerId && row.buyerName) buyerMap.set(row.buyerId, row.buyerName)
      }
      const nextBuyers = [...buyerMap.entries()].map(([id, name]) => ({ id, name }))
      setBuyers(nextBuyers)
      setBulkBuyerId((prev) => (prev && nextBuyers.some((b) => b.id === prev) ? prev : nextBuyers[0]?.id ?? ''))
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
  const buyerOptions = useMemo(
    () => [...new Set(rows.map((r) => r.buyerName).filter(Boolean))].sort(),
    [rows],
  )

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
        key: 'buyer',
        label: 'Buyer',
        type: 'select',
        options: buyerOptions.map((b) => ({ value: b, label: b })),
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
    [departmentOptions, vendorOptions, buyerOptions],
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
          'All selected rows need Action Message, vendor, quantity, rate, and a ready status before Create PO',
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

  const confirmCreatePo = async (_form: CreatePoModalForm) => {
    const series = seriesOptions[0]
    if (!series) {
      notify.error('Purchase Order number series is not configured in Setup')
      return
    }
    setCreatingPo(true)
    try {
      const orders = await createPurchaseOrdersFromPlanningSelection(
        poModalRows.map((r) => r.id),
        { seriesPrefix: series.prefix },
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
        id: 'assign-buyer',
        label: 'Assign Buyer',
        icon: UserCheck,
        onClick: () => {
          setRowSelection({ [row.id]: true })
          setBulkBuyerOpen(true)
        },
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
        id: 'prNumber',
        header: 'PR Number',
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
          <span className="tabular-nums">{row.original.requiredQuantity}</span>
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
        id: 'netPurchaseQuantity',
        accessorKey: 'netPurchaseQuantity',
        header: 'Net Purchase Quantity',
        meta: { columnLabel: 'Net Purchase Quantity', align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">{row.original.netPurchaseQuantity}</span>
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
        description="Plan approved direct-purchase requirements, assign vendors and buyers, and create Purchase Orders."
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
                ? 'Missing purchase.planning.create_po permission'
                : selectedRows.length === 0
                  ? 'Select rows first'
                  : createPoDisabledReason(selectedRows),
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
                id: 'bulk-buyer',
                label: 'Assign Buyer',
                icon: UserCheck,
                onClick: () => setBulkBuyerOpen(true),
                disabled: selectedRows.length === 0 || !canEdit,
              },
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
          <div className="min-w-0 space-y-3">
            <EnterpriseRegisterTableShell className="min-w-0">
              <ErpDataGrid
                data={filtered}
                columns={columns}
                getRowId={(r) => r.id}
                showCompactSearch={false}
                enableColumnSorting
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
                    }}
                    className="crm-list-filter-bar--embedded"
                    showCommandPaletteHint={false}
                    sort={
                      <CrmListSortSelect
                        value={sortBy}
                        onChange={(v) => setSortBy(v as SortKey)}
                        aria-label="Sort planning sheet"
                        options={[
                          { value: 'planningDate', label: 'Planning date' },
                          { value: 'requiredByDate', label: 'Required by' },
                          { value: 'priority', label: 'Priority' },
                          { value: 'status', label: 'Status' },
                          { value: 'planningNumber', label: 'Planning no.' },
                        ]}
                      />
                    }
                  />
                }
              />
            </EnterpriseRegisterTableShell>
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
        buyers={buyers}
        saving={savingEdit}
        onClose={() => setEditRow(null)}
        onSave={onSaveEdit}
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

      <Modal
        open={bulkBuyerOpen}
        onClose={() => setBulkBuyerOpen(false)}
        title="Bulk Assign Buyer"
        description={`${selectedRows.length} selected row(s)`}
        size="sm"
        footer={
          <ErpButtonGroup className="justify-end">
            <ErpButton type="button" variant="secondary" onClick={() => setBulkBuyerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              type="button"
              variant="primary"
              disabled={!bulkBuyerId}
              onClick={() =>
                void (async () => {
                  const buyer = buyers.find((b) => b.id === bulkBuyerId)
                  if (!buyer) return
                  try {
                    await bulkAssignPurchasePlanningBuyer(
                      selectedRows.map((r) => r.id),
                      buyer.id,
                      buyer.name,
                    )
                    notify.success(`Buyer assigned to ${selectedRows.length} row(s)`)
                    setBulkBuyerOpen(false)
                    setRowSelection({})
                    await load()
                  } catch (err) {
                    notify.error(
                      err instanceof PurchaseServiceError ? err.message : 'Bulk assign failed',
                    )
                  }
                })()
              }
            >
              Assign
            </ErpButton>
          </ErpButtonGroup>
        }
      >
        <Select value={bulkBuyerId} onChange={(e) => setBulkBuyerId(e.target.value)}>
          {buyers.length === 0 ? (
            <option value="">No buyers on sheet yet</option>
          ) : (
            buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))
          )}
        </Select>
      </Modal>

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
