import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getItemById, getInventoryAuditTrail, getStockDetails, deactivateItem, duplicateItem } from '@/services/inventory'
import type { InventoryAuditEntry, InventoryItem, StockDetailsData } from '@/types/inventoryDomain'
import { INVENTORY_ITEM_TYPE_LABELS, trackingLabel } from '@/utils/inventoryItemLabels'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { ReservationsPanel } from '@/components/inventory/ReservationsPanel'
import { TraceabilityDrawer } from '@/components/inventory/TraceabilityDrawer'
import { BATCH_STATUS_LABELS } from '@/utils/inventoryTraceabilityLabels'
import { useInventoryPermissions } from '@/utils/permissions/inventory'

export function InventoryItemDetailPage() {
  const { id, itemId } = useParams()
  const recordId = id ?? itemId
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [stock, setStock] = useState<StockDetailsData | null>(null)
  const [audit, setAudit] = useState<InventoryAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [traceOpen, setTraceOpen] = useState(false)

  useEffect(() => {
    if (!recordId) return
    Promise.all([getItemById(recordId), getStockDetails(recordId), getInventoryAuditTrail(recordId)]).then(([i, s, a]) => {
      if (!i) { navigate('/inventory/items'); return }
      setItem(i)
      setStock(s)
      setAudit(a)
      setLoading(false)
    })
  }, [recordId, navigate])

  if (loading || !item) return <LoadingState variant="card" />

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title={item.itemName}
      description={`${item.itemCode} · ${INVENTORY_ITEM_TYPE_LABELS[item.itemType]}`}
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Items', to: '/inventory/items' }, { label: item.itemCode }]}
      autoBreadcrumbs={false}
      favoritePath={`/inventory/items/${recordId}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canEditItem ? { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => navigate(`/inventory/items/${recordId}/edit`) } : undefined}
          secondaryActions={[
            ...(perms.canCreateItem ? [{ id: 'dup', label: 'Duplicate', onClick: async () => { const d = await duplicateItem(recordId!); notify.success('Duplicated'); navigate(`/inventory/items/${d.id}`) } }] : []),
            ...(perms.canDeactivateItem && item.status === 'active' ? [{ id: 'deact', label: 'Deactivate', onClick: async () => { await deactivateItem(recordId!); notify.success('Deactivated'); navigate('/inventory/items') } }] : []),
            { id: 'stock', label: 'Stock Availability', onClick: () => navigate(`/inventory/stock?search=${encodeURIComponent(item.itemCode)}`) },
            ...(perms.canViewItemLedger ? [{ id: 'ledger', label: 'Item Ledger', onClick: () => navigate(`/inventory/items/${recordId}/ledger`) }] : []),
            ...(perms.canViewTraceability ? [{ id: 'trace', label: 'Traceability', onClick: () => setTraceOpen(true) }] : []),
          ]}
        />
      )}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-erp-border bg-erp-surface p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Item Details</h3>
          <dl className="grid gap-3 sm:grid-cols-2 text-[13px]">
            <div><dt className="text-erp-muted">Category</dt><dd>{item.categoryName}</dd></div>
            <div><dt className="text-erp-muted">UOM</dt><dd>{item.baseUomCode}</dd></div>
            <div><dt className="text-erp-muted">Default Warehouse</dt><dd>{item.defaultWarehouseName ?? '—'}</dd></div>
            <div><dt className="text-erp-muted">Status</dt><dd><StatusDot label={item.status} tone={statusToneFromLabel(item.status)} /></dd></div>
            <div><dt className="text-erp-muted">Tracking</dt><dd>{trackingLabel(item)}</dd></div>
            <div><dt className="text-erp-muted">HSN / GST</dt><dd>{item.hsnCode} / {item.gstRate}%</dd></div>
            <div><dt className="text-erp-muted">Reorder Level</dt><dd className="font-mono">{item.reorderLevel}</dd></div>
            <div><dt className="text-erp-muted">Available Qty</dt><dd className="font-mono">{item.availableQuantity}</dd></div>
            {perms.canViewCost ? (
              <>
                <div><dt className="text-erp-muted">Standard Cost</dt><dd>{formatCurrency(item.standardCost)}</dd></div>
                <div><dt className="text-erp-muted">Stock Value</dt><dd>{formatCurrency(stock?.summary.stockValue ?? 0)}</dd></div>
              </>
            ) : null}
          </dl>
        </section>
        <section className="rounded-lg border border-erp-border bg-erp-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Stock Summary</h3>
          {stock ? (
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt>On Hand</dt><dd className="font-mono">{stock.summary.onHand}</dd></div>
              <div className="flex justify-between"><dt>Available</dt><dd className="font-mono">{stock.summary.available}</dd></div>
              <div className="flex justify-between"><dt>Reserved</dt><dd className="font-mono">{stock.summary.reserved}</dd></div>
              <div className="flex justify-between"><dt>Quality Hold</dt><dd className="font-mono">{stock.summary.qualityHold}</dd></div>
            </dl>
          ) : null}
          <Link to={`/inventory/stock/${recordId}`} className="mt-4 inline-block text-[13px] text-erp-primary underline">View stock details</Link>
        </section>
      </div>

      {(stock?.batches.length ?? 0) > 0 && perms.canViewBatches ? (
        <section className="mt-6 rounded-lg border border-erp-border bg-erp-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Batches</h3>
          <table className="erp-table w-full text-[12px]">
            <thead><tr><th>Batch</th><th className="text-right">Qty</th><th>Expiry</th><th>Status</th></tr></thead>
            <tbody>
              {stock!.batches.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono">{b.batchNo}</td>
                  <td className="text-right font-mono">{b.qty}</td>
                  <td>{b.expiryDate ?? '—'}</td>
                  <td>{BATCH_STATUS_LABELS[b.status as keyof typeof BATCH_STATUS_LABELS] ?? b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {(stock?.serials.length ?? 0) > 0 && perms.canViewSerials ? (
        <section className="mt-6 rounded-lg border border-erp-border bg-erp-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Serial Numbers</h3>
          <table className="erp-table w-full text-[12px]">
            <thead><tr><th>Serial</th><th>Status</th></tr></thead>
            <tbody>
              {stock!.serials.map((s) => (
                <tr key={s.id}><td className="font-mono">{s.serialNo}</td><td>{s.status}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {perms.canViewReservations ? (
        <section className="mt-6 rounded-lg border border-erp-border bg-erp-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Reservations</h3>
          <ReservationsPanel itemId={recordId} />
        </section>
      ) : null}

      {audit.length > 0 ? (
        <section className="mt-6 rounded-lg border border-erp-border bg-erp-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Audit History</h3>
          <table className="erp-table w-full"><thead><tr><th>Action</th><th>User</th><th>When</th></tr></thead>
            <tbody>{audit.map((a) => <tr key={a.id}><td>{a.action}</td><td>{a.userName}</td><td>{formatDate(a.timestamp)}</td></tr>)}</tbody>
          </table>
        </section>
      ) : null}
      <TraceabilityDrawer open={traceOpen} entityType="item" entityId={recordId ?? null} onClose={() => setTraceOpen(false)} />
    </OperationalPageShell>
  )
}
