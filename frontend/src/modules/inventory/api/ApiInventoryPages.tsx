/**
 * Inventory Phase 3A live pages (API mode only).
 * Stock balances, stock ledger, reservations, and immediate movement posts
 * against /inventory/* — the physical stock source of truth. Demo mode keeps
 * the original store-backed inventory workspace.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Boxes, ClipboardList, FileCheck2, Lock, PackagePlus, RefreshCw, Warehouse } from 'lucide-react'
import { PageHeader } from '../../../components/ui/PageHeader'
import { SectionCard } from '../../../components/ui/SectionCard'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { SearchInput } from '../../../components/ui/SearchInput'
import { LoadingState } from '../../../design-system/components/LoadingState'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Textarea } from '../../../components/forms/Inputs'
import { notify } from '../../../store/toastStore'
import { appPromptNote } from '../../../store/confirmDialogStore'
import { fetchLookup } from '../../../services/api/masterApi'
import {
  cancelInventoryReservation,
  createInventoryReservation,
  getInventoryPosition,
  listInventoryBalances,
  listInventoryLedger,
  listInventoryReservations,
  postInwardStock,
  postIssueStock,
  postOpeningStock,
  postStockAdjustment,
  type InventoryMovementType,
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
import type { ApiInventoryDocument } from '../../../services/api/inventoryDocumentsApi'

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

// ─── Stock balances register ──────────────────────────────────────────────────

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
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock' }]}
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

const MOVEMENT_TYPES: InventoryMovementType[] = ['OPENING', 'INWARD', 'ISSUE', 'ADJUSTMENT']

export function ApiStockLedgerPage() {
  const perms = useInventoryPermissions()
  const [searchParams] = useSearchParams()
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const [itemId, setItemId] = useState(searchParams.get('itemId') ?? '')
  const [warehouseId, setWarehouseId] = useState(searchParams.get('warehouseId') ?? '')
  const [movementType, setMovementType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<InventoryStockMovement[]>([])
  const [meta, setMeta] = useState<PageMeta | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listInventoryLedger({
        page,
        limit: 50,
        itemId: itemId || undefined,
        warehouseId: warehouseId || undefined,
        movementType: movementType || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      })
      setRows(res.data ?? [])
      const m = res.meta as PageMeta | undefined
      setMeta(m ? { page: m.page, totalPages: m.totalPages, total: m.total } : null)
    } catch {
      notify.error('Could not load stock ledger')
    } finally {
      setLoading(false)
    }
  }, [page, itemId, warehouseId, movementType, fromDate, toDate])

  useEffect(() => {
    void load()
  }, [load])

  if (!perms.canViewItemLedger && !perms.canViewStock) return <AccessDenied title="Stock Ledger" />

  const resetPageAnd = <T,>(setter: (v: T) => void) => (v: T) => {
    setPage(1)
    setter(v)
  }

  return (
    <div className="erp-page">
      <PageHeader
        title="Stock Ledger"
        description="Live signed stock movements — opening, inward, issues and adjustments with running balance."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Ledger' }]}
        actions={(
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        )}
      />

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
          Type
          <Select wrapClassName="w-40" value={movementType} onChange={(e) => resetPageAnd(setMovementType)(e.target.value)}>
            <option value="">All types</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
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

      <SectionCard title="Movements" noPadding>
        {loading ? (
          <div className="p-6"><LoadingState variant="table" rows={8} /></div>
        ) : rows.length === 0 ? (
          <div className="p-6"><EmptyState icon={ClipboardList} title="No movements match" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="erp-table w-full min-w-[1020px] text-[13px]">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Movement #</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDate(m.movementDate)}</td>
                      <td className="font-mono">{m.movementNumber}</td>
                      <td>{m.movementType}</td>
                      <td>
                        {m.referenceType}
                        {m.referenceNo ? <span className="text-erp-muted"> · {m.referenceNo}</span> : null}
                      </td>
                      <td>{refLabel(m.item, m.itemId)}</td>
                      <td>{refLabel(m.warehouse, m.warehouseId)}</td>
                      <td className={`text-right tabular-nums font-semibold ${num(m.quantity) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {fmtQty(m.quantity)}
                      </td>
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
    </div>
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

export function ApiReservationsPage() {
  const perms = useInventoryPermissions()
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const [status, setStatus] = useState('')
  const [demandType, setDemandType] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<InventoryStockReservation[]>([])
  const [meta, setMeta] = useState<PageMeta | null>(null)
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
      const res = await listInventoryReservations({
        page,
        limit: 50,
        status: status || undefined,
        demandType: demandType || undefined,
      })
      setRows(res.data ?? [])
      const m = res.meta as PageMeta | undefined
      setMeta(m ? { page: m.page, totalPages: m.totalPages, total: m.total } : null)
    } catch {
      notify.error('Could not load reservations')
    } finally {
      setLoading(false)
    }
  }, [page, status, demandType])

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
      notify.error(e instanceof Error ? e.message : 'Reservation failed')
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
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canViewReservations && !perms.canManageReservations) return <AccessDenied title="Reservations" />

  return (
    <div className="erp-page">
      <PageHeader
        title="Stock Reservations"
        description="Live reservations against sales orders, work orders and dispatches. Fulfilment happens via issue / dispatch posting."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Reservations' }]}
        actions={(
          <div className="flex gap-2">
            {perms.canManageReservations && (
              <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
                <PackagePlus className="h-4 w-4" /> {showCreate ? 'Close form' : 'New Reservation'}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        )}
      />

      {showCreate && (
        <SectionCard title="New Reservation">
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
      )}

      <div className="mb-3 mt-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-erp-muted">
          Status
          <Select
            wrapClassName="w-40"
            value={status}
            onChange={(e) => {
              setPage(1)
              setStatus(e.target.value)
            }}
          >
            <option value="">All statuses</option>
            {RESERVATION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </label>
        <label className="text-[11px] text-erp-muted">
          Demand
          <Select
            wrapClassName="w-40"
            value={demandType}
            onChange={(e) => {
              setPage(1)
              setDemandType(e.target.value)
            }}
          >
            <option value="">All demand types</option>
            {DEMAND_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </label>
      </div>

      <SectionCard title="Reservations" noPadding>
        {loading ? (
          <div className="p-6"><LoadingState variant="table" rows={8} /></div>
        ) : rows.length === 0 ? (
          <div className="p-6"><EmptyState icon={Warehouse} title="No reservations match" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="erp-table w-full min-w-[960px] text-[13px]">
                <thead>
                  <tr>
                    <th>Reservation #</th>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th>Demand</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Fulfilled</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono">{r.reservationNumber}</td>
                      <td>{r.itemId.slice(0, 8)}</td>
                      <td>{r.warehouseId.slice(0, 8)}</td>
                      <td>
                        {r.demandType}
                        {r.referenceNo ? <span className="text-erp-muted"> · {r.referenceNo}</span> : null}
                      </td>
                      <td className="text-right tabular-nums">{fmtQty(r.quantity)}</td>
                      <td className="text-right tabular-nums">{fmtQty(r.fulfilledQty)}</td>
                      <td>{r.status}</td>
                      <td className="text-right">
                        {r.status === 'ACTIVE' && perms.canManageReservations ? (
                          <button
                            type="button"
                            className="text-[12px] font-semibold text-rose-700 hover:underline"
                            disabled={busy}
                            onClick={() => void cancelReservation(r)}
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-erp-muted">—</span>
                        )}
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
  }
> = {
  opening: {
    title: 'Opening Stock',
    description: 'Post opening balances into the live stock ledger.',
    postFn: postOpeningStock,
    showRate: true,
    signed: false,
  },
  inward: {
    title: 'Material Inward',
    description: 'Post an inward stock movement (non-GRN receipt).',
    postFn: postInwardStock,
    showRate: true,
    signed: false,
  },
  issue: {
    title: 'Material Issue',
    description: 'Post a general stock issue (work-order issues run from the WO Materials tab).',
    postFn: postIssueStock,
    showRate: false,
    signed: false,
  },
  adjustment: {
    title: 'Stock Adjustment',
    description: 'Post a signed adjustment — positive adds stock, negative removes it.',
    postFn: postStockAdjustment,
    showRate: false,
    signed: true,
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
      notify.error(e instanceof Error ? e.message : 'Posting failed')
    } finally {
      setBusy(false)
    }
  }

  if (!allowed) return <AccessDenied title={cfg.title} />

  return (
    <div className="erp-page">
      <PageHeader
        title={cfg.title}
        description={cfg.description}
        breadcrumbs={[{ label: 'Inventory' }, { label: cfg.title }]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Movement">
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
              {cfg.showRate && (
                <FormField label="Rate (₹, optional)">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={form.rate}
                    onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                  />
                </FormField>
              )}
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
            <div className="mt-3 flex justify-end">
              <Button disabled={busy} onClick={() => void submit()}>
                {busy ? 'Posting…' : `Post ${cfg.title}`}
              </Button>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-3">
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
          {lastMovement && (
            <SectionCard title="Last Posted">
              <p className="text-[13px]">
                <span className="font-mono">{lastMovement.movementNumber}</span> · {fmtQty(lastMovement.quantity)} on{' '}
                {formatDate(lastMovement.movementDate)}
              </p>
              <Link to="/inventory/ledger" className="mt-1 inline-block text-[12px] font-semibold text-erp-primary hover:underline">
                Open Stock Ledger →
              </Link>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  )
}

type DocumentKind = 'transfers' | 'adjustments' | 'stock-counts'

const DOCUMENT_CONFIG: Record<DocumentKind, {
  title: string
  number: (row: ApiInventoryDocument) => string
  date: (row: ApiInventoryDocument) => string | undefined
  load: () => Promise<unknown>
  post: (id: string) => Promise<unknown>
  postable: string[]
  canCreate: boolean
}> = {
  transfers: {
    title: 'Inventory Transfers',
    number: (row) => row.transferNumber ?? row.id.slice(0, 8),
    date: (row) => row.transferDate,
    load: () => inventoryApiFacade.listTransfers({ page: 1, limit: 100 }),
    post: inventoryApiFacade.postTransfer,
    postable: ['APPROVED'],
    canCreate: true,
  },
  adjustments: {
    title: 'Inventory Adjustments',
    number: (row) => row.adjustmentNumber ?? row.id.slice(0, 8),
    date: (row) => row.adjustmentDate,
    load: () => inventoryApiFacade.listAdjustments({ page: 1, limit: 100 }),
    post: inventoryApiFacade.postAdjustment,
    postable: ['APPROVED'],
    canCreate: true,
  },
  'stock-counts': {
    title: 'Stock Counts',
    number: (row) => row.countNumber ?? row.id.slice(0, 8),
    date: (row) => row.countDate,
    load: () => inventoryApiFacade.listStockCounts({ page: 1, limit: 100 }),
    post: inventoryApiFacade.postStockCount,
    postable: ['APPROVED'],
    canCreate: true,
  },
}

/** Lean live document register with create + post actions. */
export function ApiInventoryDocumentsPage({ kind }: { kind: DocumentKind }) {
  const cfg = DOCUMENT_CONFIG[kind]
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const [rows, setRows] = useState<ApiInventoryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [xfer, setXfer] = useState({ fromWarehouseId: '', toWarehouseId: '', itemId: '', quantity: '', remarks: '' })
  const [countForm, setCountForm] = useState({ warehouseId: '', remarks: '' })
  const [adjForm, setAdjForm] = useState({ warehouseId: '', itemId: '', quantity: '', reason: 'PHYSICAL_COUNT', remarks: '' })

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

  useEffect(() => { void load() }, [load])

  const post = async (row: ApiInventoryDocument) => {
    setBusyId(row.id)
    try {
      await cfg.post(row.id)
      notify.success(`${cfg.number(row)} posted`)
      await load()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Posting failed')
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
      notify.error(error instanceof Error ? error.message : `${action} failed`)
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
      setShowCreate(false)
      await load()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="erp-page">
      <PageHeader
        title={cfg.title}
        description={
          kind === 'transfers'
            ? 'Move stock from one warehouse to another — create, dispatch, then receive.'
            : kind === 'stock-counts'
              ? 'Physical stock count — create, count, approve variance, then post.'
              : 'Correct on-hand quantity — create, approve if needed, then post.'
        }
        breadcrumbs={[{ label: 'Inventory', to: '/inventory/stock' }, { label: cfg.title }]}
        actions={(
          <div className="flex gap-2">
            {cfg.canCreate ? (
              <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
                <PackagePlus className="h-4 w-4" /> {showCreate ? 'Close form' : 'New'}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        )}
      />

      {showCreate && kind === 'transfers' && (
        <SectionCard title="New Transfer">
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
            <FormField label="Quantity" required>
              <Input type="number" min={0.001} step="any" value={xfer.quantity} onChange={(e) => setXfer((f) => ({ ...f, quantity: e.target.value }))} />
            </FormField>
            <FormField label="Remarks" className="sm:col-span-2">
              <Textarea rows={2} value={xfer.remarks} onChange={(e) => setXfer((f) => ({ ...f, remarks: e.target.value }))} />
            </FormField>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" disabled={creating} onClick={() => void create()}>{creating ? 'Saving…' : 'Create Draft'}</Button>
          </div>
        </SectionCard>
      )}

      {showCreate && kind === 'stock-counts' && (
        <SectionCard title="New Stock Count">
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
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" disabled={creating} onClick={() => void create()}>{creating ? 'Saving…' : 'Create Draft'}</Button>
          </div>
        </SectionCard>
      )}

      {showCreate && kind === 'adjustments' && (
        <SectionCard title="New Adjustment">
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
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" disabled={creating} onClick={() => void create()}>{creating ? 'Saving…' : 'Create Draft'}</Button>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Register" noPadding className="mt-3">
        {loading ? (
          <div className="p-6"><LoadingState variant="table" rows={8} /></div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={FileCheck2} title={`No ${cfg.title.toLowerCase()}`} description="Create a draft above to start a live document workflow." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[720px] text-[13px]">
              <thead><tr><th>Document</th><th>Date</th><th>Status</th><th className="text-right">Lines</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono">{cfg.number(row)}</td>
                    <td>{cfg.date(row) ? formatDate(cfg.date(row)!) : '—'}</td>
                    <td>{row.status}</td>
                    <td className="text-right tabular-nums">{row.lines?.length ?? 0}</td>
                    <td className="text-right space-x-2">
                      {kind === 'transfers' && row.status === 'DRAFT' ? (
                        <Button size="sm" disabled={busyId === row.id} onClick={() => void advanceTransfer(row, 'submit')}>Submit</Button>
                      ) : null}
                      {kind === 'transfers' && row.status === 'SUBMITTED' ? (
                        <Button size="sm" disabled={busyId === row.id} onClick={() => void advanceTransfer(row, 'approve')}>Approve</Button>
                      ) : null}
                      {cfg.postable.includes(row.status) ? (
                        <Button size="sm" disabled={busyId === row.id} onClick={() => void post(row)}>
                          {busyId === row.id ? '…' : kind === 'transfers' ? 'Dispatch' : 'Post'}
                        </Button>
                      ) : null}
                      {kind === 'transfers' && (row.status === 'IN_TRANSIT' || row.status === 'PARTIALLY_RECEIVED') ? (
                        <Button size="sm" disabled={busyId === row.id} onClick={() => void advanceTransfer(row, 'receive')}>Receive</Button>
                      ) : null}
                      {!cfg.postable.includes(row.status)
                        && !(kind === 'transfers' && ['DRAFT', 'SUBMITTED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(row.status))
                        ? <span className="text-erp-muted">—</span>
                        : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
