import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { CrmDrawerShell } from '@/components/crm/CrmDrawerShell'
import { LoadingState } from '@/design-system/components/LoadingState'
import { BatchDetailDrawer } from '@/components/inventory/BatchDetailDrawer'
import { ReservationsPanel } from '@/components/inventory/ReservationsPanel'
import { TraceabilityDrawer } from '@/components/inventory/TraceabilityDrawer'
import { getStockDetails } from '@/services/inventory'
import type { StockDetailsData } from '@/types/inventoryDomain'
import { BATCH_STATUS_LABELS } from '@/utils/inventoryTraceabilityLabels'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { cn } from '@/utils/cn'

type DrawerTab = 'availability' | 'batches' | 'serials' | 'reservations' | 'movements' | 'valuation'

interface StockDetailsDrawerProps {
  itemId: string | null
  warehouseId?: string
  onClose: () => void
  onOpenFull?: (itemId: string) => void
}

export function StockDetailsDrawer({ itemId, warehouseId, onClose, onOpenFull }: StockDetailsDrawerProps) {
  const perms = useInventoryPermissions()
  const navigate = useNavigate()
  const [data, setData] = useState<StockDetailsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<DrawerTab>('availability')
  const [batchDrawerId, setBatchDrawerId] = useState<string | null>(null)
  const [traceOpen, setTraceOpen] = useState(false)
  const [traceEntity, setTraceEntity] = useState<{ type: 'item' | 'batch' | 'serial'; id: string } | null>(null)

  useEffect(() => {
    if (!itemId) { setData(null); setTab('availability'); return }
    setLoading(true)
    getStockDetails(itemId, warehouseId).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [itemId, warehouseId])

  const tabs: Array<{ id: DrawerTab; label: string; show: boolean }> = [
    { id: 'availability', label: 'Availability', show: true },
    { id: 'batches', label: 'Batches', show: perms.canViewBatches && (data?.batches.length ?? 0) > 0 },
    { id: 'serials', label: 'Serials', show: perms.canViewSerials && (data?.serials.length ?? 0) > 0 },
    { id: 'reservations', label: 'Reservations', show: perms.canViewReservations },
    { id: 'movements', label: 'Movements', show: true },
    { id: 'valuation', label: 'Valuation', show: perms.canViewCost },
  ]

  return (
    <>
      <CrmDrawerShell
        open={Boolean(itemId)}
        onClose={onClose}
        title={data ? `${data.itemCode} — Stock Details` : 'Stock Details'}
        subtitle={data?.itemName}
        width="lg"
        footer={(
          <div className="flex flex-wrap gap-2">
            {onOpenFull && itemId ? (
              <button type="button" className="erp-btn erp-btn-secondary inline-flex h-9 items-center gap-2 px-4 text-[13px]" onClick={() => onOpenFull(itemId)}>
                <ExternalLink className="h-4 w-4" /> Open full detail
              </button>
            ) : null}
            {perms.canViewItemLedger && itemId ? (
              <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[12px]" onClick={() => { navigate(`/inventory/items/${itemId}/ledger`); onClose() }}>
                Item Ledger
              </button>
            ) : null}
            {perms.canViewTraceability && itemId ? (
              <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[12px]" onClick={() => { setTraceEntity({ type: 'item', id: itemId }); setTraceOpen(true) }}>
                Traceability
              </button>
            ) : null}
          </div>
        )}
      >
        {loading ? <LoadingState variant="card" /> : null}
        {!loading && data ? (
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-wrap gap-1 border-b border-erp-border pb-2">
              {tabs.filter((t) => t.show).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    'rounded px-2.5 py-1 text-[12px] font-medium',
                    tab === t.id ? 'bg-erp-primary/10 text-erp-primary' : 'text-erp-muted hover:bg-erp-bg-subtle',
                  )}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'availability' ? (
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-erp-muted">On Hand</dt><dd className="font-mono text-base">{formatNumber(data.summary.onHand)}</dd></div>
                <div><dt className="text-erp-muted">Available</dt><dd className="font-mono text-base">{formatNumber(data.summary.available)}</dd></div>
                <div><dt className="text-erp-muted">Reserved</dt><dd className="font-mono">{formatNumber(data.summary.reserved)}</dd></div>
                <div><dt className="text-erp-muted">Quality Hold</dt><dd className="font-mono">{formatNumber(data.summary.qualityHold)}</dd></div>
                <div><dt className="text-erp-muted">Expected Receipt</dt><dd className="font-mono">{formatNumber(data.summary.expectedReceipt)}</dd></div>
                <div><dt className="text-erp-muted">Planned Issue</dt><dd className="font-mono">{formatNumber(data.summary.plannedIssue)}</dd></div>
              </dl>
            ) : null}

            {tab === 'batches' && perms.canViewBatches ? (
              <table className="erp-table w-full text-[12px]">
                <thead><tr><th>Batch</th><th className="text-right">Qty</th><th>Expiry</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {data.batches.map((b) => (
                    <tr key={b.id}>
                      <td className="font-mono">{b.batchNo}</td>
                      <td className="text-right font-mono">{formatNumber(b.qty)}</td>
                      <td>{b.expiryDate ? formatDate(b.expiryDate) : '—'}</td>
                      <td>{BATCH_STATUS_LABELS[b.status as keyof typeof BATCH_STATUS_LABELS] ?? b.status}</td>
                      <td>
                        <button type="button" className="text-erp-primary underline" onClick={() => setBatchDrawerId(b.id)}>Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {tab === 'serials' && perms.canViewSerials ? (
              <table className="erp-table w-full text-[12px]">
                <thead><tr><th>Serial</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {data.serials.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono">{s.serialNo}</td>
                      <td>{s.status}</td>
                      <td>
                        {perms.canViewTraceability ? (
                          <button type="button" className="text-erp-primary underline" onClick={() => { setTraceEntity({ type: 'serial', id: s.id }); setTraceOpen(true) }}>Trace</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {tab === 'reservations' && perms.canViewReservations ? (
              <ReservationsPanel itemId={data.itemId} warehouseId={warehouseId} compact />
            ) : null}

            {tab === 'movements' ? (
              <table className="erp-table w-full text-[12px]">
                <thead><tr><th>Doc</th><th>Type</th><th className="text-right">Qty</th><th>Date</th></tr></thead>
                <tbody>
                  {data.recentMovements.slice(0, 8).map((m) => (
                    <tr key={m.movementNo}>
                      <td className="font-mono">{m.movementNo}</td>
                      <td>{m.type}</td>
                      <td className="text-right font-mono">{formatNumber(m.qty)}</td>
                      <td>{formatDate(m.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {tab === 'valuation' && perms.canViewCost ? (
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-erp-muted">Standard Cost</dt><dd>{formatCurrency(data.valuation.standardCost)}</dd></div>
                <div><dt className="text-erp-muted">Stock Value</dt><dd>{formatCurrency(data.valuation.stockValue)}</dd></div>
                <div><dt className="text-erp-muted">Average Cost</dt><dd>{formatCurrency(data.valuation.averageCost)}</dd></div>
                <div><dt className="text-erp-muted">Last Purchase</dt><dd>{formatCurrency(data.valuation.lastPurchaseCost)}</dd></div>
              </dl>
            ) : null}
          </div>
        ) : null}
      </CrmDrawerShell>

      <BatchDetailDrawer
        open={Boolean(batchDrawerId)}
        batchId={batchDrawerId}
        onClose={() => setBatchDrawerId(null)}
        onTrace={(id) => { setTraceEntity({ type: 'batch', id }); setTraceOpen(true); setBatchDrawerId(null) }}
      />
      <TraceabilityDrawer
        open={traceOpen}
        entityType={traceEntity?.type ?? 'item'}
        entityId={traceEntity?.id ?? null}
        onClose={() => setTraceOpen(false)}
      />
    </>
  )
}
