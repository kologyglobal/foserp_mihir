/**
 * Live inventory receipts (API mode).
 * Backend has no draft multi-line receipt documents — receipts are posted
 * stock movements (`POST /inventory/movements/inward`) and listed from the
 * stock ledger (`movementType=INWARD`). PO goods receipts live under Purchase GRN.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowDownToLine, PackagePlus, Lock } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpCardFormPage, ErpCardSection, ErpStickySaveBar } from '@/components/erp/card-form'
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
  postInwardStock,
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

/** Posted inward movements register (live stock receipts). */
export function ApiReceiptsRegisterPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()

  if (!perms.canViewReceipts && !perms.canViewStock && !perms.canViewItemLedger) {
    return <AccessDenied title="Receipts" />
  }

  return (
    <StoreMovementRegisterPage
      pageId="/inventory/movements/receipts"
      title="Receipts"
      description="Live inward stock movements. Purchase-order receipts post via Purchase GRN."
      query={{ movementType: 'INWARD' }}
      detailPathBase="/inventory/movements/receipts"
      referenceHeader="Reference"
      referenceCell={(m) => (
        <span>
          {m.referenceType}
          {m.referenceNo ? <span className="text-erp-muted"> · {m.referenceNo}</span> : null}
        </span>
      )}
      primaryAction={
        perms.canPostReceipt
          ? {
              id: 'new',
              label: 'Direct Receive',
              icon: PackagePlus,
              onClick: () => navigate('/inventory/movements/receipts/new'),
            }
          : undefined
      }
      secondaryActions={[
        { id: 'grn', label: 'Open GRN', onClick: () => navigate('/purchase/grn') },
      ]}
      emptyIcon={ArrowDownToLine}
      emptyTitle="No stock received yet"
      emptyDescription="For purchase orders use Purchase → GRN (stock updates automatically). Use Direct Receive only for non-PO inward."
      emptyAction={(
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/purchase/grn')}>
            Open Purchase GRN
          </Button>
          {perms.canPostReceipt ? (
            <Button size="sm" onClick={() => navigate('/inventory/movements/receipts/new')}>
              <PackagePlus className="h-4 w-4" /> Direct Receive
            </Button>
          ) : null}
        </div>
      )}
    />
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

  if (!perms.canPostReceipt) return <AccessDenied title="Direct Receive" />

  return (
    <ErpCardFormPage
      variant="dynamics"
      badge="Store"
      title="Direct Receive"
      description="Posts an inward movement to live stock. For purchase-order receipts use Purchase GRN."
      favoritePath="/inventory/movements/receipts/new"
      backLink={{ to: '/inventory/movements/receipts', label: 'Back to Receipts' }}
      stickyFooter
      footer={(
        <ErpStickySaveBar
          sticky
          submitLabel="Post Receipt"
          isSubmitting={busy}
          onSave={() => void submit()}
          cancelTo="/inventory/movements/receipts"
          cancelLabel="Cancel"
          hint="Posts the inward movement to live stock immediately."
        />
      )}
      onSaveShortcut={() => void submit()}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ErpCardSection title="Receipt">
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
                <Link to="/purchase/grn" className="font-semibold text-erp-primary hover:underline">Purchase GRN</Link>
                {' '}— PO goods receipt
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
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Store"
        title="Receipt"
        breadcrumbs={[
          { label: 'Store', to: '/inventory' },
          { label: 'Receipts', to: '/inventory/movements/receipts' },
          { label: 'Receipt' },
        ]}
        autoBreadcrumbs={false}
      >
        <LoadingState variant="table" />
      </OperationalPageShell>
    )
  }

  if (missing || !row) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Store"
        title="Receipt"
        breadcrumbs={[
          { label: 'Store', to: '/inventory' },
          { label: 'Receipts', to: '/inventory/movements/receipts' },
          { label: 'Receipt' },
        ]}
        autoBreadcrumbs={false}
      >
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
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title={row.movementNumber}
      description={`Inward receipt · ${formatDate(row.movementDate)}`}
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Receipts', to: '/inventory/movements/receipts' },
        { label: row.movementNumber },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/inventory/movements/receipts/${row.id}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'back', label: 'Back to list', onClick: () => navigate('/inventory/movements/receipts') },
            {
              id: 'ledger',
              label: 'Stock Ledger',
              onClick: () => navigate(`/inventory/ledger?itemId=${row.itemId}&warehouseId=${row.warehouseId}`),
            },
          ]}
        />
      )}
    >
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
            <li>
              <Link
                to={`/inventory/stock?search=${encodeURIComponent(row.item?.code ?? '')}`}
                className="font-semibold text-erp-primary hover:underline"
              >
                View stock balances →
              </Link>
            </li>
            {perms.canViewCost ? (
              <li>
                <Link
                  to={`/inventory/costing/entries?movementId=${encodeURIComponent(row.id)}`}
                  className="font-semibold text-erp-primary hover:underline"
                >
                  Receipt cost / valuation →
                </Link>
              </li>
            ) : null}
          </ul>
        </SectionCard>
      </div>
    </OperationalPageShell>
  )
}

/** Draft receipt editors do not exist in live mode — redirect to post or list. */
export function ApiReceiptEditRedirect() {
  return <Navigate to="/inventory/movements/receipts/new" replace />
}
