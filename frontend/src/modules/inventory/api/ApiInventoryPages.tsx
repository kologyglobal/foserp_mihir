/**
 * Inventory Phase 3A live pages (API mode only).
 * Stock balances, stock ledger, reservations, and immediate movement posts
 * against /inventory/* — the physical stock source of truth. Demo mode keeps
 * the original store-backed inventory workspace.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Boxes, ClipboardList, Factory, FileCheck2, Lock, PackagePlus, RefreshCw, Warehouse } from 'lucide-react'
import { PageHeader } from '../../../components/ui/PageHeader'
import { SectionCard } from '../../../components/ui/SectionCard'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { SearchInput } from '../../../components/ui/SearchInput'
import { LoadingState } from '../../../design-system/components/LoadingState'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Textarea } from '../../../components/forms/Inputs'
import {
  ErpCardFormPage,
  ErpCardSection,
  ErpStickySaveBar,
} from '../../../components/erp/card-form'
import { notify } from '../../../store/toastStore'
import { appPromptNote } from '../../../store/confirmDialogStore'
import { fetchLookup } from '../../../services/api/masterApi'
import {
  cancelInventoryReservation,
  createInventoryReservation,
  getInventoryPosition,
  listInventoryBalances,
  listInventoryReservations,
  postInwardStock,
  postIssueStock,
  postOpeningStock,
  postStockAdjustment,
  type InventoryReservationDemandType,
  type InventoryReservationStatus,
  type InventoryStockBalance,
  type InventoryStockMovement,
  type InventoryStockReservation,
} from '../../../services/api/inventoryApi'
import { useInventoryPermissions } from '../../../utils/permissions/inventory'
import { formatDate } from '../../../utils/dates/format'
import { inventoryApiFacade } from '../../../services/inventory/inventoryApiFacade'
import * as documentsApi from '../../../services/api/inventoryDocumentsApi'
import type { ApiInventoryDocument, ApiInventoryDocumentLine } from '../../../services/api/inventoryDocumentsApi'
import { formatApiError } from '../../../services/api/apiErrors'
import type { ColumnDef } from '@tanstack/react-table'
import type { CrmFilterField } from '../../../types/crmListFilters'
import { StoreRegisterListPage, type StoreRegisterFilters } from '../shared/StoreRegisterListPage'
import { StoreMovementRegisterPage } from '../shared/StoreMovementRegisterPage'

// ─── Shared helpers ───────────────────────────────────────────────────────────

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
          res.data.map((row) => ({
            id: row.id,
            label: row.code || row.name,
          })),
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

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function fmtQty(v: string | number | null | undefined): string {
  return num(v).toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

function errText(error: unknown, fallback: string): string {
  const msg = formatApiError(error)
  return !msg || msg === 'Request failed' ? fallback : msg
}

function refLabel(ref: { code: string; name: string } | undefined, id: string): string {
  return ref ? `${ref.code} — ${ref.name}` : id.slice(0, 8)
}

function AccessDenied({ title }: { title: string }) {
  return (
    <div className="erp-page">
      <PageHeader title={title} breadcrumbs={[{ label: 'Store', to: '/inventory/stock' }]} />
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


export function ApiStockBalancesPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const warehouses = useLookupOptions('warehouses')
  const [warehouseId, setWarehouseId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<InventoryStockBalance[]>([])
  const [meta, setMeta] = useState<PageMeta | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listInventoryBalances({ page, limit: 50, warehouseId: warehouseId || undefined })
      setRows(res.data ?? [])
      const m = res.meta as PageMeta | undefined
      setMeta(m ? { page: m.page, totalPages: m.totalPages, total: m.total } : null)
    } catch {
      notify.error('Could not load stock balances')
    } finally {
      setLoading(false)
    }
  }, [page, warehouseId])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => {
      const blob = `${r.item?.code ?? ''} ${r.item?.name ?? ''} ${r.warehouse?.code ?? ''} ${r.warehouse?.name ?? ''}`.toLowerCase()
      return blob.includes(q)
    })
  }, [rows, search])

  if (!perms.canViewStock) return <AccessDenied title="Stock" />

  return (
    <div className="erp-page">
      <PageHeader
        title="Stock on Hand"
        description="How much you have right now — on hand, reserved, and free to issue."
        breadcrumbs={[{ label: 'Store' }, { label: 'Stock' }]}
        actions={(
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        )}
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search item / warehouse on this page…" />
        </div>
        <label className="text-[11px] text-erp-muted">
          Warehouse
          <Select
            wrapClassName="w-56"
            value={warehouseId}
            onChange={(e) => {
              setPage(1)
              setWarehouseId(e.target.value)
            }}
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </Select>
        </label>
      </div>

      <SectionCard title="Balances" noPadding>
        {loading ? (
          <div className="p-6"><LoadingState variant="table" rows={8} /></div>
        ) : visible.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Boxes}
              title="No stock on hand yet"
              description="Receive against a PO (Purchase GRN), post opening stock, or clear filters to see balances."
              action={
                <div className="flex flex-wrap gap-2 p-0">
                  <Button size="sm" variant="secondary" onClick={() => navigate('/purchase/grn')}>
                    Purchase GRN
                  </Button>
                  <Button size="sm" onClick={() => navigate('/inventory/opening-stock')}>
                    Opening Stock
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="erp-table w-full min-w-[860px] text-[13px]">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th className="text-right">On Hand</th>
                    <th className="text-right">Reserved</th>
                    <th className="text-right">Free</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={`${r.itemId}:${r.warehouseId}`}>
                      <td>{refLabel(r.item, r.itemId)}</td>
                      <td>{refLabel(r.warehouse, r.warehouseId)}</td>
                      <td className="text-right tabular-nums">{fmtQty(r.onHandQty)}</td>
                      <td className="text-right tabular-nums">{fmtQty(r.reservedQty)}</td>
                      <td className={`text-right tabular-nums font-semibold ${num(r.freeQty) <= 0 ? 'text-rose-700' : ''}`}>
                        {fmtQty(r.freeQty)}
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/inventory/ledger?itemId=${r.itemId}&warehouseId=${r.warehouseId}`}
                          className="text-[12px] font-semibold text-erp-primary hover:underline"
                        >
                          Ledger
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager meta={meta} onPage={setPage} />
          </>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Stock ledger ─────────────────────────────────────────────────────────────

/** Standard list page over the shared movement register (all movement types). */
export function ApiStockLedgerPage() {
  const perms = useInventoryPermissions()
  if (!perms.canViewItemLedger && !perms.canViewStock) return <AccessDenied title="Stock Ledger" />
  return (
    <StoreMovementRegisterPage
      pageId="/inventory/ledger"
      title="Stock Ledger"
      description="Live signed stock movements — opening, inward, issues and adjustments with running balance."
      query={{}}
      showMovementType
      signedQty
      referenceHeader="Reference"
      referenceCell={(m) => (
        <span className="whitespace-nowrap">
          {m.referenceType}
          {m.referenceNo ? <span className="text-erp-muted"> · {m.referenceNo}</span> : null}
        </span>
      )}
      emptyIcon={ClipboardList}
      emptyTitle="No stock movements yet"
      emptyDescription="Post opening stock, a receipt, an issue or an adjustment to build the ledger."
    />
  )
}

