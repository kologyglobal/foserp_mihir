/**
 * Live inventory returns (API mode).
 * Backend has no draft multi-line return documents — returns from shopfloor are
 * posted via `POST /inventory/movements/return-from-work-order` and listed from
 * the stock ledger (`referenceType=RETURN_FROM_WO`). WO material returns also
 * run from the Work Order Materials tab.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Lock, PackagePlus, RotateCcw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCardFormPage, ErpCardSection, ErpStickySaveBar } from '@/components/erp/card-form'
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
import { listWorkOrders } from '@/services/api/manufacturingApi'
import {
  getInventoryLedgerMovement,
  getInventoryPosition,
  postReturnFromWorkOrder,
  type InventoryStockBalance,
  type InventoryStockMovement,
} from '@/services/api/inventoryApi'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { formatDate } from '@/utils/dates/format'
import { StoreMovementRegisterPage } from '../shared/StoreMovementRegisterPage'

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
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title={title}
      breadcrumbs={[{ label: 'Store', to: '/inventory' }, { label: title }]}
      autoBreadcrumbs={false}
    >
      <EmptyState icon={Lock} title="Access denied" description="You do not hold the required inventory permission." />
    </OperationalPageShell>
  )
}

function isReturnMovement(m: InventoryStockMovement): boolean {
  return m.referenceType === 'RETURN_FROM_WO'
}

/** Posted return-from-WO movements register. */
export function ApiReturnsRegisterPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()

  if (!perms.canViewReturns && !perms.canViewStock && !perms.canViewItemLedger) {
    return <AccessDenied title="Returns" />
  }

  return (
    <StoreMovementRegisterPage
      pageId="/inventory/movements/returns"
      title="Returns"
      description="Live material returns from work orders. You can also return from the Work Order Materials tab."
      query={{ referenceType: 'RETURN_FROM_WO' }}
      detailPathBase="/inventory/movements/returns"
      referenceHeader="Work Order"
      referenceCell={(m) =>
        m.workOrderId ? (
          <Link
            to={`/manufacturing/work-orders/${m.workOrderId}`}
            className="font-mono text-[12px] text-erp-primary hover:underline"
          >
            {m.referenceNo ?? m.workOrderId.slice(0, 8)}
          </Link>
        ) : (
          <span className="font-mono text-[12px]">{m.referenceNo ?? '-'}</span>
        )
      }
      primaryAction={
        perms.canPostReturn || perms.canCreateReturn
          ? {
              id: 'new',
              label: 'New Return',
              icon: PackagePlus,
              onClick: () => navigate('/inventory/movements/returns/new'),
            }
          : undefined
      }
      secondaryActions={[
        { id: 'wo', label: 'Open Work Orders', onClick: () => navigate('/manufacturing/work-orders') },
      ]}
      emptyIcon={RotateCcw}
      emptyTitle="No returns posted yet"
      emptyDescription="Post a return from work order here, or use the Work Order Materials tab."
      emptyAction={
        perms.canPostReturn || perms.canCreateReturn ? (
          <Button size="sm" onClick={() => navigate('/inventory/movements/returns/new')}>
            <PackagePlus className="h-4 w-4" /> New Return
          </Button>
        ) : undefined
      }
    />
  )
}

