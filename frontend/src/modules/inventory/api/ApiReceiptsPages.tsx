/**
 * Live inventory receipts (API mode).
 * Backend has no draft multi-line receipt documents — receipts are posted
 * stock movements (`POST /inventory/movements/inward`) and listed from the
 * stock ledger (`movementType=INWARD`). PO goods receipts live under Purchase GRN.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, PackagePlus, RefreshCw, Lock } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { notify } from '@/store/toastStore'
import { fetchLookup } from '@/services/api/masterApi'
import {
  getInventoryLedgerMovement,
  getInventoryPosition,
  listInventoryLedger,
  postInwardStock,
  type InventoryStockBalance,
  type InventoryStockMovement,
} from '@/services/api/inventoryApi'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { formatDate } from '@/utils/dates/format'

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

/** Posted inward movements register (live stock receipts). */
export function ApiReceiptsRegisterPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [searchParams] = useSearchParams()
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const [itemId, setItemId] = useState(searchParams.get('itemId') ?? '')
  const [warehouseId, setWarehouseId] = useState(searchParams.get('warehouseId') ?? '')
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
        movementType: 'INWARD',
        itemId: itemId || undefined,
        warehouseId: warehouseId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      })
      setRows(res.data ?? [])
      const m = res.meta as PageMeta | undefined
      setMeta(m ? { page: m.page, totalPages: m.totalPages, total: m.total } : null)
    } catch {
      notify.error('Could not load receipts')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, itemId, warehouseId, fromDate, toDate])

  useEffect(() => {
    void load()
  }, [load])

  if (!perms.canViewReceipts && !perms.canViewStock && !perms.canViewItemLedger) {
    return <AccessDenied title="Receipts" />
  }

  const resetPageAnd = <T,>(setter: (v: T) => void) => (v: T) => {
    setPage(1)
    setter(v)
  }

  return (
    <div className="erp-page">
      <PageHeader
        title="Receipts"
        description="Live inward stock movements posted to the inventory ledger. Purchase-order receipts are posted via Purchase GRN."
        breadcrumbs={[{ label: 'Inventory', to: '/inventory/stock' }, { label: 'Receipts' }]}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/purchase/grn')}>
              Open GRN
            </Button>
            {perms.canPostReceipt ? (
              <Button size="sm" onClick={() => navigate('/inventory/movements/receipts/new')}>
                <PackagePlus className="h-4 w-4" /> New Receipt
              </Button>
            ) : null}
          </div>
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
          From
          <Input type="date" className="w-36" value={fromDate} onChange={(e) => resetPageAnd(setFromDate)(e.target.value)} />
        </label>
        <label className="text-[11px] text-erp-muted">
          To
          <Input type="date" className="w-36" value={toDate} onChange={(e) => resetPageAnd(setToDate)(e.target.value)} />
        </label>
      </div>

      <SectionCard title="Inward movements" noPadding>
        {loading ? (
          <div className="p-6"><LoadingState variant="table" rows={8} /></div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ArrowDownToLine}
              title="No stock received yet"
              description="For purchase orders use Purchase → GRN (stock updates automatically). Use Direct Receive only for non-PO inward."
              action={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => navigate('/purchase/grn')}>
                    Open Purchase GRN
                  </Button>
                  {perms.canPostReceipt ? (
                    <Button size="sm" onClick={() => navigate('/inventory/movements/receipts/new')}>
                      <PackagePlus className="h-4 w-4" /> Direct Receive
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
                          to={`/inventory/movements/receipts/${m.id}`}
                          className="font-mono font-semibold text-erp-primary hover:underline"
                        >
                          {m.movementNumber}
                        </Link>
                      </td>
                      <td>
                        {m.referenceType}
                        {m.referenceNo ? <span className="text-erp-muted"> · {m.referenceNo}</span> : null}
                      </td>
                      <td>{refLabel(m.item, m.itemId)}</td>
                      <td>{refLabel(m.warehouse, m.warehouseId)}</td>
                      <td className="text-right tabular-nums font-semibold text-emerald-700">{fmtQty(m.quantity)}</td>
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
    </div>
  )
}

/** Immediate inward post — live stock receipt. */
export function ApiReceiptPostPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
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
    if (!Number.isFinite(qty) || qty <= 0) {
      notify.error('Quantity must be greater than zero')
      return
    }
    setBusy(true)
    try {
      const res = await postInwardStock({
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        quantity: qty,
        rate: form.rate ? Number(form.rate) : undefined,
        movementDate: form.movementDate || undefined,
        referenceNo: form.referenceNo.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
      })
      notify.success(`Receipt posted — ${res.data.movementNumber}`)
      navigate(`/inventory/movements/receipts/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Posting failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canPostReceipt) return <AccessDenied title="New Receipt" />

  return (
    <div className="erp-page">
      <PageHeader
        title="New Receipt"
        description="Posts an inward movement to live stock. For purchase-order receipts use Purchase GRN."
        breadcrumbs={[
          { label: 'Inventory', to: '/inventory/stock' },
          { label: 'Receipts', to: '/inventory/movements/receipts' },
          { label: 'New' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Receipt">
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
              <FormField label="Rate (₹, optional)">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.rate}
                  onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                />
              </FormField>
              <FormField label="Receipt Date">
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
              <Button variant="secondary" onClick={() => navigate('/inventory/movements/receipts')}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => void submit()}>
                {busy ? 'Posting…' : 'Post Receipt'}
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
          <SectionCard title="Also available">
            <ul className="space-y-1 text-[12px]">
              <li>
                <Link to="/purchase/grn" className="font-semibold text-erp-primary hover:underline">Purchase GRN</Link>
                {' '}— PO goods receipt
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

/** Single posted inward movement. */
export function ApiReceiptDetailPage() {
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
        if (!m || m.movementType !== 'INWARD') {
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

  if (!perms.canViewReceipts && !perms.canViewStock && !perms.canViewItemLedger) {
    return <AccessDenied title="Receipt" />
  }

  if (loading) {
    return (
      <div className="erp-page">
        <PageHeader title="Receipt" breadcrumbs={[{ label: 'Inventory' }, { label: 'Receipts', to: '/inventory/movements/receipts' }]} />
        <LoadingState variant="table" />
      </div>
    )
  }

  if (missing || !row) {
    return (
      <div className="erp-page">
        <PageHeader title="Receipt" breadcrumbs={[{ label: 'Inventory' }, { label: 'Receipts', to: '/inventory/movements/receipts' }]} />
        <EmptyState
          icon={ArrowDownToLine}
          title="Receipt not found"
          description="This movement is missing or is not an inward receipt."
          action={(
            <Button size="sm" onClick={() => navigate('/inventory/movements/receipts')}>
              Back to Receipts
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
        description={`Inward receipt · ${formatDate(row.movementDate)}`}
        breadcrumbs={[
          { label: 'Inventory', to: '/inventory/stock' },
          { label: 'Receipts', to: '/inventory/movements/receipts' },
          { label: row.movementNumber },
        ]}
        actions={(
          <Button size="sm" variant="secondary" onClick={() => navigate('/inventory/movements/receipts')}>
            Back to list
          </Button>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Movement">
          <dl className="grid gap-3 sm:grid-cols-2 text-[13px]">
            <div><dt className="text-erp-muted">Item</dt><dd>{refLabel(row.item, row.itemId)}</dd></div>
            <div><dt className="text-erp-muted">Warehouse</dt><dd>{refLabel(row.warehouse, row.warehouseId)}</dd></div>
            <div><dt className="text-erp-muted">Quantity</dt><dd className="font-mono font-semibold text-emerald-700">{fmtQty(row.quantity)}</dd></div>
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

/** Draft receipt editors do not exist in live mode — redirect to post or list. */
export function ApiReceiptEditRedirect() {
  return <Navigate to="/inventory/movements/receipts/new" replace />
}