/** Legacy per-item ledger deep links → live ledger filtered by item. */
export function ApiItemLedgerRedirect() {
  const params = useParams()
  const itemId = params.itemId ?? params.id ?? ''
  return <Navigate to={itemId ? `/inventory/ledger?itemId=${itemId}` : '/inventory/ledger'} replace />
}

// ─── Reservations ─────────────────────────────────────────────────────────────

const RESERVATION_STATUSES: InventoryReservationStatus[] = ['ACTIVE', 'FULFILLED', 'CANCELLED']
const DEMAND_TYPES: InventoryReservationDemandType[] = ['SO', 'WO', 'DISPATCH']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RESERVATION_DEFAULT_FILTERS: StoreRegisterFilters = {
  search: '',
  status: '',
  demandType: '',
  warehouseId: '',
  itemId: '',
}

const RESERVATION_SORT_OPTIONS = [
  { value: 'createdDesc', label: 'Created (newest)' },
  { value: 'createdAsc', label: 'Created (oldest)' },
  { value: 'numberAsc', label: 'Reservation (A→Z)' },
  { value: 'numberDesc', label: 'Reservation (Z→A)' },
  { value: 'qtyDesc', label: 'Quantity (high→low)' },
  { value: 'status', label: 'Status' },
]

export function ApiReservationsPage() {
  const perms = useInventoryPermissions()
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const [filters, setFilters] = useState<StoreRegisterFilters>({ ...RESERVATION_DEFAULT_FILTERS })
  const [sortBy, setSortBy] = useState('createdDesc')
  const [rows, setRows] = useState<InventoryStockReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    itemId: '',
    warehouseId: '',
    quantity: '',
    demandType: 'WO' as InventoryReservationDemandType,
    demandId: '',
    referenceNo: '',
    remarks: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // One large page — the register filters, sorts and paginates client-side.
      const res = await listInventoryReservations({ page: 1, limit: 200 })
      setRows(res.data ?? [])
    } catch {
      notify.error('Could not load reservations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submitCreate = async () => {
    if (!form.itemId || !form.warehouseId) {
      notify.error('Item and warehouse are required')
      return
    }
    const qty = Number(form.quantity)
    if (!(qty > 0)) {
      notify.error('Quantity must be greater than zero')
      return
    }
    if (!UUID_RE.test(form.demandId.trim())) {
      notify.error('Demand ID must be the UUID of the sales order, work order, or outbound dispatch line')
      return
    }
    setBusy(true)
    try {
      const res = await createInventoryReservation({
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        quantity: qty,
        demandType: form.demandType,
        demandId: form.demandId.trim(),
        referenceNo: form.referenceNo.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
      })
      notify.success(`Reservation ${res.data.reservationNumber} created`)
      setShowCreate(false)
      setForm((f) => ({ ...f, quantity: '', demandId: '', referenceNo: '', remarks: '' }))
      await load()
    } catch (e) {
      notify.error(errText(e, 'Reservation failed'))
    } finally {
      setBusy(false)
    }
  }

  const cancelReservation = async (r: InventoryStockReservation) => {
    const remarks = await appPromptNote({
      title: `Cancel reservation ${r.reservationNumber}?`,
      description: 'Remaining reserved quantity is released back to free stock.',
      confirmLabel: 'Cancel Reservation',
      tone: 'danger',
      note: { required: false, label: 'Remarks' },
    })
    if (remarks == null) return
    setBusy(true)
    try {
      await cancelInventoryReservation(r.id, remarks ? { remarks } : undefined)
      notify.success(`Reservation ${r.reservationNumber} cancelled`)
      await load()
    } catch (e) {
      notify.error(errText(e, 'Cancel failed'))
    } finally {
      setBusy(false)
    }
  }

  const itemLabel = useCallback(
    (id: string) => items.find((i) => i.id === id)?.label ?? id.slice(0, 8),
    [items],
  )
  const warehouseLabel = useCallback(
    (id: string) => warehouses.find((w) => w.id === id)?.label ?? id.slice(0, 8),
    [warehouses],
  )

  const filterFields = useMemo<CrmFilterField[]>(() => [
    { type: 'section', label: 'Status & demand' },
    { type: 'select', key: 'status', label: 'Status', options: RESERVATION_STATUSES.map((s) => ({ value: s, label: s })) },
    { type: 'select', key: 'demandType', label: 'Demand type', options: DEMAND_TYPES.map((t) => ({ value: t, label: t })) },
    { type: 'section', label: 'Item & location' },
    { type: 'search-select', key: 'itemId', label: 'Item', options: items.map((i) => ({ value: i.id, label: i.label })) },
    { type: 'select', key: 'warehouseId', label: 'Warehouse', options: warehouses.map((w) => ({ value: w.id, label: w.label })) },
  ], [items, warehouses])

  const chipLabelResolver = useCallback(
    (key: string, value: string) => {
      if (key === 'itemId') return `Item: ${itemLabel(value)}`
      if (key === 'warehouseId') return `Warehouse: ${warehouseLabel(value)}`
      return undefined
    },
    [itemLabel, warehouseLabel],
  )

  const filtered = useMemo(() => {
    let list = [...rows]
    const q = (filters.search ?? '').trim().toLowerCase()
    if (q) {
      list = list.filter((r) =>
        [r.reservationNumber, itemLabel(r.itemId), warehouseLabel(r.warehouseId), r.demandType, r.referenceNo ?? '', r.status]
          .some((v) => v.toLowerCase().includes(q)),
      )
    }
    if (filters.status) list = list.filter((r) => r.status === filters.status)
    if (filters.demandType) list = list.filter((r) => r.demandType === filters.demandType)
    if (filters.itemId) list = list.filter((r) => r.itemId === filters.itemId)
    if (filters.warehouseId) list = list.filter((r) => r.warehouseId === filters.warehouseId)
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    switch (sortBy) {
      case 'createdAsc':
        return list.sort((a, b) => cmp(a.createdAt, b.createdAt))
      case 'numberAsc':
        return list.sort((a, b) => cmp(a.reservationNumber, b.reservationNumber))
      case 'numberDesc':
        return list.sort((a, b) => cmp(b.reservationNumber, a.reservationNumber))
      case 'qtyDesc':
        return list.sort((a, b) => num(b.quantity) - num(a.quantity))
      case 'status':
        return list.sort((a, b) => cmp(a.status, b.status))
      case 'createdDesc':
      default:
        return list.sort((a, b) => cmp(b.createdAt, a.createdAt))
    }
  }, [rows, filters, sortBy, itemLabel, warehouseLabel])

  const columns = useMemo<ColumnDef<InventoryStockReservation, unknown>[]>(() => [
    {
      id: 'number',
      header: 'Reservation',
      accessorFn: (r) => r.reservationNumber,
      cell: ({ row }) => <span className="font-mono font-semibold">{row.original.reservationNumber}</span>,
    },
    {
      id: 'item',
      header: 'Item',
      accessorFn: (r) => itemLabel(r.itemId),
      cell: ({ row }) => <span className="font-mono">{itemLabel(row.original.itemId)}</span>,
    },
    {
      id: 'warehouse',
      header: 'Warehouse',
      accessorFn: (r) => warehouseLabel(r.warehouseId),
      cell: ({ row }) => <span className="whitespace-nowrap">{warehouseLabel(row.original.warehouseId)}</span>,
    },
    {
      id: 'demand',
      header: 'Demand',
      accessorFn: (r) => `${r.demandType} ${r.referenceNo ?? ''}`,
      cell: ({ row }) => (
        <span>
          {row.original.demandType}
          {row.original.referenceNo ? <span className="text-erp-muted"> · {row.original.referenceNo}</span> : null}
        </span>
      ),
    },
    {
      id: 'qty',
      header: () => <div className="text-right">Qty</div>,
      meta: { columnLabel: 'Qty' },
      accessorFn: (r) => num(r.quantity),
      cell: ({ row }) => <div className="text-right tabular-nums">{fmtQty(row.original.quantity)}</div>,
    },
    {
      id: 'fulfilled',
      header: () => <div className="text-right">Fulfilled</div>,
      meta: { columnLabel: 'Fulfilled' },
      accessorFn: (r) => num(r.fulfilledQty),
      cell: ({ row }) => <div className="text-right tabular-nums">{fmtQty(row.original.fulfilledQty)}</div>,
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => r.status,
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.status}</span>,
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.status === 'ACTIVE' && perms.canManageReservations ? (
          <div className="text-right">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void cancelReservation(row.original)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="text-right text-erp-muted">-</div>
        ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cancelReservation is re-created per render by design
  ], [itemLabel, warehouseLabel, perms.canManageReservations, busy])

  if (!perms.canViewReservations && !perms.canManageReservations) return <AccessDenied title="Reservations" />

  const createPanel = showCreate ? (
    <SectionCard title="New Reservation" className="mb-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Item" required>
              <Select value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}>
                <option value="">— Select —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Warehouse" required>
              <Select value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}>
                <option value="">— Select —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Quantity" required>
              <Input
                type="number"
                min={0.001}
                step="any"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </FormField>
            <FormField label="Demand Type" required>
              <Select
                value={form.demandType}
                onChange={(e) => setForm((f) => ({ ...f, demandType: e.target.value as InventoryReservationDemandType }))}
              >
                {DEMAND_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Demand ID (UUID)"
              required
              hint="Use the Work Order or Sales Order UUID. For DISPATCH, use the outbound dispatch line UUID."
            >
              <Input value={form.demandId} onChange={(e) => setForm((f) => ({ ...f, demandId: e.target.value }))} placeholder="xxxxxxxx-xxxx-…" />
            </FormField>
            <FormField label="Reference No">
              <Input value={form.referenceNo} onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))} />
            </FormField>
            <FormField label="Remarks" className="sm:col-span-2 lg:col-span-3">
              <Textarea rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </FormField>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" disabled={busy} onClick={() => void submitCreate()}>
              {busy ? 'Saving…' : 'Save Reservation'}
            </Button>
          </div>
        </SectionCard>
  ) : null

  return (
    <StoreRegisterListPage<InventoryStockReservation>
      pageId="/inventory/store/reservations"
      title="Stock Reservations"
      description="Live reservations against sales orders, work orders and dispatches. Fulfilment happens via issue / dispatch posting."
      rows={filtered}
      totalRowCount={rows.length}
      columns={columns}
      getRowId={(r) => r.id}
      loading={loading}
      searchPlaceholder="Search reservation, item, warehouse, reference…"
      sortOptions={RESERVATION_SORT_OPTIONS}
      sortBy={sortBy}
      onSortChange={setSortBy}
      filters={filters}
      defaultFilters={RESERVATION_DEFAULT_FILTERS}
      onFiltersChange={setFilters}
      filterFields={filterFields}
      drawerTitle="Filter reservations"
      chipLabelResolver={chipLabelResolver}
      primaryAction={
        perms.canManageReservations
          ? {
              id: 'new',
              label: showCreate ? 'Close form' : 'New Reservation',
              icon: PackagePlus,
              onClick: () => setShowCreate((v) => !v),
            }
          : undefined
      }
      secondaryActions={[
        { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
      ]}
      emptyIcon={Warehouse}
      emptyTitle="No reservations yet"
      emptyDescription="Reservations ring-fence free stock against sales orders, work orders and dispatches."
      emptyAction={
        perms.canManageReservations ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <PackagePlus className="h-4 w-4" /> New Reservation
          </Button>
        ) : undefined
      }
      beforeTable={createPanel}
    />
  )
}