/** Immediate return-from-WO post. */
export function ApiReturnPostPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const items = useLookupOptions('items')
  const warehouses = useLookupOptions('warehouses')
  const workOrders = useWorkOrderOptions()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    workOrderId: '',
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
    if (!form.workOrderId || !form.itemId || !form.warehouseId) {
      notify.error('Work order, item and warehouse are required')
      return
    }
    const qty = Number(form.quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      notify.error('Quantity must be greater than zero')
      return
    }
    setBusy(true)
    try {
      const woLabel = workOrders.find((w) => w.id === form.workOrderId)?.label
      const res = await postReturnFromWorkOrder({
        workOrderId: form.workOrderId,
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        quantity: qty,
        rate: form.rate ? Number(form.rate) : undefined,
        movementDate: form.movementDate || undefined,
        referenceNo: form.referenceNo.trim() || woLabel?.split(' — ')[0] || undefined,
        remarks: form.remarks.trim() || undefined,
      })
      notify.success(`Return posted — ${res.data.movementNumber}`)
      navigate(`/inventory/movements/returns/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Posting failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canPostReturn && !perms.canCreateReturn) return <AccessDenied title="New Return" />

  return (
    <ErpCardFormPage
      variant="dynamics"
      badge="Store"
      title="New Return"
      description="Posts a return-from-work-order movement to live stock."
      favoritePath="/inventory/movements/returns/new"
      backLink={{ to: '/inventory/movements/returns', label: 'Back to Returns' }}
      stickyFooter
      footer={(
        <ErpStickySaveBar
          sticky
          submitLabel="Post Return"
          isSubmitting={busy}
          onSave={() => void submit()}
          cancelTo="/inventory/movements/returns"
          cancelLabel="Cancel"
          hint="Posts the return-from-work-order movement to live stock immediately."
        />
      )}
      onSaveShortcut={() => void submit()}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ErpCardSection title="Return">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Work Order" required className="sm:col-span-2">
                <Select value={form.workOrderId} onChange={(e) => setForm((f) => ({ ...f, workOrderId: e.target.value }))}>
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {workOrders.map((w) => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </Select>
              </FormField>
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
              <FormField label="Return Date">
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
          <ErpCardSection title="Also available">
            <ul className="space-y-1 text-[12px]">
              <li>
                <Link to="/manufacturing/work-orders" className="font-semibold text-erp-primary hover:underline">Work Orders</Link>
                {' '}— materials return from WO
              </li>
              <li>
                <Link to="/inventory/ledger" className="font-semibold text-erp-primary hover:underline">Stock Ledger</Link>
                {' '}— all movement types
              </li>
            </ul>
          </ErpCardSection>
        </div>
      </div>
    </ErpCardFormPage>
  )
}

/** Single posted return-from-WO movement. */
export function ApiReturnDetailPage() {
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
        if (!m || !isReturnMovement(m)) {
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

  if (!perms.canViewReturns && !perms.canViewStock && !perms.canViewItemLedger) {
    return <AccessDenied title="Return" />
  }

  if (loading) {
    return (
      <div className="erp-page">
        <PageHeader title="Return" breadcrumbs={[{ label: 'Store' }, { label: 'Returns', to: '/inventory/movements/returns' }]} />
        <LoadingState variant="table" />
      </div>
    )
  }

  if (missing || !row) {
    return (
      <div className="erp-page">
        <PageHeader title="Return" breadcrumbs={[{ label: 'Store' }, { label: 'Returns', to: '/inventory/movements/returns' }]} />
        <EmptyState
          icon={RotateCcw}
          title="Return not found"
          description="This movement is missing or is not a work-order return."
          action={(
            <Button size="sm" onClick={() => navigate('/inventory/movements/returns')}>
              Back to Returns
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
        description={`Return from work order · ${formatDate(row.movementDate)}`}
        breadcrumbs={[
          { label: 'Store', to: '/inventory/stock' },
          { label: 'Returns', to: '/inventory/movements/returns' },
          { label: row.movementNumber },
        ]}
        actions={(
          <Button size="sm" variant="secondary" onClick={() => navigate('/inventory/movements/returns')}>
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
            <div>
              <dt className="text-erp-muted">Work order</dt>
              <dd>
                {row.workOrderId ? (
                  <Link to={`/manufacturing/work-orders/${row.workOrderId}`} className="font-mono text-erp-primary hover:underline">
                    {row.referenceNo ?? row.workOrderId.slice(0, 8)}
                  </Link>
                ) : (
                  row.referenceNo ?? '-'
                )}
              </dd>
            </div>
            <div><dt className="text-erp-muted">Posted at</dt><dd>{formatDate(row.createdAt)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-erp-muted">Remarks</dt><dd>{row.remarks?.trim() || '-'}</dd></div>
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
            {row.workOrderId ? (
              <li>
                <Link
                  to={`/manufacturing/work-orders/${row.workOrderId}`}
                  className="font-semibold text-erp-primary hover:underline"
                >
                  Open Work Order →
                </Link>
              </li>
            ) : null}
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}

/** Draft return editors do not exist in live mode — redirect to post. */
export function ApiReturnEditRedirect() {
  return <Navigate to="/inventory/movements/returns/new" replace />
}
