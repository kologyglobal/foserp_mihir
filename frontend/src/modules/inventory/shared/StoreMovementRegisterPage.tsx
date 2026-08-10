/**
 * Shared register for posted stock-movement lists (Receipts, Returns, …).
 * Wraps StoreRegisterListPage with movement-specific columns and filters so
 * all movement registers share the standard list chrome.
 */
import type { ComponentProps, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import { notify } from '../../../store/toastStore'
import { fetchLookup } from '../../../services/api/masterApi'
import { listInventoryLedger, type InventoryStockMovement } from '../../../services/api/inventoryApi'
import { formatDate } from '../../../utils/dates/format'
import type { CrmFilterField } from '../../../types/crmListFilters'
import type { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import { StoreRegisterListPage, type StoreRegisterFilters } from './StoreRegisterListPage'

type CommandBarProps = ComponentProps<typeof ErpCommandBar>

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function fmtQty(v: string | number | null | undefined): string {
  return num(v).toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

function refLabel(ref: { code: string; name: string } | undefined, id: string): string {
  return ref ? ref.code : id.slice(0, 8)
}

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
        setOptions(res.data.map((row) => ({ id: row.id, label: row.code || row.name })))
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

const MOVEMENT_DEFAULT_FILTERS: StoreRegisterFilters = {
  search: '',
  itemId: '',
  warehouseId: '',
  movementType: '',
  dateFrom: '',
  dateTo: '',
}

const MOVEMENT_TYPE_OPTIONS = ['OPENING', 'INWARD', 'ISSUE', 'ADJUSTMENT']

const MOVEMENT_SORT_OPTIONS = [
  { value: 'dateDesc', label: 'Date (newest)' },
  { value: 'dateAsc', label: 'Date (oldest)' },
  { value: 'numberAsc', label: 'Movement (A→Z)' },
  { value: 'numberDesc', label: 'Movement (Z→A)' },
  { value: 'qtyDesc', label: 'Quantity (high→low)' },
]

export interface StoreMovementRegisterPageProps {
  pageId: string
  title: string
  description: string
  /** Ledger query — e.g. `{ movementType: 'INWARD' }` or `{ referenceType: 'RETURN_FROM_WO' }`. */
  query: Record<string, string>
  /** Movement number links to `${detailPathBase}/${movement.id}`; omit for plain text (mixed-type ledger). */
  detailPathBase?: string
  /** Show a movement Type column + Type filter (for registers spanning all movement types). */
  showMovementType?: boolean
  /** Colour quantities by sign (issues red, receipts green) instead of always-inward green. */
  signedQty?: boolean
  referenceHeader: string
  referenceCell: (movement: InventoryStockMovement) => ReactNode
  primaryAction?: CommandBarProps['primaryAction']
  secondaryActions?: CommandBarProps['secondaryActions']
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  emptyAction?: ReactNode
}

export function StoreMovementRegisterPage({
  pageId,
  title,
  description,
  query,
  detailPathBase,
  showMovementType = false,
  signedQty = false,
  referenceHeader,
  referenceCell,
  primaryAction,
  secondaryActions,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: StoreMovementRegisterPageProps) {
  const [searchParams] = useSearchParams()
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const [filters, setFilters] = useState<StoreRegisterFilters>(() => ({
    ...MOVEMENT_DEFAULT_FILTERS,
    itemId: searchParams.get('itemId') ?? '',
    warehouseId: searchParams.get('warehouseId') ?? '',
  }))
  const [sortBy, setSortBy] = useState('dateDesc')
  const [rows, setRows] = useState<InventoryStockMovement[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // One large page — the register filters, sorts and paginates client-side.
      const res = await listInventoryLedger({ page: 1, limit: 200, ...query })
      setRows(res.data ?? [])
    } catch {
      notify.error(`Could not load ${title.toLowerCase()}`)
      setRows([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query is a config literal
  }, [title])

  useEffect(() => {
    void load()
  }, [load])

  const filterFields = useMemo<CrmFilterField[]>(() => [
    ...(showMovementType
      ? ([
          { type: 'section', label: 'Movement' },
          {
            type: 'select',
            key: 'movementType',
            label: 'Type',
            options: MOVEMENT_TYPE_OPTIONS.map((t) => ({ value: t, label: t })),
          },
        ] as CrmFilterField[])
      : []),
    { type: 'section', label: 'Item & location' },
    { type: 'search-select', key: 'itemId', label: 'Item', options: items.map((i) => ({ value: i.id, label: i.label })) },
    { type: 'select', key: 'warehouseId', label: 'Warehouse', options: warehouses.map((w) => ({ value: w.id, label: w.label })) },
    { type: 'section', label: 'Dates' },
    { type: 'date-range', label: 'Movement date', fromKey: 'dateFrom', toKey: 'dateTo' },
  ], [items, warehouses, showMovementType])

  const chipLabelResolver = useCallback(
    (key: string, value: string) => {
      if (key === 'itemId') return `Item: ${items.find((i) => i.id === value)?.label ?? value}`
      if (key === 'warehouseId') return `Warehouse: ${warehouses.find((w) => w.id === value)?.label ?? value}`
      if (key === 'movementType') return `Type: ${value}`
      return undefined
    },
    [items, warehouses],
  )

  const filtered = useMemo(() => {
    let list = [...rows]
    const q = (filters.search ?? '').trim().toLowerCase()
    if (q) {
      list = list.filter((m) =>
        [
          m.movementNumber,
          m.item?.code ?? '',
          m.item?.name ?? '',
          m.warehouse?.code ?? '',
          m.warehouse?.name ?? '',
          m.referenceType ?? '',
          m.referenceNo ?? '',
        ].some((v) => v.toLowerCase().includes(q)),
      )
    }
    if (filters.itemId) list = list.filter((m) => m.itemId === filters.itemId)
    if (filters.warehouseId) list = list.filter((m) => m.warehouseId === filters.warehouseId)
    if (filters.movementType) list = list.filter((m) => m.movementType === filters.movementType)
    const dateOf = (m: InventoryStockMovement) => (m.movementDate ?? '').slice(0, 10)
    if (filters.dateFrom) list = list.filter((m) => dateOf(m) >= filters.dateFrom)
    if (filters.dateTo) list = list.filter((m) => dateOf(m) <= filters.dateTo)
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    switch (sortBy) {
      case 'dateAsc':
        return list.sort((a, b) => cmp(dateOf(a), dateOf(b)))
      case 'numberAsc':
        return list.sort((a, b) => cmp(a.movementNumber, b.movementNumber))
      case 'numberDesc':
        return list.sort((a, b) => cmp(b.movementNumber, a.movementNumber))
      case 'qtyDesc':
        return list.sort((a, b) => num(b.quantity) - num(a.quantity))
      case 'dateDesc':
      default:
        return list.sort((a, b) => cmp(dateOf(b), dateOf(a)) || cmp(b.movementNumber, a.movementNumber))
    }
  }, [rows, filters, sortBy])

  const columns = useMemo<ColumnDef<InventoryStockMovement, unknown>[]>(() => [
    {
      id: 'date',
      header: 'Date',
      accessorFn: (m) => m.movementDate ?? '',
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.movementDate)}</span>,
    },
    {
      id: 'number',
      header: 'Movement',
      accessorFn: (m) => m.movementNumber,
      cell: ({ row }) =>
        detailPathBase ? (
          <Link
            to={`${detailPathBase}/${row.original.id}`}
            className="font-mono font-semibold text-erp-primary hover:underline"
          >
            {row.original.movementNumber}
          </Link>
        ) : (
          <span className="font-mono font-semibold">{row.original.movementNumber}</span>
        ),
    },
    ...(showMovementType
      ? ([
          {
            id: 'movementType',
            header: 'Type',
            accessorFn: (m) => m.movementType,
            cell: ({ row }) => <span className="whitespace-nowrap">{row.original.movementType}</span>,
          },
        ] as ColumnDef<InventoryStockMovement, unknown>[])
      : []),
    {
      id: 'reference',
      header: referenceHeader,
      accessorFn: (m) => m.referenceNo ?? m.referenceType ?? '',
      cell: ({ row }) => referenceCell(row.original),
    },
    {
      id: 'item',
      header: 'Item',
      accessorFn: (m) => refLabel(m.item, m.itemId),
      cell: ({ row }) => (
        <span className="font-mono" title={row.original.item ? `${row.original.item.code} · ${row.original.item.name}` : undefined}>
          {refLabel(row.original.item, row.original.itemId)}
        </span>
      ),
    },
    {
      id: 'warehouse',
      header: 'Warehouse',
      accessorFn: (m) => refLabel(m.warehouse, m.warehouseId),
      cell: ({ row }) => <span className="whitespace-nowrap">{refLabel(row.original.warehouse, row.original.warehouseId)}</span>,
    },
    {
      id: 'qty',
      header: () => <div className="text-right">Qty</div>,
      meta: { columnLabel: 'Qty' },
      accessorFn: (m) => num(m.quantity),
      cell: ({ row }) => {
        const qty = num(row.original.quantity)
        const tone = signedQty ? (qty < 0 ? 'text-rose-700' : 'text-emerald-700') : 'text-emerald-700'
        return (
          <div className={`text-right tabular-nums font-semibold ${tone}`}>
            {signedQty && qty >= 0 ? '+' : ''}{fmtQty(qty)}
          </div>
        )
      },
    },
    {
      id: 'value',
      header: () => <div className="text-right">Value</div>,
      meta: { columnLabel: 'Value' },
      accessorFn: (m) => num(m.value),
      cell: ({ row }) => <div className="text-right tabular-nums">{fmtQty(row.original.value)}</div>,
    },
    {
      id: 'balanceAfter',
      header: () => <div className="text-right">Balance After</div>,
      meta: { columnLabel: 'Balance After' },
      accessorFn: (m) => num(m.balanceAfter),
      cell: ({ row }) => <div className="text-right tabular-nums">{fmtQty(row.original.balanceAfter)}</div>,
    },
  ], [detailPathBase, referenceHeader, referenceCell, showMovementType, signedQty])

  return (
    <StoreRegisterListPage<InventoryStockMovement>
      pageId={pageId}
      title={title}
      description={description}
      rows={filtered}
      totalRowCount={rows.length}
      columns={columns}
      getRowId={(m) => m.id}
      loading={loading}
      searchPlaceholder={`Search movement, item, warehouse, reference…`}
      sortOptions={MOVEMENT_SORT_OPTIONS}
      sortBy={sortBy}
      onSortChange={setSortBy}
      filters={filters}
      defaultFilters={MOVEMENT_DEFAULT_FILTERS}
      onFiltersChange={setFilters}
      filterFields={filterFields}
      drawerTitle={`Filter ${title.toLowerCase()}`}
      chipLabelResolver={chipLabelResolver}
      primaryAction={primaryAction}
      secondaryActions={[
        ...(secondaryActions ?? []),
        { id: 'refresh', label: 'Refresh', onClick: () => void load() },
      ]}
      emptyIcon={emptyIcon}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyAction={emptyAction}
    />
  )
}