// ─── Immediate movement post (opening / inward / issue / adjustment) ──────────

type MovementKind = 'opening' | 'inward' | 'issue' | 'adjustment'

const MOVEMENT_CONFIG: Record<
  MovementKind,
  {
    title: string
    description: string
    postFn: typeof postOpeningStock
    showRate: boolean
    signed: boolean
    path: string
    cancelTo: string
  }
> = {
  opening: {
    title: 'Opening Stock',
    description: 'Post opening balances into the live stock ledger.',
    postFn: postOpeningStock,
    showRate: true,
    signed: false,
    path: '/inventory/opening-stock',
    cancelTo: '/inventory',
  },
  inward: {
    title: 'Material Inward',
    description: 'Post an inward stock movement (non-GRN receipt).',
    postFn: postInwardStock,
    showRate: true,
    signed: false,
    path: '/inventory/inward',
    cancelTo: '/inventory',
  },
  issue: {
    title: 'Material Issue',
    description: 'Post a general stock issue (work-order issues run from the WO Materials tab).',
    postFn: postIssueStock,
    showRate: false,
    signed: false,
    path: '/inventory/issue',
    cancelTo: '/inventory',
  },
  adjustment: {
    title: 'Stock Adjustment',
    description: 'Post a signed adjustment — positive adds stock, negative removes it.',
    postFn: postStockAdjustment,
    showRate: false,
    signed: true,
    path: '/inventory/adjustment',
    cancelTo: '/inventory',
  },
}

