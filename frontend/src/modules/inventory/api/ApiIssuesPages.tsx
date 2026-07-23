/**
 * Live inventory issues (API mode).
 * Backend has no draft multi-line issue documents — general issues are posted as
 * stock movements (`POST /inventory/movements/issue`). Work-order issues load the
 * WO material requirements and post via manufacturing materials issue (partial or
 * full, multi-line). Issues are listed from the stock ledger (`movementType=ISSUE`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table'
import { ArrowUpFromLine, Lock, PackageMinus, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { DataGrid } from '@/components/design-system/DataGrid'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { CrmListFilterBar, CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { notify } from '@/store/toastStore'
import { fetchLookup } from '@/services/api/masterApi'
import {
  getWorkOrderMaterialsReadiness,
  issueWorkOrderMaterial,
  listWorkOrderMaterials,
  listWorkOrders,
  createWorkOrderShortageRequisition,
  getStoreWorkbenchIssues,
  reserveWorkOrderMaterials,
} from '@/services/api/manufacturingApi'
import { listPurchaseRequisitionsApi } from '@/services/purchase/purchaseRequisitionApi'
import type { ApiPurchaseRequisition } from '@/services/purchase/purchaseApiTypes'
import {
  getInventoryLedgerMovement,
  getInventoryPosition,
  listInventoryLedger,
  postIssueStock,
  type InventoryStockBalance,
  type InventoryStockMovement,
} from '@/services/api/inventoryApi'
import type { ProductionOrderMaterial } from '@/types/manufacturingProduction'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { canManufacturingPermission } from '@/utils/permissions/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

interface LookupOption {
  id: string
  label: string
}

function useLookupOptions(resource: 'items' | 'warehouses'): LookupOption[] {
  const [options, setOptions] = useState<LookupOption[]>([])
  useEffect(() => {
    let cancelled = false
    fetchLookup(resource)
      .then((res) => {
        if (cancelled) return
        setOptions(
          res.data.map((row) => ({ id: row.id, label: row.code ? `${row.code} — ${row.name}` : row.name })),
        )
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [resource])
  return options
}

function useWorkOrderOptions(): LookupOption[] {
  const [options, setOptions] = useState<LookupOption[]>([])
  useEffect(() => {
    let cancelled = false
    listWorkOrders({ page: 1, limit: 100 })
      .then((res) => {
        if (cancelled) return
        setOptions(
          (res.data ?? []).map((wo) => ({
            id: wo.id,
            label: `${wo.orderNumber ?? wo.workOrderNo ?? wo.id.slice(0, 8)}${wo.productItemCode ? ` — ${wo.productItemCode}` : ''}`,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [])
  return options
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function fmtQty(v: string | number | null | undefined): string {
  return num(v).toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

function refLabel(ref: { code: string; name: string } | undefined, id: string): string {
  return ref ? `${ref.code} — ${ref.name}` : id.slice(0, 8)
}

function AccessDenied({ title }: { title: string }) {
  return (
    <div className="erp-page">
      <PageHeader title={title} breadcrumbs={[{ label: 'Inventory', to: '/inventory/stock' }]} />
      <EmptyState icon={Lock} title="Access denied" description="You do not hold the required inventory permission." />
    </div>
  )
}

interface PageMeta {
  page: number
  totalPages: number
  total: number
}

function Pager({ meta, onPage }: { meta: PageMeta | null; onPage: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 px-3 py-2 text-[12px] text-erp-muted">
      <span>
        Page {meta.page} of {meta.totalPages} · {meta.total} rows
      </span>
      <Button size="sm" variant="ghost" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        Prev
      </Button>
      <Button size="sm" variant="ghost" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
        Next
      </Button>
    </div>
  )
}

type IssuesTab = 'assign' | 'prs' | 'posted'

type AssignQueueRow = {
  workOrderId: string
  orderNumber: string
  materialId: string
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string | null
  warehouseLabel: string
  requiredQty: number
  reservedQty: number
  issuedQty: number
  balanceToIssue: number
  freeQty: number | null
  issuableQty: number
  shortageQty: number
  hasShortage: boolean
  purchaseRequisitionId: string | null
  purchaseRequisitionNumber: string | null
  purchaseRequisitionStatus: string | null
  status: string
}

const ASSIGN_VIEW_OPTIONS = [
  { id: 'all' as const, label: 'All lines' },
  { id: 'available' as const, label: 'Available to assign' },
  { id: 'shortage' as const, label: 'Shortage' },
  { id: 'pr_raised' as const, label: 'PR raised' },
]

function parseAssignRows(raw: Record<string, unknown>[]): AssignQueueRow[] {
  return raw.map((row) => {
    const item = row.item as { code?: string; name?: string } | undefined
    const warehouse = row.warehouse as { code?: string; name?: string } | null | undefined
    const pr = row.purchaseRequisition as { id?: string; requisitionNumber?: string; status?: string } | null | undefined
    return {
      workOrderId: String(row.workOrderId ?? ''),
      orderNumber: String(row.orderNumber ?? ''),
      materialId: String(row.materialId ?? ''),
      itemId: String(row.itemId ?? ''),
      itemCode: item?.code ?? '',
      itemName: item?.name ?? '',
      warehouseId: (row.warehouseId as string | null) ?? null,
      warehouseLabel: warehouse ? `${warehouse.code} — ${warehouse.name}` : '—',
      requiredQty: num(row.requiredQty as string | number),
      reservedQty: num(row.reservedQty as string | number),
      issuedQty: num(row.issuedQty as string | number),
      balanceToIssue: num(row.balanceToIssue as string | number),
      freeQty: row.freeQty == null ? null : num(row.freeQty as string | number),
      issuableQty: num(row.issuableQty as string | number),
      shortageQty: num(row.shortageQty as string | number),
      hasShortage: Boolean(row.hasShortage),
      purchaseRequisitionId: (row.purchaseRequisitionId as string | null) ?? pr?.id ?? null,
      purchaseRequisitionNumber: pr?.requisitionNumber ?? null,
      purchaseRequisitionStatus: pr?.status ?? null,
      status: String(row.status ?? ''),
    }
  })
}

/** Posted ISSUE movements register + production assign / shortage PR queues. */
export function ApiIssuesRegisterPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const initialTab = (searchParams.get('tab') as IssuesTab | null) ?? 'assign'
  const [tab, setTab] = useState<IssuesTab>(
    initialTab === 'prs' || initialTab === 'posted' || initialTab === 'assign' ? initialTab : 'assign',
  )

  const [itemId, setItemId] = useState(searchParams.get('itemId') ?? '')
  const [warehouseId, setWarehouseId] = useState(searchParams.get('warehouseId') ?? '')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<InventoryStockMovement[]>([])
  const [meta, setMeta] = useState<PageMeta | null>(null)
  const [loading, setLoading] = useState(true)

  const [assignRows, setAssignRows] = useState<AssignQueueRow[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignView, setAssignView] = useState<'all' | 'available' | 'shortage' | 'pr_raised'>('all')
  const [assignSort, setAssignSort] = useState('wo_asc')
  const [assignWarehouseFilter, setAssignWarehouseFilter] = useState('')
  const [assignStockFilter, setAssignStockFilter] = useState<'all' | 'available' | 'shortage' | 'no_stock'>('all')
  const [assignFiltersOpen, setAssignFiltersOpen] = useState(false)
  const [assignPageSize, setAssignPageSize] = useState(25)

  const [prRows, setPrRows] = useState<ApiPurchaseRequisition[]>([])
  const [prLoading, setPrLoading] = useState(false)

  const canCreateShortagePr = canManufacturingPermission('manufacturing.materials.create_requirement')
  const canIssueMaterials = canManufacturingPermission('manufacturing.materials.issue')
  const canReserveMaterials = canManufacturingPermission('manufacturing.materials.reserve')

  const switchTab = (next: IssuesTab) => {
    setTab(next)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', next)
    setSearchParams(nextParams, { replace: true })
  }

  const loadPosted = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listInventoryLedger({
        page,
        limit: 50,
        movementType: 'ISSUE',
        itemId: itemId || undefined,
        warehouseId: warehouseId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      })
      setRows(res.data ?? [])
      const m = res.meta as PageMeta | undefined
      setMeta(m ? { page: m.page, totalPages: m.totalPages, total: m.total } : null)
    } catch {
      notify.error('Could not load issues')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, itemId, warehouseId, fromDate, toDate])

  const loadAssignQueue = useCallback(async () => {
    setAssignLoading(true)
    try {
      const res = await getStoreWorkbenchIssues(100)
      const parsed = parseAssignRows((res.data?.rows ?? []) as Record<string, unknown>[])
      setAssignRows(parsed)
      setSelected(new Set(parsed.filter((r) => r.issuableQty > 0 && !r.purchaseRequisitionId).map((r) => r.materialId)))
    } catch (e) {
      setAssignRows([])
      notify.error(e instanceof Error ? e.message : 'Could not load production issue queue')
    } finally {
      setAssignLoading(false)
    }
  }, [])

  const loadProductionPrs = useCallback(async () => {
    setPrLoading(true)
    try {
      const res = await listPurchaseRequisitionsApi({
        page: 1,
        limit: 50,
        search: 'Production shortage',
        sortOrder: 'desc',
      })
      const list = Array.isArray(res.data) ? res.data : ((res.data as { items?: ApiPurchaseRequisition[] } | undefined)?.items ?? [])
      setPrRows(list)
    } catch {
      try {
        const res = await listPurchaseRequisitionsApi({ page: 1, limit: 50, sortOrder: 'desc' })
        const list = Array.isArray(res.data) ? res.data : ((res.data as { items?: ApiPurchaseRequisition[] } | undefined)?.items ?? [])
        setPrRows(
          list.filter(
            (pr) =>
              (pr.purchasePurpose ?? '').toLowerCase().includes('production shortage') ||
              (pr.remarks ?? '').includes('productionOrderId:'),
          ),
        )
      } catch (e) {
        setPrRows([])
        notify.error(e instanceof Error ? e.message : 'Could not load production requisitions')
      }
    } finally {
      setPrLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'posted') void loadPosted()
    if (tab === 'assign') void loadAssignQueue()
    if (tab === 'prs') void loadProductionPrs()
  }, [tab, loadPosted, loadAssignQueue, loadProductionPrs])

  const assignWarehouseOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of assignRows) {
      if (row.warehouseId) map.set(row.warehouseId, row.warehouseLabel)
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }))
  }, [assignRows])

  const filteredAssignRows = useMemo(() => {
    const q = assignSearch.trim().toLowerCase()
    let rows = assignRows.filter((row) => {
      if (assignView === 'available' && row.issuableQty <= 0) return false
      if (assignView === 'shortage' && !(row.hasShortage || row.shortageQty > 0 || (row.freeQty != null && row.freeQty < row.balanceToIssue))) {
        return false
      }
      if (assignView === 'pr_raised' && !row.purchaseRequisitionId) return false
      if (assignWarehouseFilter && row.warehouseId !== assignWarehouseFilter) return false
      if (assignStockFilter === 'available' && row.issuableQty <= 0) return false
      if (assignStockFilter === 'shortage' && !(row.hasShortage || row.shortageQty > 0)) return false
      if (assignStockFilter === 'no_stock' && !(row.freeQty != null && row.freeQty <= 0)) return false
      if (!q) return true
      return (
        row.orderNumber.toLowerCase().includes(q) ||
        row.itemCode.toLowerCase().includes(q) ||
        row.itemName.toLowerCase().includes(q) ||
        row.warehouseLabel.toLowerCase().includes(q) ||
        (row.purchaseRequisitionNumber ?? '').toLowerCase().includes(q)
      )
    })

    const sorted = [...rows]
    sorted.sort((a, b) => {
      switch (assignSort) {
        case 'wo_desc':
          return b.orderNumber.localeCompare(a.orderNumber)
        case 'item_asc':
          return a.itemCode.localeCompare(b.itemCode)
        case 'balance_desc':
          return b.balanceToIssue - a.balanceToIssue
        case 'available_asc':
          return (a.freeQty ?? -1) - (b.freeQty ?? -1)
        case 'shortage_desc':
          return b.shortageQty - a.shortageQty
        case 'wo_asc':
        default:
          return a.orderNumber.localeCompare(b.orderNumber)
      }
    })
    return sorted
  }, [
    assignRows,
    assignSearch,
    assignView,
    assignWarehouseFilter,
    assignStockFilter,
    assignSort,
  ])

  const selectedRows = filteredAssignRows.filter((r) => selected.has(r.materialId))
  const selectedIssuable = selectedRows.filter((r) => r.issuableQty > 0)
  const selectedShortNeedingPr = selectedRows.filter(
    (r) =>
      !r.purchaseRequisitionId &&
      (r.hasShortage || r.shortageQty > 0 || (r.freeQty != null && r.freeQty < r.balanceToIssue)),
  )

  const assignFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string }> = []
    if (assignWarehouseFilter) {
      const label = assignWarehouseOptions.find((w) => w.id === assignWarehouseFilter)?.label ?? 'Warehouse'
      chips.push({ id: 'warehouse', label: `Warehouse: ${label}` })
    }
    if (assignStockFilter !== 'all') {
      chips.push({
        id: 'stock',
        label:
          assignStockFilter === 'available'
            ? 'Stock: Available'
            : assignStockFilter === 'no_stock'
              ? 'Stock: No stock'
              : 'Stock: Shortage',
      })
    }
    return chips
  }, [assignWarehouseFilter, assignStockFilter, assignWarehouseOptions])

  const assignViewLabel =
    ASSIGN_VIEW_OPTIONS.find((v) => v.id === assignView)?.label ?? 'All lines'

  const parseAssignView = (labelOrId: string): typeof assignView => {
    const byId = ASSIGN_VIEW_OPTIONS.find((v) => v.id === labelOrId || v.label === labelOrId)
    return byId?.id ?? 'all'
  }

  const assignActiveFilterCount =
    (assignWarehouseFilter ? 1 : 0) + (assignStockFilter !== 'all' ? 1 : 0)

  const rowSelection = useMemo(() => {
    const next: RowSelectionState = {}
    for (const id of selected) next[id] = true
    return next
  }, [selected])

  const assignSelected = useCallback(async () => {
    if (selectedIssuable.length === 0) {
      notify.error('Select lines with available stock to assign')
      return
    }
    setBusy(true)
    let ok = 0
    const errors: string[] = []
    try {
      for (const row of selectedIssuable) {
        try {
          if (canReserveMaterials && row.reservedQty < row.requiredQty) {
            await reserveWorkOrderMaterials(row.workOrderId, { materialIds: [row.materialId] }).catch(() => undefined)
          }
          await issueWorkOrderMaterial(row.workOrderId, {
            materialId: row.materialId,
            quantity: row.issuableQty,
            warehouseId: row.warehouseId ?? undefined,
            idempotencyKey: `issues-assign:${row.materialId}:${row.issuableQty}:${crypto.randomUUID()}`,
          })
          ok += 1
        } catch (e) {
          errors.push(`${row.itemCode}: ${e instanceof Error ? e.message : 'failed'}`)
        }
      }
      if (ok > 0) notify.success(`Assigned ${ok} material line(s) to production`)
      if (errors.length > 0) notify.error(errors.slice(0, 3).join(' · ') + (errors.length > 3 ? '…' : ''))
      await loadAssignQueue()
      if (ok > 0) void loadPosted()
    } finally {
      setBusy(false)
    }
  }, [canReserveMaterials, loadAssignQueue, loadPosted, selectedIssuable])

  const createPrForRows = useCallback(
    async (rowsToPr: AssignQueueRow[]) => {
      const eligible = rowsToPr.filter(
        (r) =>
          !r.purchaseRequisitionId &&
          (r.hasShortage || r.shortageQty > 0 || (r.freeQty != null && r.freeQty < r.balanceToIssue)),
      )
      if (eligible.length === 0) {
        notify.error('Select short / out-of-stock lines without an existing PR')
        return
      }
      setBusy(true)
      let ok = 0
      const errors: string[] = []
      try {
        const byWo = new Map<string, AssignQueueRow[]>()
        for (const row of eligible) {
          const list = byWo.get(row.workOrderId) ?? []
          list.push(row)
          byWo.set(row.workOrderId, list)
        }
        for (const [workOrderId, group] of byWo) {
          try {
            const res = await createWorkOrderShortageRequisition(workOrderId, {
              materialIds: group.map((g) => g.materialId),
              idempotencyKey: `issues-queue-pr:${workOrderId}:${group.map((g) => g.materialId).join(',')}:${crypto.randomUUID()}`,
              submit: false,
            })
            const pr = res.data.requisition
            const prNo = pr.prNumber ?? pr.requisitionNumber ?? pr.id.slice(0, 8)
            notify.success(`PR ${prNo} created for ${group[0]?.orderNumber ?? 'WO'} (${group.length} line(s))`)
            ok += 1
          } catch (e) {
            errors.push(`${group[0]?.orderNumber ?? workOrderId}: ${e instanceof Error ? e.message : 'failed'}`)
          }
        }
        if (errors.length > 0) notify.error(errors.slice(0, 3).join(' · ') + (errors.length > 3 ? '…' : ''))
        await loadAssignQueue()
        if (ok > 0) {
          setTab('prs')
          const nextParams = new URLSearchParams(searchParams)
          nextParams.set('tab', 'prs')
          setSearchParams(nextParams, { replace: true })
          void loadProductionPrs()
        }
      } finally {
        setBusy(false)
      }
    },
    [loadAssignQueue, loadProductionPrs, searchParams, setSearchParams],
  )

  const assignOne = useCallback(
    async (r: AssignQueueRow) => {
      setBusy(true)
      try {
        await issueWorkOrderMaterial(r.workOrderId, {
          materialId: r.materialId,
          quantity: r.issuableQty,
          warehouseId: r.warehouseId ?? undefined,
          idempotencyKey: `issues-assign-one:${r.materialId}:${crypto.randomUUID()}`,
        })
        notify.success(`Assigned ${fmtQty(r.issuableQty)} of ${r.itemCode}`)
        await loadAssignQueue()
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Assign failed')
      } finally {
        setBusy(false)
      }
    },
    [loadAssignQueue],
  )

  const assignColumns = useMemo<ColumnDef<AssignQueueRow, unknown>[]>(() => {
    return [
      {
        id: 'workOrder',
        header: 'Work order',
        accessorKey: 'orderNumber',
        size: 120,
        cell: ({ row }) => (
          <Link
            to={`/manufacturing/work-orders/${row.original.workOrderId}`}
            className="font-mono text-[12px] font-semibold text-erp-primary hover:underline"
          >
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        id: 'item',
        header: 'Item',
        accessorFn: (r) => `${r.itemCode} ${r.itemName}`,
        size: 220,
        cell: ({ row }) => (
          <div className="min-w-[11rem]">
            <p className="font-medium text-erp-text">{row.original.itemCode}</p>
            <p className="truncate text-[11px] text-erp-muted" title={row.original.itemName}>
              {row.original.itemName}
            </p>
          </div>
        ),
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        accessorKey: 'warehouseLabel',
        size: 140,
        cell: ({ row }) => <span className="text-[12px] text-erp-text">{row.original.warehouseLabel}</span>,
      },
      {
        id: 'required',
        header: 'Required',
        accessorKey: 'requiredQty',
        size: 88,
        meta: { align: 'right' },
        cell: ({ row }) => <span className="tabular-nums">{fmtQty(row.original.requiredQty)}</span>,
      },
      {
        id: 'issued',
        header: 'Issued',
        accessorKey: 'issuedQty',
        size: 80,
        meta: { align: 'right' },
        cell: ({ row }) => <span className="tabular-nums">{fmtQty(row.original.issuedQty)}</span>,
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorKey: 'balanceToIssue',
        size: 88,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold">{fmtQty(row.original.balanceToIssue)}</span>
        ),
      },
      {
        id: 'available',
        header: 'Available',
        accessorKey: 'freeQty',
        size: 88,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const free = row.original.freeQty
          const noStock = free != null && free <= 0
          return (
            <span className={cn('tabular-nums font-semibold', noStock ? 'text-rose-700' : 'text-erp-text')}>
              {free == null ? '—' : fmtQty(free)}
            </span>
          )
        },
      },
      {
        id: 'canAssign',
        header: 'Can assign',
        accessorKey: 'issuableQty',
        size: 96,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold text-emerald-700">{fmtQty(row.original.issuableQty)}</span>
        ),
      },
      {
        id: 'shortage',
        header: 'Shortage',
        accessorKey: 'shortageQty',
        size: 88,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="tabular-nums text-amber-900">
            {row.original.shortageQty > 0 ? fmtQty(row.original.shortageQty) : '—'}
          </span>
        ),
      },
      {
        id: 'stock',
        header: 'Stock',
        size: 100,
        cell: ({ row }) => {
          const free = row.original.freeQty
          const noStock = free != null && free <= 0
          const short =
            row.original.hasShortage ||
            row.original.shortageQty > 0 ||
            (free != null && free < row.original.balanceToIssue)
          if (noStock || short) {
            return (
              <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200">
                {noStock ? 'No stock' : 'Shortage'}
              </span>
            )
          }
          return (
            <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
              Available
            </span>
          )
        },
      },
      {
        id: 'pr',
        header: 'PR ref',
        size: 130,
        cell: ({ row }) =>
          row.original.purchaseRequisitionId ? (
            <div className="min-w-[7rem]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">PR generated</p>
              <Link
                to={`/purchase/requisitions/${row.original.purchaseRequisitionId}`}
                className="font-mono text-[12px] font-semibold text-erp-primary hover:underline"
              >
                {row.original.purchaseRequisitionNumber ?? row.original.purchaseRequisitionId.slice(0, 8)}
              </Link>
            </div>
          ) : (
            <span className="text-erp-muted">—</span>
          ),
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 200,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original
          const needsPr =
            !r.purchaseRequisitionId &&
            (r.hasShortage || r.shortageQty > 0 || (r.freeQty != null && r.freeQty < r.balanceToIssue))
          return (
            <div className="flex flex-wrap justify-end gap-1">
              {r.issuableQty > 0 && (canIssueMaterials || perms.canPostIssue) ? (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void assignOne(r)}>
                  Assign
                </Button>
              ) : null}
              {needsPr && canCreateShortagePr ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void createPrForRows([r])}>
                  Create PR
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/inventory/movements/issues/new?workOrderId=${r.workOrderId}`)}
              >
                Open
              </Button>
            </div>
          )
        },
      },
    ]
  }, [
    assignOne,
    busy,
    canCreateShortagePr,
    canIssueMaterials,
    createPrForRows,
    navigate,
    perms.canPostIssue,
  ])

  if (!perms.canViewIssues && !perms.canViewStock && !perms.canViewItemLedger) {
    return <AccessDenied title="Issues" />
  }

  const resetPageAnd = <T,>(setter: (v: T) => void) => (v: T) => {
    setPage(1)
    setter(v)
  }

  const refreshCurrent = () => {
    if (tab === 'assign') void loadAssignQueue()
    else if (tab === 'prs') void loadProductionPrs()
    else void loadPosted()
  }

  return (
    <div className="erp-page">
      <PageHeader
        title="Issues"
        description="Assign available stock to production, raise shortage PRs, and review posted issue movements."
        breadcrumbs={[{ label: 'Inventory', to: '/inventory/stock' }, { label: 'Issues' }]}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void refreshCurrent()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/manufacturing/work-orders')}>
              Open Work Orders
            </Button>
            {perms.canPostIssue || perms.canCreateIssue ? (
              <Button size="sm" onClick={() => navigate('/inventory/movements/issues/new')}>
                <PackageMinus className="h-4 w-4" /> New Issue
              </Button>
            ) : null}
          </div>
        )}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            { id: 'assign' as const, label: 'Assign to production' },
            { id: 'prs' as const, label: 'Production requisitions' },
            { id: 'posted' as const, label: 'Posted issues' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`erp-btn h-8 px-3 text-[12px] ${tab === t.id ? 'erp-btn-primary' : 'erp-btn-ghost'}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'assign' ? (
        <SectionCard
          title="Production material requests"
          actions={
            <div className="flex flex-wrap gap-2">
              {(canIssueMaterials || perms.canPostIssue) ? (
                <Button size="sm" disabled={busy || selectedIssuable.length === 0} onClick={() => void assignSelected()}>
                  {busy ? 'Assigning…' : `Assign available (${selectedIssuable.length})`}
                </Button>
              ) : null}
              {canCreateShortagePr ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || selectedShortNeedingPr.length === 0}
                  onClick={() => void createPrForRows(selectedShortNeedingPr)}
                >
                  Create PR for short ({selectedShortNeedingPr.length})
                </Button>
              ) : null}
            </div>
          }
        >
          <p className="mb-3 text-[12px] text-erp-muted">
            Open WO material lines waiting to be issued. Available stock can be assigned here; short lines can raise a
            purchase requisition (single or multi-select). When a PR already exists, the row shows the PR reference only.
          </p>
          {assignLoading ? (
            <LoadingState variant="table" />
          ) : assignRows.length === 0 ? (
            <EmptyState
              icon={PackageMinus}
              title="Nothing waiting to assign"
              description="When work orders need materials, they appear here with free stock and shortage status."
              action={
                <Button size="sm" onClick={() => navigate('/inventory/movements/issues/new')}>
                  Issue to work order
                </Button>
              }
            />
          ) : (
            <EnterpriseRegisterTableShell className="min-w-0">
              <DataGrid
                data={filteredAssignRows}
                columns={assignColumns}
                loading={assignLoading}
                stickyHeader
                stickyFirstColumn
                zebra
                compact
                selectable
                getRowId={(r) => r.materialId}
                rowSelection={rowSelection}
                onRowSelectionChange={(updater) => {
                  const next = typeof updater === 'function' ? updater(rowSelection) : updater
                  setSelected(new Set(Object.keys(next).filter((id) => next[id])))
                }}
                pageSize={assignPageSize}
                onPageSizeChange={setAssignPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                showPagination
                showCompactSearch={false}
                enableColumnSorting
                emptyMessage={
                  assignActiveFilterCount > 0 || assignSearch || assignView !== 'all'
                    ? 'No material lines match the current filters or view.'
                    : 'No open material lines to assign.'
                }
                emptyAction={
                  assignActiveFilterCount > 0 || assignSearch || assignView !== 'all' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setAssignSearch('')
                        setAssignView('all')
                        setAssignWarehouseFilter('')
                        setAssignStockFilter('all')
                        setAssignFiltersOpen(false)
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
                viewName={assignViewLabel}
                showToolbarView={false}
                registerBar={
                  <CrmListFilterBar
                    search={assignSearch}
                    onSearchChange={setAssignSearch}
                    searchPlaceholder="Search WO, item, warehouse, PR…"
                    activeFilterCount={assignActiveFilterCount}
                    onOpenFilters={() => setAssignFiltersOpen((o) => !o)}
                    filtersExpanded={assignFiltersOpen}
                    filtersButtonLabel={assignFiltersOpen ? 'Hide filters' : 'Filters'}
                    chips={assignFilterChips}
                    onRemoveChip={(id) => {
                      if (id === 'warehouse') setAssignWarehouseFilter('')
                      if (id === 'stock') setAssignStockFilter('all')
                    }}
                    onClearAll={() => {
                      setAssignWarehouseFilter('')
                      setAssignStockFilter('all')
                      setAssignSearch('')
                      setAssignView('all')
                    }}
                    savedView={assignViewLabel}
                    onSavedViewChange={(v) => setAssignView(parseAssignView(v))}
                    savedViews={ASSIGN_VIEW_OPTIONS.map((v) => v.label)}
                    className="crm-list-filter-bar--embedded"
                    showCommandPaletteHint={false}
                    sort={
                      <CrmListSortSelect
                        value={assignSort}
                        onChange={setAssignSort}
                        aria-label="Sort assign queue"
                        options={[
                          { value: 'wo_asc', label: 'Sort: Work order (A–Z)' },
                          { value: 'wo_desc', label: 'Sort: Work order (Z–A)' },
                          { value: 'item_asc', label: 'Sort: Item' },
                          { value: 'balance_desc', label: 'Sort: Balance' },
                          { value: 'available_asc', label: 'Sort: Available' },
                          { value: 'shortage_desc', label: 'Sort: Shortage' },
                        ]}
                      />
                    }
                    filterPanel={
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <FormField label="Warehouse">
                          <Select
                            value={assignWarehouseFilter}
                            onChange={(e) => setAssignWarehouseFilter(e.target.value)}
                          >
                            <option value="">All warehouses</option>
                            {assignWarehouseOptions.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.label}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        <FormField label="Stock status">
                          <Select
                            value={assignStockFilter}
                            onChange={(e) =>
                              setAssignStockFilter(e.target.value as typeof assignStockFilter)
                            }
                          >
                            <option value="all">All</option>
                            <option value="available">Available to assign</option>
                            <option value="shortage">Shortage</option>
                            <option value="no_stock">No stock</option>
                          </Select>
                        </FormField>
                      </div>
                    }
                    trailing={
                      <span className="text-[11px] text-erp-muted tabular-nums">
                        {filteredAssignRows.length} of {assignRows.length} line
                        {assignRows.length === 1 ? '' : 's'}
                        {selected.size > 0 ? ` · ${selected.size} selected` : ''}
                      </span>
                    }
                  />
                }
              />
            </EnterpriseRegisterTableShell>
          )}
        </SectionCard>
      ) : null}

      {tab === 'prs' ? (
        <SectionCard title="Requisitions requested by production">
          <p className="mb-3 text-[12px] text-erp-muted">
            Purchase requisitions raised from work-order material shortages (store / production).
          </p>
          {prLoading ? (
            <LoadingState variant="table" />
          ) : prRows.length === 0 ? (
            <EmptyState
              icon={PackageMinus}
              title="No production shortage PRs yet"
              description="When store raises a shortage PR from Assign to production, it will list here."
              action={
                <Button size="sm" variant="secondary" onClick={() => switchTab('assign')}>
                  Go to assign queue
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-erp-border">
              <table className="erp-table w-full text-[12px]">
                <thead>
                  <tr className="bg-slate-50/90">
                    <th>PR #</th>
                    <th>Date</th>
                    <th>Purpose</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th className="text-right">Lines</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prRows.map((pr) => (
                    <tr key={pr.id}>
                      <td>
                        <Link
                          to={`/purchase/requisitions/${pr.id}`}
                          className="font-mono font-semibold text-erp-primary hover:underline"
                        >
                          {pr.requisitionNumber}
                        </Link>
                      </td>
                      <td>{formatDate(pr.requisitionDate)}</td>
                      <td className="max-w-[20rem] truncate" title={pr.purchasePurpose ?? ''}>
                        {pr.purchasePurpose ?? '—'}
                      </td>
                      <td className="uppercase">{pr.priority}</td>
                      <td>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                          {pr.status}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{pr.lines?.length ?? '—'}</td>
                      <td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/purchase/requisitions/${pr.id}`)}>
                          Open PR
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ) : null}

      {tab === 'posted' ? (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="text-[11px] text-erp-muted">
              Item
              <Select wrapClassName="w-64" value={itemId} onChange={(e) => resetPageAnd(setItemId)(e.target.value)}>
                <option value="">All items</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.label}</option>
                ))}
              </Select>
            </label>
            <label className="text-[11px] text-erp-muted">
              Warehouse
              <Select wrapClassName="w-56" value={warehouseId} onChange={(e) => resetPageAnd(setWarehouseId)(e.target.value)}>
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </Select>
            </label>
            <label className="text-[11px] text-erp-muted">
              From
              <Input type="date" className="w-36" value={fromDate} onChange={(e) => resetPageAnd(setFromDate)(e.target.value)} />
            </label>
            <label className="text-[11px] text-erp-muted">
              To
              <Input type="date" className="w-36" value={toDate} onChange={(e) => resetPageAnd(setToDate)(e.target.value)} />
            </label>
          </div>

          <SectionCard title="Issue movements" noPadding>
            {loading ? (
              <div className="p-6"><LoadingState variant="table" rows={8} /></div>
            ) : rows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={ArrowUpFromLine}
                  title="No stock issued yet"
                  description="Assign materials from the Assign to production tab, or post a direct issue."
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => switchTab('assign')}>
                        Assign to production
                      </Button>
                      {perms.canPostIssue || perms.canCreateIssue ? (
                        <Button size="sm" onClick={() => navigate('/inventory/movements/issues/new')}>
                          <PackageMinus className="h-4 w-4" /> Direct Issue
                        </Button>
                      ) : null}
                    </div>
                  }
                />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="erp-table w-full min-w-[980px] text-[13px]">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Movement #</th>
                        <th>Reference</th>
                        <th>Item</th>
                        <th>Warehouse</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Value</th>
                        <th className="text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((m) => (
                        <tr key={m.id}>
                          <td>{formatDate(m.movementDate)}</td>
                          <td>
                            <Link
                              to={`/inventory/movements/issues/${m.id}`}
                              className="font-mono font-semibold text-erp-primary hover:underline"
                            >
                              {m.movementNumber}
                            </Link>
                          </td>
                          <td>
                            {m.referenceType}
                            {m.workOrderId ? (
                              <>
                                {' · '}
                                <Link
                                  to={`/manufacturing/work-orders/${m.workOrderId}`}
                                  className="text-erp-primary hover:underline"
                                >
                                  {m.referenceNo ?? m.workOrderId.slice(0, 8)}
                                </Link>
                              </>
                            ) : m.referenceNo ? (
                              <span className="text-erp-muted"> · {m.referenceNo}</span>
                            ) : null}
                          </td>
                          <td>{refLabel(m.item, m.itemId)}</td>
                          <td>{refLabel(m.warehouse, m.warehouseId)}</td>
                          <td className="text-right tabular-nums font-semibold text-rose-700">{fmtQty(m.quantity)}</td>
                          <td className="text-right tabular-nums">{fmtQty(m.value)}</td>
                          <td className="text-right tabular-nums">{fmtQty(m.balanceAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager meta={meta} onPage={setPage} />
              </>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  )
}

type IssueLineDraft = {
  materialId: string
  selected: boolean
  issueQty: string
  warehouseId: string
}

function remainingToIssue(m: ProductionOrderMaterial): number {
  return Math.max(0, num(m.requiredQty) - num(m.issuedQty) + num(m.returnedQty))
}

/** Qty that can be issued now from free stock (capped by remaining requirement). */
function issuableNow(m: ProductionOrderMaterial): number {
  const remaining = remainingToIssue(m)
  if (remaining <= 0) return 0
  if (m.freeQty == null) return remaining
  return Math.min(remaining, Math.max(0, num(m.freeQty)))
}

function isShortOnStock(m: ProductionOrderMaterial): boolean {
  const remaining = remainingToIssue(m)
  if (remaining <= 0) return false
  if (m.hasShortage) return true
  if (num(m.shortageQty) > 0) return true
  if (m.freeQty == null) return false
  return num(m.freeQty) < remaining
}

function buildIssueDrafts(materials: ProductionOrderMaterial[]): IssueLineDraft[] {
  return materials.map((m) => {
    const canIssue = issuableNow(m)
    return {
      materialId: m.id,
      selected: canIssue > 0,
      issueQty: canIssue > 0 ? String(canIssue) : '',
      warehouseId: m.warehouseId ?? '',
    }
  })
}

/** Immediate issue post — general or multi-line issue to work order. */
export function ApiIssuePostPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useInventoryPermissions()
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const workOrders = useWorkOrderOptions()
  const today = new Date().toISOString().slice(0, 10)
  const initialWo = searchParams.get('workOrderId') ?? ''
  const [mode, setMode] = useState<'general' | 'work_order'>('work_order')
  const [form, setForm] = useState({
    workOrderId: initialWo,
    itemId: '',
    warehouseId: '',
    quantity: '',
    movementDate: today,
    referenceNo: '',
    remarks: '',
  })
  const [position, setPosition] = useState<InventoryStockBalance | null>(null)
  const [busy, setBusy] = useState(false)
  const [materials, setMaterials] = useState<ProductionOrderMaterial[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [drafts, setDrafts] = useState<IssueLineDraft[]>([])

  const refreshPosition = useCallback(async (itemId: string, warehouseId: string) => {
    if (!itemId || !warehouseId) {
      setPosition(null)
      return
    }
    try {
      const res = await getInventoryPosition({ itemId, warehouseId })
      setPosition(res.data)
    } catch {
      setPosition(null)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'general') return
    void refreshPosition(form.itemId, form.warehouseId)
  }, [form.itemId, form.warehouseId, mode, refreshPosition])

  const loadWoMaterials = useCallback(async (workOrderId: string) => {
    if (!workOrderId) {
      setMaterials([])
      setDrafts([])
      return
    }
    setMaterialsLoading(true)
    try {
      let rows: ProductionOrderMaterial[] = []
      try {
        const readiness = await getWorkOrderMaterialsReadiness(workOrderId)
        rows = readiness.data.materials
      } catch {
        const listed = await listWorkOrderMaterials(workOrderId)
        rows = listed.data
      }
      setMaterials(rows)
      setDrafts(buildIssueDrafts(rows))
    } catch (e) {
      setMaterials([])
      setDrafts([])
      notify.error(e instanceof Error ? e.message : 'Failed to load work order materials')
    } finally {
      setMaterialsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'work_order') return
    void loadWoMaterials(form.workOrderId)
  }, [form.workOrderId, loadWoMaterials, mode])

  const materialById = useMemo(() => {
    const map = new Map<string, ProductionOrderMaterial>()
    for (const m of materials) map.set(m.id, m)
    return map
  }, [materials])

  const selectedDrafts = drafts.filter((d) => d.selected && Number(d.issueQty) > 0)
  const remainingLines = materials.filter((m) => remainingToIssue(m) > 0).length
  const fullyIssued = materials.length > 0 && remainingLines === 0
  const shortageLines = materials.filter((m) => isShortOnStock(m))
  const existingPr = materials.find((m) => m.purchaseRequisition)?.purchaseRequisition ?? null
  const existingPrNo =
    existingPr?.prNumber ?? existingPr?.requisitionNumber ?? (existingPr ? existingPr.id.slice(0, 8) : null)
  const canCreateShortagePr = canManufacturingPermission('manufacturing.materials.create_requirement')

  const patchDraft = (materialId: string, patch: Partial<IssueLineDraft>) => {
    setDrafts((rows) => rows.map((row) => (row.materialId === materialId ? { ...row, ...patch } : row)))
  }

  const fillRemainingSelected = () => {
    setDrafts((rows) =>
      rows.map((row) => {
        const m = materialById.get(row.materialId)
        if (!m) return row
        const canIssue = issuableNow(m)
        if (canIssue <= 0) return { ...row, selected: false, issueQty: '' }
        return {
          ...row,
          selected: true,
          issueQty: String(canIssue),
          warehouseId: row.warehouseId || m.warehouseId || '',
        }
      }),
    )
  }

  const clearSelection = () => {
    setDrafts((rows) => rows.map((row) => ({ ...row, selected: false })))
  }

  const createShortagePr = async () => {
    if (!form.workOrderId) {
      notify.error('Select a work order first')
      return
    }
    if (shortageLines.length === 0) {
      notify.error('No stock shortages on this work order')
      return
    }
    setBusy(true)
    try {
      const res = await createWorkOrderShortageRequisition(form.workOrderId, {
        idempotencyKey: `inv-issue-shortage-pr:${form.workOrderId}:${crypto.randomUUID()}`,
        submit: false,
      })
      const pr = res.data.requisition
      const prNo = pr.prNumber ?? pr.requisitionNumber ?? pr.id.slice(0, 8)
      notify.success(
        `Shortage PR ${prNo} created with ${pr.lines?.length ?? res.data.linkedMaterialIds.length} line(s)`,
      )
      await loadWoMaterials(form.workOrderId)
      if (pr.id) {
        navigate(`/purchase/requisitions/${pr.id}`)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Unable to create shortage purchase requisition')
    } finally {
      setBusy(false)
    }
  }

  const submitGeneral = async () => {
    if (!form.itemId || !form.warehouseId) {
      notify.error('Item and warehouse are required')
      return
    }
    const qty = Number(form.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      notify.error('Quantity must be greater than zero')
      return
    }
    setBusy(true)
    try {
      const res = await postIssueStock({
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        quantity: qty,
        movementDate: form.movementDate || undefined,
        referenceNo: form.referenceNo.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
      })
      notify.success(`Issue posted — ${res.data.movementNumber}`)
      navigate(`/inventory/movements/issues/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Posting failed')
    } finally {
      setBusy(false)
    }
  }

  const submitWorkOrder = async () => {
    if (!form.workOrderId) {
      notify.error('Work order is required')
      return
    }
    if (selectedDrafts.length === 0) {
      notify.error('Select at least one material line with an issue quantity')
      return
    }

    for (const draft of selectedDrafts) {
      const m = materialById.get(draft.materialId)
      const qty = Number(draft.issueQty)
      if (!m || !Number.isFinite(qty) || qty <= 0) {
        notify.error('Each selected line needs a positive issue quantity')
        return
      }
      if (!draft.warehouseId && !m.warehouseId) {
        notify.error(`Pick a warehouse for ${m.item.code}`)
        return
      }
      const remaining = remainingToIssue(m)
      if (qty > remaining) {
        notify.error(
          `${m.item.code}: issue qty ${qty} exceeds remaining ${remaining}. Reduce quantity for a partial issue.`,
        )
        return
      }
      if (m.freeQty != null && qty > num(m.freeQty)) {
        notify.error(
          `${m.item.code}: only ${fmtQty(m.freeQty)} free in stock. Issue that qty or create a Shortage PR for the rest.`,
        )
        return
      }
    }

    setBusy(true)
    let ok = 0
    const errors: string[] = []
    try {
      for (const draft of selectedDrafts) {
        const m = materialById.get(draft.materialId)!
        try {
          await issueWorkOrderMaterial(form.workOrderId, {
            materialId: draft.materialId,
            quantity: Number(draft.issueQty),
            warehouseId: draft.warehouseId || m.warehouseId || undefined,
            remarks: form.remarks.trim() || undefined,
            idempotencyKey: `inv-wo-issue:${form.workOrderId}:${draft.materialId}:${draft.issueQty}:${crypto.randomUUID()}`,
          })
          ok += 1
        } catch (e) {
          errors.push(`${m.item.code}: ${e instanceof Error ? e.message : 'failed'}`)
        }
      }
      if (ok > 0) {
        notify.success(
          ok === selectedDrafts.length
            ? `Issued ${ok} material line(s) to the work order`
            : `Issued ${ok} of ${selectedDrafts.length} line(s)`,
        )
      }
      if (errors.length > 0) {
        notify.error(errors.slice(0, 3).join(' · ') + (errors.length > 3 ? '…' : ''))
      }
      await loadWoMaterials(form.workOrderId)
      if (ok > 0 && errors.length === 0) {
        navigate(`/inventory/movements/issues`)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canPostIssue) return <AccessDenied title="New Issue" />

  return (
    <div className="erp-page">
      <PageHeader
        title="New Issue"
        description="General stock issue, or issue multiple materials against a work order (partial or full)."
        breadcrumbs={[
          { label: 'Inventory', to: '/inventory/stock' },
          { label: 'Issues', to: '/inventory/movements/issues' },
          { label: 'New' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Issue">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`erp-btn h-8 px-3 text-[12px] ${mode === 'general' ? 'erp-btn-primary' : 'erp-btn-ghost'}`}
                onClick={() => setMode('general')}
              >
                General issue
              </button>
              <button
                type="button"
                className={`erp-btn h-8 px-3 text-[12px] ${mode === 'work_order' ? 'erp-btn-primary' : 'erp-btn-ghost'}`}
                onClick={() => setMode('work_order')}
              >
                Issue to work order
              </button>
            </div>

            {mode === 'general' ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Item" required>
                    <Select value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}>
                      <option value="">{SELECT_PLACEHOLDER}</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>{i.label}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Warehouse" required>
                    <Select value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}>
                      <option value="">{SELECT_PLACEHOLDER}</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.label}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Quantity" required>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={form.quantity}
                      onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Issue Date">
                    <Input
                      type="date"
                      value={form.movementDate}
                      onChange={(e) => setForm((f) => ({ ...f, movementDate: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Reference No">
                    <Input value={form.referenceNo} onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))} />
                  </FormField>
                  <FormField label="Remarks" className="sm:col-span-2">
                    <Textarea rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
                  </FormField>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => navigate('/inventory/movements/issues')}>
                    Cancel
                  </Button>
                  <Button disabled={busy} onClick={() => void submitGeneral()}>
                    {busy ? 'Posting…' : 'Post Issue'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <FormField label="Work Order" required>
                  <Select
                    value={form.workOrderId}
                    onChange={(e) => setForm((f) => ({ ...f, workOrderId: e.target.value }))}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>{wo.label}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Remarks (applied to all lines)">
                  <Textarea rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
                </FormField>
              </div>
            )}
          </SectionCard>

          {mode === 'work_order' ? (
            <SectionCard
              title="Materials required"
              actions={
                form.workOrderId ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={busy || materialsLoading} onClick={fillRemainingSelected}>
                      Fill available
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={clearSelection}>
                      Clear selection
                    </Button>
                    {canCreateShortagePr && shortageLines.length > 0 ? (
                      <Button size="sm" disabled={busy || materialsLoading} onClick={() => void createShortagePr()}>
                        Create Shortage PR
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || materialsLoading}
                      onClick={() => void loadWoMaterials(form.workOrderId)}
                    >
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                      Refresh
                    </Button>
                  </div>
                ) : null
              }
            >
              {!form.workOrderId ? (
                <p className="text-[13px] text-erp-muted">Select a work order to load its material requirements.</p>
              ) : materialsLoading ? (
                <LoadingState variant="table" />
              ) : materials.length === 0 ? (
                <EmptyState
                  icon={PackageMinus}
                  title="No material requirements"
                  description="This work order has no material lines yet. Sync or add materials on the work order first."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/manufacturing/work-orders/${form.workOrderId}`)}>
                      Open work order
                    </Button>
                  }
                />
              ) : (
                <>
                  {shortageLines.length > 0 ? (
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                      <div>
                        <p className="font-semibold">
                          {shortageLines.length} item(s) short or not available in stock
                        </p>
                        <p className="mt-0.5 text-amber-900/80">
                          Issue qty is capped to free stock. Create a purchase requisition for the shortage, then issue
                          after stock arrives.
                        </p>
                        {existingPr ? (
                          <p className="mt-1">
                            Linked PR:{' '}
                            <Link
                              to={`/purchase/requisitions/${existingPr.id}`}
                              className="font-semibold text-erp-primary hover:underline"
                            >
                              {existingPrNo}
                            </Link>
                            {existingPr.status ? ` · ${existingPr.status}` : ''}
                          </p>
                        ) : null}
                      </div>
                      {canCreateShortagePr ? (
                        <Button size="sm" disabled={busy} onClick={() => void createShortagePr()}>
                          {busy ? 'Creating…' : existingPr ? 'Create another Shortage PR' : 'Create Shortage PR'}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mb-2 text-[12px] text-erp-muted">
                    {fullyIssued
                      ? 'All required quantities are already issued.'
                      : `${remainingLines} line(s) still need issue. Tick lines with free stock — reduce qty for a partial issue.`}
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-erp-border">
                    <table className="erp-table w-full text-[12px]">
                      <thead>
                        <tr className="bg-slate-50/90">
                          <th className="w-10 text-center">
                            <span className="sr-only">Select</span>
                          </th>
                          <th>Item</th>
                          <th className="w-24 text-right">Required</th>
                          <th className="w-24 text-right">Issued</th>
                          <th className="w-24 text-right">Remaining</th>
                          <th className="w-24 text-right">Free</th>
                          <th className="w-28 text-right">Issue qty</th>
                          <th className="min-w-[10rem]">Warehouse</th>
                          <th className="w-28">Stock</th>
                          <th className="w-24">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drafts.map((draft) => {
                          const m = materialById.get(draft.materialId)
                          if (!m) return null
                          const remaining = remainingToIssue(m)
                          const done = remaining <= 0
                          const free = m.freeQty != null ? num(m.freeQty) : null
                          const short = isShortOnStock(m)
                          const canIssue = issuableNow(m)
                          return (
                            <tr
                              key={draft.materialId}
                              className={cn(
                                done && 'bg-emerald-50/40',
                                short && !done && 'bg-amber-50/70',
                                draft.selected && !done && !short && 'bg-sky-50/40',
                              )}
                            >
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-erp-primary"
                                  checked={draft.selected}
                                  disabled={busy || done || canIssue <= 0}
                                  onChange={(e) =>
                                    patchDraft(draft.materialId, {
                                      selected: e.target.checked,
                                      issueQty:
                                        e.target.checked && !draft.issueQty && canIssue > 0
                                          ? String(canIssue)
                                          : draft.issueQty,
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <div className="min-w-0">
                                  <p className="font-medium text-erp-text">
                                    {m.item.code} — {m.item.name}
                                  </p>
                                  <p className="font-mono text-[10px] text-erp-muted">{m.uom.code}</p>
                                  {m.purchaseRequisition ? (
                                    <Link
                                      to={`/purchase/requisitions/${m.purchaseRequisition.id}`}
                                      className="text-[10px] font-semibold text-erp-primary hover:underline"
                                    >
                                      PR{' '}
                                      {m.purchaseRequisition.prNumber ??
                                        m.purchaseRequisition.requisitionNumber ??
                                        m.purchaseRequisition.id.slice(0, 8)}
                                    </Link>
                                  ) : null}
                                </div>
                              </td>
                              <td className="text-right tabular-nums font-semibold">{fmtQty(m.requiredQty)}</td>
                              <td className="text-right tabular-nums">{fmtQty(m.issuedQty)}</td>
                              <td className="text-right tabular-nums font-semibold text-erp-text">{fmtQty(remaining)}</td>
                              <td
                                className={cn(
                                  'text-right tabular-nums font-semibold',
                                  free != null && free <= 0 ? 'text-rose-700' : 'text-erp-muted',
                                )}
                              >
                                {free == null ? '—' : fmtQty(free)}
                              </td>
                              <td className="px-1 py-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={canIssue > 0 ? canIssue : undefined}
                                  step="any"
                                  className="h-8 text-right text-[12px]"
                                  value={draft.issueQty}
                                  disabled={busy || done || canIssue <= 0}
                                  onChange={(e) =>
                                    patchDraft(draft.materialId, {
                                      issueQty: e.target.value,
                                      selected: Number(e.target.value) > 0,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-1 py-1">
                                <Select
                                  value={draft.warehouseId || m.warehouseId || ''}
                                  className="h-8 text-[12px]"
                                  disabled={busy || done}
                                  onChange={(e) => patchDraft(draft.materialId, { warehouseId: e.target.value })}
                                >
                                  <option value="">{SELECT_PLACEHOLDER}</option>
                                  {warehouses.map((w) => (
                                    <option key={w.id} value={w.id}>{w.label}</option>
                                  ))}
                                </Select>
                              </td>
                              <td>
                                {done ? (
                                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                                    Issued
                                  </span>
                                ) : short ? (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                                    {free != null && free <= 0 ? 'No stock' : 'Shortage'}
                                  </span>
                                ) : (
                                  <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                                    Available
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                  {m.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] text-erp-muted">
                      {selectedDrafts.length} line(s) selected ·{' '}
                      {fmtQty(selectedDrafts.reduce((sum, d) => sum + num(d.issueQty), 0))} total qty
                      {shortageLines.length > 0
                        ? ` · ${shortageLines.length} short — use Create Shortage PR`
                        : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {canCreateShortagePr && shortageLines.length > 0 ? (
                        <Button variant="secondary" disabled={busy} onClick={() => void createShortagePr()}>
                          Create Shortage PR
                        </Button>
                      ) : null}
                      <Button variant="secondary" onClick={() => navigate('/inventory/movements/issues')}>
                        Cancel
                      </Button>
                      <Button disabled={busy || selectedDrafts.length === 0} onClick={() => void submitWorkOrder()}>
                        {busy
                          ? 'Issuing…'
                          : selectedDrafts.length === 0
                            ? 'Post issues'
                            : `Issue ${selectedDrafts.length} line(s)`}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-3">
          {mode === 'general' ? (
            <SectionCard title="Current Position">
              {position ? (
                <dl className="space-y-1 text-[13px]">
                  <div className="flex justify-between"><dt className="text-erp-muted">On hand</dt><dd className="tabular-nums font-semibold">{fmtQty(position.onHandQty)}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Reserved</dt><dd className="tabular-nums">{fmtQty(position.reservedQty)}</dd></div>
                  <div className="flex justify-between"><dt className="text-erp-muted">Free</dt><dd className="tabular-nums font-semibold">{fmtQty(position.freeQty)}</dd></div>
                </dl>
              ) : (
                <p className="text-[12px] text-erp-muted">Select an item and warehouse to see the live position.</p>
              )}
            </SectionCard>
          ) : (
            <SectionCard title="How it works">
              <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-erp-muted">
                <li>Short / zero free stock lines are highlighted — use Create Shortage PR to raise a purchase requisition.</li>
                <li>Issue qty is capped to free stock. After GRN, refresh and issue the rest.</li>
                <li>
                  Materials stay in sync with the{' '}
                  <Link
                    to={form.workOrderId ? `/manufacturing/work-orders/${form.workOrderId}` : '/manufacturing/work-orders'}
                    className="font-semibold text-erp-primary hover:underline"
                  >
                    work order Materials tab
                  </Link>
                  .
                </li>
              </ul>
            </SectionCard>
          )}
          <SectionCard title="Also available">
            <ul className="space-y-1 text-[12px]">
              <li>
                <Link to="/manufacturing/work-orders" className="font-semibold text-erp-primary hover:underline">Work Orders</Link>
                {' '}— materials tab issue
              </li>
              <li>
                <Link to="/manufacturing/store-workbench" className="font-semibold text-erp-primary hover:underline">Store workbench</Link>
                {' '}— issue queue across WOs
              </li>
              <li>
                <Link to="/inventory/ledger" className="font-semibold text-erp-primary hover:underline">Stock Ledger</Link>
                {' '}— all movement types
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

/** Single posted ISSUE movement. */
export function ApiIssueDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [row, setRow] = useState<InventoryStockMovement | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setMissing(false)
    getInventoryLedgerMovement(id)
      .then((res) => {
        if (cancelled) return
        const m = res.data
        if (!m || m.movementType !== 'ISSUE') {
          setMissing(true)
          setRow(null)
          return
        }
        setRow(m)
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true)
          setRow(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!perms.canViewIssues && !perms.canViewStock && !perms.canViewItemLedger) {
    return <AccessDenied title="Issue" />
  }

  if (loading) {
    return (
      <div className="erp-page">
        <PageHeader title="Issue" breadcrumbs={[{ label: 'Inventory' }, { label: 'Issues', to: '/inventory/movements/issues' }]} />
        <LoadingState variant="table" />
      </div>
    )
  }

  if (missing || !row) {
    return (
      <div className="erp-page">
        <PageHeader title="Issue" breadcrumbs={[{ label: 'Inventory' }, { label: 'Issues', to: '/inventory/movements/issues' }]} />
        <EmptyState
          icon={ArrowUpFromLine}
          title="Issue not found"
          description="This movement is missing or is not a stock issue."
          action={(
            <Button size="sm" onClick={() => navigate('/inventory/movements/issues')}>
              Back to Issues
            </Button>
          )}
        />
      </div>
    )
  }

  return (
    <div className="erp-page">
      <PageHeader
        title={row.movementNumber}
        description={`Stock issue · ${row.referenceType} · ${formatDate(row.movementDate)}`}
        breadcrumbs={[
          { label: 'Inventory', to: '/inventory/stock' },
          { label: 'Issues', to: '/inventory/movements/issues' },
          { label: row.movementNumber },
        ]}
        actions={(
          <Button size="sm" variant="secondary" onClick={() => navigate('/inventory/movements/issues')}>
            Back to list
          </Button>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Movement">
          <dl className="grid gap-3 sm:grid-cols-2 text-[13px]">
            <div><dt className="text-erp-muted">Item</dt><dd>{refLabel(row.item, row.itemId)}</dd></div>
            <div><dt className="text-erp-muted">Warehouse</dt><dd>{refLabel(row.warehouse, row.warehouseId)}</dd></div>
            <div><dt className="text-erp-muted">Quantity</dt><dd className="font-mono font-semibold text-rose-700">{fmtQty(row.quantity)}</dd></div>
            <div><dt className="text-erp-muted">Balance after</dt><dd className="font-mono">{fmtQty(row.balanceAfter)}</dd></div>
            <div><dt className="text-erp-muted">Rate</dt><dd className="font-mono">{fmtQty(row.rate)}</dd></div>
            <div><dt className="text-erp-muted">Value</dt><dd className="font-mono">{fmtQty(row.value)}</dd></div>
            <div><dt className="text-erp-muted">Reference</dt><dd>{row.referenceType}{row.referenceNo ? ` · ${row.referenceNo}` : ''}</dd></div>
            <div><dt className="text-erp-muted">Posted at</dt><dd>{formatDate(row.createdAt)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-erp-muted">Remarks</dt><dd>{row.remarks?.trim() || '—'}</dd></div>
          </dl>
        </SectionCard>
        <SectionCard title="Links">
          <ul className="space-y-2 text-[13px]">
            {row.workOrderId ? (
              <li>
                <Link
                  to={`/manufacturing/work-orders/${row.workOrderId}`}
                  className="font-semibold text-erp-primary hover:underline"
                >
                  Open work order →
                </Link>
              </li>
            ) : null}
            <li>
              <Link
                to={`/inventory/ledger?itemId=${row.itemId}&warehouseId=${row.warehouseId}`}
                className="font-semibold text-erp-primary hover:underline"
              >
                Open in Stock Ledger →
              </Link>
            </li>
            <li>
              <Link
                to={`/inventory/stock?search=${encodeURIComponent(row.item?.code ?? '')}`}
                className="font-semibold text-erp-primary hover:underline"
              >
                View stock balances →
              </Link>
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}

/** Draft issue editors do not exist in live mode — redirect to post or list. */
export function ApiIssueEditRedirect() {
  return <Navigate to="/inventory/movements/issues/new" replace />
}
