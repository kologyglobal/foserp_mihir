import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Package } from 'lucide-react'
import { listInventoryLedger, type InventoryStockMovement } from '@/services/api/inventoryApi'
import type { ItemTimelineEvent } from '@/types/operationalStockViews'
import { formatDate } from '@/utils/dates/format'
import { formatNumber } from '@/utils/formatters/currency'

function mapMovement(m: InventoryStockMovement): ItemTimelineEvent {
  const kind =
    m.movementType === 'ISSUE' || m.referenceType === 'ISSUE_TO_WO' || m.referenceType === 'ISSUE_TO_MAINTENANCE'
      ? 'issue'
      : m.referenceType === 'GRN'
        ? 'grn'
        : m.movementType === 'INWARD' || m.movementType === 'OPENING'
          ? 'receipt'
          : 'other'
  return {
    id: m.id,
    at: m.movementDate || m.createdAt,
    kind,
    title: `${m.movementType} · ${m.movementNumber}`,
    subtitle: m.item ? `${m.item.code} — ${m.item.name}` : m.itemId,
    href: '/inventory/ledger',
    qty: Number(m.quantity ?? 0),
    meta: m.warehouse?.code ?? m.warehouseId,
  }
}

/** Chronological inventory activity — ledger rows as audit truth. */
export function InventoryTimelinePage() {
  const [events, setEvents] = useState<ItemTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)
  const [filter, setFilter] = useState<'all' | 'issue' | 'receipt' | 'grn' | 'other'>('all')

  const load = useCallback(async () => {
    void token
    setLoading(true)
    try {
      const res = await listInventoryLedger({ page: 1, limit: 100 })
      const rows = (res.data ?? []).map(mapMovement)
      rows.sort((a, b) => b.at.localeCompare(a.at))
      setEvents(rows)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.kind === filter)),
    [events, filter],
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title="Inventory Timeline"
      description="Chronological ledger activity — GRNs and documents stay unmerged; each row is an immutable movement."
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Timeline' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/store/timeline"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="store-chip-row">
          {(['all', 'receipt', 'grn', 'issue', 'other'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? 'store-chip store-chip--active' : 'store-chip'}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="erp-btn erp-btn--ghost erp-btn--sm inline-flex items-center gap-1.5"
            onClick={() => setToken((n) => n + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </button>
          <Link to="/inventory/ledger" className="erp-btn erp-btn--secondary erp-btn--sm">
            Open ledger
          </Link>
        </div>
      </div>

      {loading ? <LoadingState variant="card" /> : null}
      {!loading && visible.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No timeline events"
          description="Post receipts, issues, or GRNs to populate the inventory ledger."
        />
      ) : null}
      {!loading && visible.length > 0 ? (
        <ol className="store-timeline">
          {visible.map((ev) => (
            <li key={ev.id} className="store-timeline__item">
              <div className="store-timeline__dot" />
              <div className="store-timeline__card">
                <div className="store-timeline__meta">
                  <span className="store-timeline__kind">{ev.kind}</span>
                  <span>{formatDate(ev.at)}</span>
                </div>
                {ev.href ? (
                  <Link to={ev.href} className="store-timeline__title hover:underline">
                    {ev.title}
                  </Link>
                ) : (
                  <div className="store-timeline__title">{ev.title}</div>
                )}
                {ev.subtitle ? <div className="store-timeline__sub">{ev.subtitle}</div> : null}
                <div className="store-timeline__foot">
                  {ev.qty != null ? <span className="font-mono">qty {formatNumber(ev.qty)}</span> : null}
                  {ev.meta ? <span>{ev.meta}</span> : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </OperationalPageShell>
  )
}