export function ApiMovementPostPage({ kind }: { kind: MovementKind }) {
  const perms = useInventoryPermissions()
  const cfg = MOVEMENT_CONFIG[kind]
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    itemId: '',
    warehouseId: '',
    quantity: '',
    rate: '',
    movementDate: today,
    referenceNo: '',
    remarks: '',
  })
  const [position, setPosition] = useState<InventoryStockBalance | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastMovement, setLastMovement] = useState<InventoryStockMovement | null>(null)

  const allowed =
    kind === 'issue' ? perms.canPostIssue : kind === 'adjustment' ? perms.canPostAdjustment : perms.canPostReceipt

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
    void refreshPosition(form.itemId, form.warehouseId)
  }, [form.itemId, form.warehouseId, refreshPosition])

  const submit = async () => {
    if (!form.itemId || !form.warehouseId) {
      notify.error('Item and warehouse are required')
      return
    }
    const qty = Number(form.quantity)
    if (!Number.isFinite(qty) || qty === 0 || (!cfg.signed && qty < 0)) {
      notify.error(cfg.signed ? 'Quantity must be a non-zero signed number' : 'Quantity must be greater than zero')
      return
    }
    setBusy(true)
    try {
      const res = await cfg.postFn({
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        quantity: qty,
        rate: cfg.showRate && form.rate ? Number(form.rate) : undefined,
        movementDate: form.movementDate || undefined,
        referenceNo: form.referenceNo.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
      })
      setLastMovement(res.data)
      notify.success(`${cfg.title} posted — ${res.data.movementNumber}`)
      setForm((f) => ({ ...f, quantity: '', referenceNo: '', remarks: '' }))
      await refreshPosition(form.itemId, form.warehouseId)
    } catch (e) {
      notify.error(errText(e, 'Posting failed'))
    } finally {
      setBusy(false)
    }
  }

  if (!allowed) return <AccessDenied title={cfg.title} />

  return (
    <ErpCardFormPage
      variant="dynamics"
      badge="Store"
      title={cfg.title}
      description={cfg.description}
      favoritePath={cfg.path}
      backLink={{ to: cfg.cancelTo, label: 'Back to Store' }}
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: cfg.title },
      ]}
      stickyFooter
      footer={(
        <ErpStickySaveBar
          sticky
          submitLabel="Save"
          isSubmitting={busy}
          onSave={() => void submit()}
          cancelTo={cfg.cancelTo}
          cancelLabel="Cancel"
        />
      )}
      onSaveShortcut={() => void submit()}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ErpCardSection title="Movement">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Item" required>
                <Select value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>{i.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Warehouse" required>
                <Select value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label={cfg.signed ? 'Quantity (+/−)' : 'Quantity'} required>
                <Input
                  type="number"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </FormField>
              {cfg.showRate ? (
                <FormField label="Rate (₹, optional)">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={form.rate}
                    onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                  />
                </FormField>
              ) : null}
              <FormField label="Movement Date">
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
          </ErpCardSection>
        </div>

        <div className="space-y-4">
          <ErpCardSection title="Current Position">
            {position ? (
              <dl className="space-y-1 text-[13px]">
                <div className="flex justify-between"><dt className="text-erp-muted">On hand</dt><dd className="tabular-nums font-semibold">{fmtQty(position.onHandQty)}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Reserved</dt><dd className="tabular-nums">{fmtQty(position.reservedQty)}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Free</dt><dd className="tabular-nums font-semibold">{fmtQty(position.freeQty)}</dd></div>
              </dl>
            ) : (
              <p className="text-[12px] text-erp-muted">Select an item and warehouse to see the live position.</p>
            )}
          </ErpCardSection>
          {lastMovement ? (
            <ErpCardSection title="Last Posted">
              <p className="text-[13px]">
                <span className="font-mono">{lastMovement.movementNumber}</span> · {fmtQty(lastMovement.quantity)} on{' '}
                {formatDate(lastMovement.movementDate)}
              </p>
              <Link to="/inventory/ledger" className="mt-1 inline-block text-[12px] font-semibold text-erp-primary hover:underline">
                Open Stock Ledger →
              </Link>
            </ErpCardSection>
          ) : null}
        </div>
      </div>
    </ErpCardFormPage>
  )
}

type DocumentKind = 'transfers' | 'adjustments' | 'stock-counts'

/**
 * Registers load one large page and filter/sort/paginate client-side —
 * same model as the purchase registers (gold path /purchase/requisitions).
 */
const DOCUMENT_FETCH_LIMIT = 200

const DOCUMENT_CONFIG: Record<DocumentKind, {
  title: string
  createTitle: string
  basePath: string
  number: (row: ApiInventoryDocument) => string
  date: (row: ApiInventoryDocument) => string | undefined
  load: () => Promise<unknown>
  post: (id: string) => Promise<unknown>
  postable: string[]
  canCreate: boolean
  statuses: string[]
}> = {
  transfers: {
    title: 'Inventory Transfers',
    createTitle: 'New Transfer',
    basePath: '/inventory/movements/transfers',
    number: (row) => row.transferNumber ?? row.id.slice(0, 8),
    date: (row) => row.transferDate,
    load: () => inventoryApiFacade.listTransfers({ page: 1, limit: DOCUMENT_FETCH_LIMIT }),
    post: inventoryApiFacade.postTransfer,
    postable: ['APPROVED'],
    canCreate: true,
    statuses: ['DRAFT', 'SUBMITTED', 'APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REVERSED', 'CANCELLED'],
  },
  adjustments: {
    title: 'Inventory Adjustments',
    createTitle: 'New Adjustment',
    basePath: '/inventory/movements/adjustments',
    number: (row) => row.adjustmentNumber ?? row.id.slice(0, 8),
    date: (row) => row.adjustmentDate,
    load: () => inventoryApiFacade.listAdjustments({ page: 1, limit: DOCUMENT_FETCH_LIMIT }),
    post: inventoryApiFacade.postAdjustment,
    postable: ['APPROVED'],
    canCreate: true,
    statuses: ['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED', 'CANCELLED'],
  },
  'stock-counts': {
    title: 'Stock Counts',
    createTitle: 'New Stock Count',
    basePath: '/inventory/stock-count',
    number: (row) => row.countNumber ?? row.id.slice(0, 8),
    date: (row) => row.countDate,
    load: () => inventoryApiFacade.listStockCounts({ page: 1, limit: DOCUMENT_FETCH_LIMIT }),
    post: inventoryApiFacade.postStockCount,
    postable: ['APPROVED'],
    canCreate: true,
    statuses: ['DRAFT', 'SNAPSHOT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED', 'CANCELLED'],
  },
}

const DOCUMENT_DEFAULT_FILTERS: StoreRegisterFilters = {
  search: '',
  status: '',
  warehouseId: '',
  dateFrom: '',
  dateTo: '',
}

/** Virtual status filter — everything that still needs action (not terminal). */
const DOCUMENT_OPEN_STATUS = '_open'
const DOCUMENT_TERMINAL_STATUSES: Record<DocumentKind, string[]> = {
  transfers: ['RECEIVED', 'REVERSED', 'CANCELLED'],
  adjustments: ['POSTED', 'REVERSED', 'CANCELLED'],
  'stock-counts': ['POSTED', 'REVERSED', 'CANCELLED'],
}

const DOCUMENT_SORT_OPTIONS = [
  { value: 'dateDesc', label: 'Date (newest)' },
  { value: 'dateAsc', label: 'Date (oldest)' },
  { value: 'numberAsc', label: 'Document (A→Z)' },
  { value: 'numberDesc', label: 'Document (Z→A)' },
  { value: 'status', label: 'Status' },
]

/** "CODE ±qty" summary for a register row — counts show variance only after entry. */
function documentLineSummary(kind: DocumentKind, line: ApiInventoryDocumentLine): string {
  const code = line.item?.code ?? line.itemId.slice(0, 8)
  if (kind === 'stock-counts') {
    const counted = line.countedQty
    if (counted == null || counted === '') return code
    return `${code} · counted ${fmtQty(counted)}`
  }
  const qty = num(line.quantity ?? line.requestedQty)
  const sign = kind === 'adjustments' && qty > 0 ? '+' : ''
  return `${code} ${sign}${fmtQty(qty)}`
}

/** Lean live document register with create + full lifecycle actions. */
export function ApiInventoryDocumentsPage({ kind }: { kind: DocumentKind }) {
  const cfg = DOCUMENT_CONFIG[kind]
  const perms = useInventoryPermissions()
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const [rows, setRows] = useState<ApiInventoryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [searchParams] = useSearchParams()
  // Deep links (e.g. dashboard KPIs) may pre-apply a status filter: ?status=_open or a real status.
  const [filters, setFilters] = useState<StoreRegisterFilters>(() => ({
    ...DOCUMENT_DEFAULT_FILTERS,
    status: searchParams.get('status') ?? '',
  }))
  const [sortBy, setSortBy] = useState('dateDesc')
  const today = new Date().toISOString().slice(0, 10)
  const navigate = useNavigate()
  const location = useLocation()
  const isNewRoute = location.pathname.endsWith('/new')
  const [creating, setCreating] = useState(false)
  const [xfer, setXfer] = useState({
    fromWarehouseId: searchParams.get('fromWarehouseId') ?? '',
    toWarehouseId: searchParams.get('toWarehouseId') ?? '',
    itemId: searchParams.get('itemId') ?? '',
    quantity: searchParams.get('quantity') ?? '',
    remarks: searchParams.get('remarks') ?? '',
  })
  const [countForm, setCountForm] = useState({ warehouseId: '', remarks: '' })
  const [adjForm, setAdjForm] = useState({ warehouseId: '', itemId: '', quantity: '', reason: 'PHYSICAL_COUNT', remarks: '' })

  // Source-warehouse availability preview for the transfer form.
  const [sourceBalance, setSourceBalance] = useState<InventoryStockBalance | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  useEffect(() => {
    if (kind !== 'transfers' || !xfer.fromWarehouseId || !xfer.itemId) {
      setSourceBalance(null)
      return
    }
    let cancelled = false
    setBalanceLoading(true)
    // List endpoint (not /position) — includes item code/name and UOM codes.
    listInventoryBalances({ itemId: xfer.itemId, warehouseId: xfer.fromWarehouseId, page: 1, limit: 1 })
      .then((res) => {
        if (cancelled) return
        setSourceBalance(
          res.data?.[0]
            ?? { itemId: xfer.itemId, warehouseId: xfer.fromWarehouseId, onHandQty: 0, reservedQty: 0, freeQty: 0 },
        )
      })
      .catch(() => {
        // No balance row = zero stock at this warehouse.
        if (!cancelled) setSourceBalance({ itemId: xfer.itemId, warehouseId: xfer.fromWarehouseId, onHandQty: 0, reservedQty: 0, freeQty: 0 })
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind, xfer.fromWarehouseId, xfer.itemId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await cfg.load()
      const payload = result as { data?: ApiInventoryDocument[] }
      setRows((payload.data ?? result) as ApiInventoryDocument[])
    } catch (error) {
      notify.error(error instanceof Error ? error.message : `Could not load ${cfg.title.toLowerCase()}`)
    } finally {
      setLoading(false)
    }
  }, [cfg])

  useEffect(() => {
    if (!isNewRoute) void load()
  }, [load, isNewRoute])

  const post = async (row: ApiInventoryDocument) => {
    setBusyId(row.id)
    try {
      await cfg.post(row.id)
      notify.success(`${cfg.number(row)} posted`)
      await load()
    } catch (error) {
      notify.error(errText(error, 'Posting failed'))
    } finally {
      setBusyId('')
    }
  }

  const advanceTransfer = async (row: ApiInventoryDocument, action: 'submit' | 'approve' | 'receive') => {
    setBusyId(row.id)
    try {
      if (action === 'submit') await documentsApi.submitInventoryTransfer(row.id)
      else if (action === 'approve') await documentsApi.approveInventoryTransfer(row.id)
      else {
        const detail = await documentsApi.getInventoryTransfer(row.id)
        const lines = (detail.data.lines ?? []).map((l) => ({
          lineId: l.id,
          quantity: Number(l.dispatchedQty ?? l.quantity ?? l.requestedQty ?? 0),
        })).filter((l) => l.quantity > 0)
        if (!lines.length) throw new Error('No lines to receive')
        await documentsApi.receiveInventoryTransfer(row.id, lines)
      }
      notify.success(`${cfg.number(row)} ${action}d`)
      await load()
    } catch (error) {
      notify.error(errText(error, `${action} failed`))
    } finally {
      setBusyId('')
    }
  }

  const advanceAdjustment = async (row: ApiInventoryDocument, action: 'submit' | 'approve' | 'reverse') => {
    if (action === 'reverse') {
      const reason = await appPromptNote({
        title: 'Reverse posted adjustment?',
        description: 'Posts negating movements for every line. The document becomes REVERSED.',
        detail: cfg.number(row),
        tone: 'danger',
        confirmLabel: 'Reverse',
        note: { label: 'Reversal reason', required: true },
      })
      if (reason == null) return
      setBusyId(row.id)
      try {
        await documentsApi.reverseInventoryAdjustment(row.id, reason)
        notify.success(`${cfg.number(row)} reversed`)
        await load()
      } catch (error) {
        notify.error(errText(error, 'Reverse failed'))
      } finally {
        setBusyId('')
      }
      return
    }
    setBusyId(row.id)
    try {
      if (action === 'submit') await documentsApi.submitInventoryAdjustment(row.id)
      else await documentsApi.approveInventoryAdjustment(row.id)
      notify.success(`${cfg.number(row)} ${action}d`)
      await load()
    } catch (error) {
      notify.error(errText(error, `${action} failed`))
    } finally {
      setBusyId('')
    }
  }

  const create = async () => {
    setCreating(true)
    try {
      if (kind === 'transfers') {
        if (!xfer.fromWarehouseId || !xfer.toWarehouseId || !xfer.itemId) {
          notify.error('From warehouse, to warehouse and item are required')
          return
        }
        if (xfer.fromWarehouseId === xfer.toWarehouseId) {
          notify.error('Destination warehouse must be different from the source warehouse')
          return
        }
        const qty = Number(xfer.quantity)
        if (!(qty > 0)) {
          notify.error('Quantity must be greater than zero')
          return
        }
        await documentsApi.createInventoryTransfer({
          fromWarehouseId: xfer.fromWarehouseId,
          toWarehouseId: xfer.toWarehouseId,
          transferDate: today,
          remarks: xfer.remarks.trim() || undefined,
          lines: [{ itemId: xfer.itemId, quantity: qty }],
        })
        notify.success('Transfer draft created')
        setXfer((f) => ({ ...f, quantity: '', remarks: '' }))
      } else if (kind === 'stock-counts') {
        if (!countForm.warehouseId) {
          notify.error('Warehouse is required')
          return
        }
        await documentsApi.createInventoryStockCount({
          warehouseId: countForm.warehouseId,
          countDate: today,
          remarks: countForm.remarks.trim() || undefined,
        })
        notify.success('Stock count draft created')
      } else {
        if (!adjForm.warehouseId || !adjForm.itemId) {
          notify.error('Warehouse and item are required')
          return
        }
        const qty = Number(adjForm.quantity)
        if (!Number.isFinite(qty) || qty === 0) {
          notify.error('Quantity must be a non-zero signed number')
          return
        }
        await documentsApi.createInventoryAdjustment({
          warehouseId: adjForm.warehouseId,
          adjustmentDate: today,
          reason: adjForm.reason,
          remarks: adjForm.remarks.trim() || undefined,
          lines: [{ itemId: adjForm.itemId, quantity: qty }],
        })
        notify.success('Adjustment draft created')
      }
      navigate(cfg.basePath)
    } catch (error) {
      notify.error(errText(error, 'Create failed'))
    } finally {
      setCreating(false)
    }
  }

  // ── Register chrome (standard list page — see StoreRegisterListPage) ────────
  const statusOptions = useMemo(() => {
    const set = new Set(cfg.statuses)
    for (const r of rows) set.add(r.status)
    return [
      { value: DOCUMENT_OPEN_STATUS, label: 'Open (any active)' },
      ...[...set].map((s) => ({ value: s, label: s.replaceAll('_', ' ') })),
    ]
  }, [cfg, rows])

  const filterFields = useMemo<CrmFilterField[]>(() => [
    { type: 'section', label: 'Status & workflow' },
    { type: 'select', key: 'status', label: 'Status', options: statusOptions },
    { type: 'section', label: 'Location' },
    {
      type: 'select',
      key: 'warehouseId',
      label: kind === 'transfers' ? 'Warehouse (from or to)' : 'Warehouse',
      options: warehouses.map((w) => ({ value: w.id, label: w.label })),
    },
    { type: 'section', label: 'Dates' },
    { type: 'date-range', label: 'Document date', fromKey: 'dateFrom', toKey: 'dateTo' },
  ], [statusOptions, warehouses, kind])

  const chipLabelResolver = useCallback(
    (key: string, value: string) => {
      if (key === 'warehouseId') return `Warehouse: ${warehouses.find((w) => w.id === value)?.label ?? value}`
      return undefined
    },
    [warehouses],
  )

  const filtered = useMemo(() => {
    let list = [...rows]
    const dateOf = (r: ApiInventoryDocument) => (cfg.date(r) ?? r.createdAt ?? '').slice(0, 10)
    const q = (filters.search ?? '').trim().toLowerCase()
    if (q) {
      list = list.filter((r) =>
        [
          cfg.number(r),
          r.status,
          r.warehouse?.code ?? '',
          r.warehouse?.name ?? '',
          r.fromWarehouse?.code ?? '',
          r.toWarehouse?.code ?? '',
          r.remarks ?? '',
          ...(r.lines ?? []).flatMap((l) => [l.item?.code ?? '', l.item?.name ?? '']),
        ].some((v) => v.toLowerCase().includes(q)),
      )
    }
    if (filters.status === DOCUMENT_OPEN_STATUS) {
      list = list.filter((r) => !DOCUMENT_TERMINAL_STATUSES[kind].includes(r.status))
    } else if (filters.status) {
      list = list.filter((r) => r.status === filters.status)
    }
    if (filters.warehouseId) {
      list = list.filter((r) =>
        kind === 'transfers'
          ? r.fromWarehouseId === filters.warehouseId || r.toWarehouseId === filters.warehouseId
          : r.warehouseId === filters.warehouseId,
      )
    }
    if (filters.dateFrom) list = list.filter((r) => dateOf(r) >= filters.dateFrom)
    if (filters.dateTo) list = list.filter((r) => dateOf(r) <= filters.dateTo)
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    switch (sortBy) {
      case 'dateAsc':
        return list.sort((a, b) => cmp(dateOf(a), dateOf(b)))
      case 'numberAsc':
        return list.sort((a, b) => cmp(cfg.number(a), cfg.number(b)))
      case 'numberDesc':
        return list.sort((a, b) => cmp(cfg.number(b), cfg.number(a)))
      case 'status':
        return list.sort((a, b) => cmp(a.status, b.status))
      case 'dateDesc':
      default:
        return list.sort((a, b) => cmp(dateOf(b), dateOf(a)) || cmp(cfg.number(b), cfg.number(a)))
    }
  }, [rows, filters, sortBy, cfg, kind])

  const columns = useMemo<ColumnDef<ApiInventoryDocument, unknown>[]>(() => [
    {
      id: 'number',
      header: 'Document',
      accessorFn: (r) => cfg.number(r),
      cell: ({ row }) =>
        kind === 'stock-counts' ? (
          <Link className="font-mono font-semibold text-erp-primary hover:underline" to={`/inventory/stock-count/${row.original.id}`}>
            {cfg.number(row.original)}
          </Link>
        ) : (
          <span className="font-mono font-semibold">{cfg.number(row.original)}</span>
        ),
    },
    {
      id: 'date',
      header: 'Date',
      accessorFn: (r) => cfg.date(r) ?? '',
      cell: ({ row }) => (cfg.date(row.original) ? formatDate(cfg.date(row.original)!) : '-'),
    },
    {
      id: 'location',
      header: kind === 'transfers' ? 'Route' : 'Warehouse',
      accessorFn: (r) =>
        kind === 'transfers'
          ? `${r.fromWarehouse?.code ?? ''} ${r.toWarehouse?.code ?? ''}`
          : r.warehouse?.code ?? '',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {kind === 'transfers'
            ? `${row.original.fromWarehouse?.code ?? row.original.fromWarehouseId?.slice(0, 8) ?? '-'} → ${row.original.toWarehouse?.code ?? row.original.toWarehouseId?.slice(0, 8) ?? '-'}`
            : row.original.warehouse?.code ?? row.original.warehouseId?.slice(0, 8) ?? '-'}
        </span>
      ),
    },
    {
      id: 'items',
      header: 'Items · Qty',
      enableSorting: false,
      cell: ({ row }) => {
        const lines = row.original.lines ?? []
        if (lines.length === 0) {
          return <span className="text-erp-muted">{kind === 'stock-counts' ? 'No snapshot yet' : '-'}</span>
        }
        const shown = lines.slice(0, 3)
        return (
          <div className="flex flex-wrap items-center gap-1">
            {shown.map((line) => (
              <span
                key={line.id}
                className="whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700"
                title={line.item ? `${line.item.code} · ${line.item.name}` : line.itemId}
              >
                {documentLineSummary(kind, line)}
              </span>
            ))}
            {lines.length > shown.length ? (
              <span className="text-[11px] text-erp-muted">+{lines.length - shown.length} more</span>
            ) : null}
          </div>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => r.status,
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.status}</span>,
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const doc = row.original
        const hasAction =
          cfg.postable.includes(doc.status)
          || (kind === 'transfers' && ['DRAFT', 'SUBMITTED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(doc.status))
          || (kind === 'adjustments' && ['DRAFT', 'SUBMITTED', 'POSTED'].includes(doc.status))
          || kind === 'stock-counts'
        return (
          <div className="flex justify-end gap-2">
            {kind === 'transfers' && doc.status === 'DRAFT' ? (
              <Button size="sm" disabled={busyId === doc.id} onClick={() => void advanceTransfer(doc, 'submit')}>Submit</Button>
            ) : null}
            {kind === 'transfers' && doc.status === 'SUBMITTED' ? (
              <Button size="sm" disabled={busyId === doc.id} onClick={() => void advanceTransfer(doc, 'approve')}>Approve</Button>
            ) : null}
            {kind === 'adjustments' && doc.status === 'DRAFT' && perms.canSubmitAdjustment ? (
              <Button size="sm" disabled={busyId === doc.id} onClick={() => void advanceAdjustment(doc, 'submit')}>Submit</Button>
            ) : null}
            {kind === 'adjustments' && doc.status === 'SUBMITTED' && perms.canApproveAdjustment ? (
              <Button size="sm" disabled={busyId === doc.id} onClick={() => void advanceAdjustment(doc, 'approve')}>Approve</Button>
            ) : null}
            {kind === 'stock-counts' ? (
              <Link to={`/inventory/stock-count/${doc.id}`}>
                <Button size="sm" variant="secondary">Open</Button>
              </Link>
            ) : null}
            {cfg.postable.includes(doc.status) && kind !== 'stock-counts' ? (
              <Button size="sm" disabled={busyId === doc.id} onClick={() => void post(doc)}>
                {busyId === doc.id ? '…' : kind === 'transfers' ? 'Dispatch' : 'Post'}
              </Button>
            ) : null}
            {kind === 'adjustments' && doc.status === 'POSTED' && perms.canApproveAdjustment ? (
              <Button size="sm" variant="secondary" disabled={busyId === doc.id} onClick={() => void advanceAdjustment(doc, 'reverse')}>Reverse</Button>
            ) : null}
            {kind === 'transfers' && (doc.status === 'IN_TRANSIT' || doc.status === 'PARTIALLY_RECEIVED') ? (
              <Button size="sm" disabled={busyId === doc.id} onClick={() => void advanceTransfer(doc, 'receive')}>Receive</Button>
            ) : null}
            {!hasAction ? <span className="text-erp-muted">-</span> : null}
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- action callbacks are re-created per render by design
  ], [cfg, kind, busyId, perms])

  // Legacy quick-create links (?create=1) now open the dedicated form page.
  if (!isNewRoute && searchParams.get('create') === '1') {
    return <Navigate to={{ pathname: `${cfg.basePath}/new`, search: location.search }} replace />
  }

  if (isNewRoute) {
    return (
      <ErpCardFormPage
        variant="dynamics"
        badge="Store"
        title={cfg.createTitle}
        description={
          kind === 'transfers'
            ? 'Move stock from one warehouse to another - saved as a draft, then submit, approve, dispatch and receive.'
            : kind === 'stock-counts'
              ? 'Physical stock count - saved as a draft, then snapshot, count, approve and post.'
              : 'Correct on-hand quantity - saved as a draft, then submit, approve and post.'
        }
        favoritePath={`${cfg.basePath}/new`}
        backLink={{ to: cfg.basePath, label: `Back to ${cfg.title}` }}
        stickyFooter
        footer={(
          <ErpStickySaveBar
            sticky
            submitLabel="Save"
            isSubmitting={creating}
            onSave={() => void create()}
            cancelTo={cfg.basePath}
            cancelLabel="Cancel"
            hint="Saves a DRAFT document. Submit, approve and post from the register."
          />
        )}
        onSaveShortcut={() => void create()}
      >
        {kind === 'transfers' ? (
          <ErpCardSection title="Transfer Details">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="From Warehouse" required>
                <Select value={xfer.fromWarehouseId} onChange={(e) => setXfer((f) => ({ ...f, fromWarehouseId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                </Select>
              </FormField>
              <FormField label="To Warehouse" required>
                <Select value={xfer.toWarehouseId} onChange={(e) => setXfer((f) => ({ ...f, toWarehouseId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Item" required>
                <Select value={xfer.itemId} onChange={(e) => setXfer((f) => ({ ...f, itemId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </Select>
              </FormField>
              <FormField label={sourceBalance?.primaryUomCode ? `Quantity (${sourceBalance.primaryUomCode})` : 'Quantity'} required>
                <Input type="number" min={0.001} step="any" value={xfer.quantity} onChange={(e) => setXfer((f) => ({ ...f, quantity: e.target.value }))} />
              </FormField>
              <FormField label="Remarks" className="sm:col-span-2">
                <Textarea rows={2} value={xfer.remarks} onChange={(e) => setXfer((f) => ({ ...f, remarks: e.target.value }))} />
              </FormField>
            </div>
            {xfer.itemId ? (
              <div className="mt-3 rounded-md border border-erp-border bg-slate-50 px-3 py-2.5 text-[13px]">
                {!xfer.fromWarehouseId ? (
                  <span className="text-erp-muted">Select a From warehouse to see how much stock is available to transfer.</span>
                ) : balanceLoading ? (
                  <span className="text-erp-muted">Checking availability at source warehouse…</span>
                ) : sourceBalance ? (
                  (() => {
                    const free = num(sourceBalance.freeQty)
                    const inTransit = num(sourceBalance.inTransitQty)
                    const uom = sourceBalance.primaryUomCode || ''
                    const wanted = Number(xfer.quantity)
                    const exceeds = Number.isFinite(wanted) && wanted > 0 && wanted > free
                    const itemLabel = sourceBalance.item
                      ? `${sourceBalance.item.code} · ${sourceBalance.item.name}`
                      : items.find((i) => i.id === xfer.itemId)?.label ?? ''
                    const q = (v: string | number | null | undefined) => `${fmtQty(v)}${uom ? ` ${uom}` : ''}`
                    return (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-erp-text">{itemLabel}</span>
                          {uom ? (
                            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                              Stock UOM: {uom}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                          <span>
                            <span className="text-[11px] uppercase tracking-wide text-erp-muted">On hand </span>
                            <strong className="tabular-nums">{q(sourceBalance.onHandQty)}</strong>
                          </span>
                          <span>
                            <span className="text-[11px] uppercase tracking-wide text-erp-muted">Reserved </span>
                            <strong className="tabular-nums">{q(sourceBalance.reservedQty)}</strong>
                          </span>
                          {inTransit > 0 ? (
                            <span>
                              <span className="text-[11px] uppercase tracking-wide text-erp-muted">In transit (out) </span>
                              <strong className="tabular-nums">{q(inTransit)}</strong>
                            </span>
                          ) : null}
                          <span>
                            <span className="text-[11px] uppercase tracking-wide text-erp-muted">Available to transfer </span>
                            <strong className={`tabular-nums ${free <= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{q(free)}</strong>
                          </span>
                        </div>
                        {exceeds ? (
                          <div className="font-medium text-rose-600">
                            Quantity exceeds available stock - dispatch will be blocked unless stock arrives first.
                          </div>
                        ) : free <= 0 ? (
                          <div className="font-medium text-rose-600">No free stock at the source warehouse.</div>
                        ) : null}
                      </div>
                    )
                  })()
                ) : null}
              </div>
            ) : null}
          </ErpCardSection>
        ) : kind === 'stock-counts' ? (
          <ErpCardSection title="Stock Count Details">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Warehouse" required>
                <Select value={countForm.warehouseId} onChange={(e) => setCountForm((f) => ({ ...f, warehouseId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Remarks">
                <Input value={countForm.remarks} onChange={(e) => setCountForm((f) => ({ ...f, remarks: e.target.value }))} />
              </FormField>
            </div>
          </ErpCardSection>
        ) : (
          <ErpCardSection title="Adjustment Details">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Warehouse" required>
                <Select value={adjForm.warehouseId} onChange={(e) => setAdjForm((f) => ({ ...f, warehouseId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Item" required>
                <Select value={adjForm.itemId} onChange={(e) => setAdjForm((f) => ({ ...f, itemId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Quantity (+/−)" required>
                <Input type="number" step="any" value={adjForm.quantity} onChange={(e) => setAdjForm((f) => ({ ...f, quantity: e.target.value }))} />
              </FormField>
              <FormField label="Reason" required>
                <Input value={adjForm.reason} onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))} />
              </FormField>
              <FormField label="Remarks" className="sm:col-span-2">
                <Textarea rows={2} value={adjForm.remarks} onChange={(e) => setAdjForm((f) => ({ ...f, remarks: e.target.value }))} />
              </FormField>
            </div>
          </ErpCardSection>
        )}
      </ErpCardFormPage>
    )
  }

  return (
    <StoreRegisterListPage<ApiInventoryDocument>
      pageId={cfg.basePath}
      title={cfg.title}
      description={
        kind === 'transfers'
          ? 'Warehouse → warehouse moves — create, dispatch, track In Transit, then receive.'
          : kind === 'stock-counts'
            ? 'Physical stock count — create, count, approve variance, then post.'
            : 'Correct on-hand quantity — create, approve if needed, then post.'
      }
      rows={filtered}
      totalRowCount={rows.length}
      columns={columns}
      getRowId={(r) => r.id}
      loading={loading}
      searchPlaceholder={`Search ${cfg.title.toLowerCase()}, item, warehouse…`}
      sortOptions={DOCUMENT_SORT_OPTIONS}
      sortBy={sortBy}
      onSortChange={setSortBy}
      filters={filters}
      defaultFilters={DOCUMENT_DEFAULT_FILTERS}
      onFiltersChange={setFilters}
      filterFields={filterFields}
      drawerTitle={`Filter ${cfg.title.toLowerCase()}`}
      chipLabelResolver={chipLabelResolver}
      primaryAction={
        cfg.canCreate
          ? { id: 'new', label: cfg.createTitle, icon: PackagePlus, onClick: () => navigate(`${cfg.basePath}/new`) }
          : undefined
      }
      secondaryActions={[
        ...(kind === 'transfers'
          ? [
              {
                id: 'open-transfers',
                label: 'Open Transfers',
                icon: ClipboardList,
                onClick: () => setFilters((f) => ({ ...f, status: DOCUMENT_OPEN_STATUS })),
              },
              {
                id: 'wip-moves',
                label: 'WIP / Production Moves',
                icon: Factory,
                onClick: () => navigate('/manufacturing/store-workbench'),
              },
            ]
          : []),
        { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
      ]}
      emptyIcon={FileCheck2}
      emptyTitle={`No ${cfg.title.toLowerCase()}`}
      emptyDescription="Use the New button to create a draft and start a live document workflow."
      emptyAction={
        cfg.canCreate ? (
          <Button size="sm" onClick={() => navigate(`${cfg.basePath}/new`)}>
            <PackagePlus className="h-4 w-4" /> {cfg.createTitle}
          </Button>
        ) : undefined
      }
    />
  )
}
