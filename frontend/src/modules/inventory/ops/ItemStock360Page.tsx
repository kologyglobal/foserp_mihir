import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Package,
  RefreshCw,
  ScanLine,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getItemStock360, searchItemOpsSnapshot } from '@/services/inventory'
import { getItemSupplierQualityHistory } from '@/services/purchase'
import type { ItemSearchSnapshot, ItemStock360 } from '@/types/operationalStockViews'
import type { SupplierQualityTimelineEvent } from '@/types/purchaseDomain'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { OpsMetric, StockStatusBadge } from '../ops/opsShared'
import { cn } from '@/utils/cn'

type Stock360Tab =
  | 'overview'
  | 'warehouse'
  | 'bin'
  | 'batch'
  | 'serial'
  | 'reservations'
  | 'receipts'
  | 'issues'
  | 'transfers'
  | 'timeline'
  | 'supplier_quality'
  | 'cost'

const TABS: Array<{ id: Stock360Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'bin', label: 'Bin' },
  { id: 'batch', label: 'Batch' },
  { id: 'serial', label: 'Serial' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'issues', label: 'Issues' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'supplier_quality', label: 'Supplier quality' },
  { id: 'cost', label: 'Cost' },
]

/** Main inventory page — balance first, documents unmerged on expand/history tabs. */
export function ItemStock360Page() {
  const { itemId } = useParams()
  const [params, setParams] = useSearchParams()
  const warehouseId = params.get('warehouse') ?? undefined
  const tab = (params.get('tab') as Stock360Tab) || 'overview'
  const navigate = useNavigate()
  const [data, setData] = useState<ItemStock360 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [token, setToken] = useState(0)
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState<ItemSearchSnapshot[]>([])
  const [sqTimeline, setSqTimeline] = useState<SupplierQualityTimelineEvent[]>([])
  const [sqLoading, setSqLoading] = useState(false)

  const setTab = (next: Stock360Tab) => {
    const p = new URLSearchParams(params)
    if (next === 'overview') p.delete('tab')
    else p.set('tab', next)
    setParams(p, { replace: true })
  }

  const load = useCallback(async () => {
    if (!itemId) return
    void token
    setLoading(true)
    setError(false)
    try {
      const d = await getItemStock360(itemId, warehouseId)
      if (!d) {
        setData(null)
        setError(true)
      } else setData(d)
    } catch {
      setData(null)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [itemId, warehouseId, token])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!itemId) return
    if (tab !== 'supplier_quality' && tab !== 'timeline') return
    let cancelled = false
    setSqLoading(true)
    void getItemSupplierQualityHistory(itemId)
      .then((h) => {
        if (!cancelled) setSqTimeline(h.timeline)
      })
      .catch(() => {
        if (!cancelled) setSqTimeline([])
      })
      .finally(() => {
        if (!cancelled) setSqLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [itemId, tab, token])

  const lastPurchase = data?.receiptSummary.lastPurchaseDate ?? null
  const lastIssue = data?.issues[0]?.date ?? null
  const outgoing = useMemo(
    () => (data?.issues ?? []).reduce((s, i) => s + (i.qty || 0), 0),
    [data],
  )

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Store" title="Item Stock 360">
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  if (error || !data) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Store"
        title="Item Stock 360"
        backLink={{ to: '/inventory/stock', label: 'Consolidated stock' }}
      >
        <EmptyState
          icon={Package}
          title="Item stock not found"
          description="The item may not exist or balances are unavailable."
          action={(
            <button type="button" className="erp-btn erp-btn-primary h-10 px-4" onClick={() => navigate('/inventory/stock')}>
              Back to stock
            </button>
          )}
        />
      </OperationalPageShell>
    )
  }

  const { overview } = data

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title={`${data.itemCode}`}
      description={data.itemName}
      backLink={{ to: '/inventory/stock', label: 'Consolidated stock' }}
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Stock', to: '/inventory/stock' },
        { label: data.itemCode },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/inventory/stock/${data.itemId}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'issue',
            label: 'Issue',
            icon: ArrowUpFromLine,
            onClick: () => navigate('/inventory/store/issue'),
          }}
          secondaryActions={[
            {
              id: 'receive',
              label: 'Receive',
              icon: ArrowDownToLine,
              onClick: () => navigate('/inventory/store/receive'),
            },
            {
              id: 'transfer',
              label: 'Transfer',
              icon: ArrowLeftRight,
              onClick: () => navigate('/inventory/store/transfer'),
            },
            {
              id: 'scan',
              label: 'Scan',
              icon: ScanLine,
              onClick: () => navigate('/inventory/store/scan'),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => setToken((n) => n + 1),
            },
            {
              id: 'ledger',
              label: 'Ledger',
              onClick: () => navigate(`/inventory/items/${data.itemId}/ledger`),
            },
          ]}
        />
      )}
    >
      <div className="store-ops-page store-item-360">
        <div className="ops-filter-bar mb-2">
          <input
            className="erp-input h-10 min-w-[12rem] flex-1 text-[14px]"
            placeholder="Search items…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void searchItemOpsSnapshot(searchQ).then(setSearchHits).catch(() => setSearchHits([]))
              }
            }}
          />
          <button
            type="button"
            className="erp-btn erp-btn-secondary h-10 px-4 text-[13px]"
            onClick={() => void searchItemOpsSnapshot(searchQ).then(setSearchHits).catch(() => setSearchHits([]))}
          >
            Search
          </button>
        </div>
        {searchHits.length > 0 ? (
          <ul className="store-card-list mb-3">
            {searchHits.map((h) => (
              <li key={h.itemId}>
                <button
                  type="button"
                  className="store-action-card"
                  onClick={() => {
                    navigate(`/inventory/stock/${h.itemId}`)
                    setSearchHits([])
                  }}
                >
                  <div className="store-action-card__title">
                    <span className="font-mono text-[11px] text-erp-muted">{h.itemCode}</span> {h.itemName}
                  </div>
                  <div className="store-action-card__detail">
                    Stock {formatNumber(h.currentStock)} · avail {formatNumber(h.available)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="store-summary-hero mb-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <StockStatusBadge status={overview.status} />
            <span className="text-[12px] text-erp-muted">{data.uom}</span>
          </div>
          <div className="ops-summary-card__metrics">
            <OpsMetric label="On hand" value={formatNumber(overview.onHand)} mono />
            <OpsMetric label="Available" value={formatNumber(overview.available)} mono />
            <OpsMetric label="Reserved" value={formatNumber(overview.reserved)} mono />
            <OpsMetric label="Incoming" value={formatNumber(overview.incoming)} mono />
            <OpsMetric label="Outgoing (issues)" value={formatNumber(outgoing)} mono />
            <OpsMetric label="Avg cost" value={formatCurrency(overview.avgCost)} mono />
            <OpsMetric label="Last purchase" value={lastPurchase ? formatDate(lastPurchase) : '—'} />
            <OpsMetric label="Last issue" value={lastIssue ? formatDate(lastIssue) : '—'} />
          </div>
        </div>

        <div className="store-tabs" role="tablist" aria-label="Item stock sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={cn('store-tab', tab === t.id && 'store-tab--active')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="store-tab-panel" role="tabpanel">
          {tab === 'overview' ? (
            <div className="space-y-3">
              <p className="text-[13px] text-erp-muted">
                Operational balance by warehouse is the working view. Open Receipts / Timeline for unmerged audit documents.
              </p>
              <div className="store-chip-row">
                <button
                  type="button"
                  className={!warehouseId ? 'store-chip store-chip--active' : 'store-chip'}
                  onClick={() => {
                    const p = new URLSearchParams(params)
                    p.delete('warehouse')
                    setParams(p, { replace: true })
                  }}
                >
                  All WH
                </button>
                {data.warehouses.map((w) => (
                  <button
                    key={w.warehouseId}
                    type="button"
                    className={warehouseId === w.warehouseId ? 'store-chip store-chip--active' : 'store-chip'}
                    onClick={() => {
                      const p = new URLSearchParams(params)
                      p.set('warehouse', w.warehouseId)
                      setParams(p, { replace: true })
                    }}
                  >
                    {w.warehouseCode} · {formatNumber(w.onHand)}
                  </button>
                ))}
              </div>
              <ul className="store-card-list">
                {data.warehouses.map((w) => (
                  <li key={w.warehouseId}>
                    <div className="store-action-card">
                      <div className="store-action-card__title">{w.warehouseName}</div>
                      <div className="ops-summary-card__metrics mt-2">
                        <OpsMetric label="On hand" value={formatNumber(w.onHand)} mono />
                        <OpsMetric label="Avail" value={formatNumber(w.available)} mono />
                        <OpsMetric label="Reserved" value={formatNumber(w.reserved)} mono />
                        <OpsMetric label="Incoming" value={formatNumber(w.incoming)} mono />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === 'warehouse' ? (
            <ul className="store-card-list">
              {data.warehouses.length === 0 ? (
                <p className="text-[13px] text-erp-muted">No warehouse balances.</p>
              ) : null}
              {data.warehouses.map((w) => (
                <li key={w.warehouseId}>
                  <div className="store-action-card">
                    <div className="store-action-card__title">
                      {w.warehouseCode} — {w.warehouseName}
                    </div>
                    <div className="ops-summary-card__metrics mt-2">
                      <OpsMetric label="On hand" value={formatNumber(w.onHand)} mono />
                      <OpsMetric label="Reserved" value={formatNumber(w.reserved)} mono />
                      <OpsMetric label="Available" value={formatNumber(w.available)} mono />
                      <OpsMetric label="Incoming" value={formatNumber(w.incoming)} mono />
                      <OpsMetric label="Avg cost" value={formatCurrency(w.avgCost)} mono />
                      <OpsMetric label="Value" value={formatCurrency(w.stockValue)} mono />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === 'bin' ? (
            data.bins.length === 0 ? (
              <p className="text-[13px] text-erp-muted">
                No bin references on documents for this item. Put-away records storage bins on transfer/GRN lines —
                there is no separate bin balance table.
              </p>
            ) : (
              <ul className="store-card-list">
                {data.bins.map((b, i) => (
                  <li key={`${b.binCode}-${i}`}>
                    <div className="store-action-card">
                      <div className="store-action-card__title font-mono">{b.binCode}</div>
                      <div className="store-action-card__detail">
                        {b.warehouseName} · qty {formatNumber(b.qty)}
                        {b.note ? ` · ${b.note}` : ''}
                      </div>
                      {b.sourceDocumentNo ? (
                        <div className="store-action-card__detail text-[11px]">
                          Doc {b.sourceDocumentNo}
                          {b.href ? (
                            <>
                              {' '}
                              ·{' '}
                              <Link to={b.href} className="font-semibold text-[#0078d4]">
                                Open
                              </Link>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'serial' ? (
            (data.serials?.length ?? 0) === 0 ? (
              <p className="text-[13px] text-erp-muted">
                No serial tracking records or document serials for this item. Serials live on inventory serial masters and
                GRN/issue lines — they are never rolled into a balance table.
              </p>
            ) : (
              <ul className="store-card-list">
                {(data.serials ?? []).map((s, i) => (
                  <li key={`${s.serialNo}-${i}`}>
                    <div className="store-action-card">
                      <div className="store-action-card__top">
                        <span className="store-action-card__severity">{s.source === 'master' ? 'MASTER' : 'DOCUMENT'}</span>
                        <span className="store-action-card__domain">{s.status}</span>
                      </div>
                      <div className="store-action-card__title font-mono">{s.serialNo}</div>
                      <div className="store-action-card__detail">{s.warehouseName}</div>
                      {s.sourceDocumentNo ? (
                        <div className="store-action-card__detail text-[11px]">
                          Source {s.sourceDocumentNo}
                          {s.href ? (
                            <>
                              {' '}
                              ·{' '}
                              <Link to={s.href} className="font-semibold text-[#0078d4]">
                                Open doc
                              </Link>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'batch' ? (
            data.batches.length === 0 ? (
              <p className="text-[13px] text-erp-muted">No batch balances (item may not be batch-tracked).</p>
            ) : (
              <ul className="store-card-list">
                {data.batches.map((b, i) => (
                  <li key={`${b.batchNo}-${i}`}>
                    <div className="store-action-card">
                      <div className="store-action-card__title font-mono">{b.batchNo}</div>
                      <div className="store-action-card__detail">
                        {b.warehouseName} · {formatNumber(b.qty)} · {b.status}
                        {b.expiryDate ? ` · exp ${formatDate(b.expiryDate)}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'reservations' ? (
            data.reservations.length === 0 ? (
              <p className="text-[13px] text-erp-muted">No reservations.</p>
            ) : (
              <ul className="store-card-list">
                {data.reservations.map((r) => (
                  <li key={r.id}>
                    <div className="store-action-card">
                      <div className="store-action-card__title">{r.referenceNo}</div>
                      <div className="store-action-card__detail">
                        {r.demandType} · {r.warehouseName} · qty {formatNumber(r.qty)} · {r.status}
                      </div>
                      <button
                        type="button"
                        className="erp-btn erp-btn-secondary mt-2 h-9 px-3 text-[13px]"
                        onClick={() => navigate('/inventory/store/reservations')}
                      >
                        Manage reservations
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {tab === 'receipts' ? (
            <div className="space-y-3">
              <div className="ops-summary-card">
                <div className="ops-summary-card__metrics">
                  <OpsMetric label="Receipt lines" value={data.receiptSummary.totalReceipts} mono />
                  <OpsMetric label="Qty" value={formatNumber(data.receiptSummary.totalQtyReceived)} mono />
                  <OpsMetric label="Avg rate" value={formatCurrency(data.receiptSummary.averagePurchaseRate)} mono />
                  <OpsMetric label="GRNs" value={data.receiptSummary.grnCount} mono />
                  <OpsMetric label="Vendors" value={data.receiptSummary.vendorCount} mono />
                  <OpsMetric
                    label="Last purchase"
                    value={data.receiptSummary.lastPurchaseDate ? formatDate(data.receiptSummary.lastPurchaseDate) : '—'}
                  />
                </div>
              </div>
              <p className="text-[12px] text-erp-muted">Each GRN is listed separately — never merged.</p>
              <ul className="store-card-list">
                {data.receipts.map((r, idx) => (
                  <li key={`${r.grnId}-${idx}`}>
                    <div className="store-action-card">
                      <div className="store-action-card__title font-mono">{r.grnNumber}</div>
                      <div className="store-action-card__detail">
                        {formatDate(r.receiptDate)} · {r.vendorName} · {r.warehouseName}
                      </div>
                      <div className="store-action-card__qty font-mono">
                        {formatNumber(r.qty)} @ {formatCurrency(r.rate)} · {r.status}
                      </div>
                      <Link to={r.href} className="mt-1 inline-block text-[13px] font-semibold text-[#0078d4]">
                        Open GRN
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === 'issues' ? (
            <ul className="store-card-list">
              {data.issues.length === 0 ? <p className="text-[13px] text-erp-muted">No issues loaded.</p> : null}
              {data.issues.map((iss) => (
                <li key={iss.id}>
                  <div className="store-action-card">
                    <div className="store-action-card__title">{iss.number}</div>
                    <div className="store-action-card__detail">
                      {formatDate(iss.date)} · {iss.reference}
                    </div>
                    <div className="store-action-card__qty font-mono">qty {formatNumber(iss.qty)}</div>
                    {iss.href ? (
                      <Link to={iss.href} className="text-[13px] font-semibold text-[#0078d4]">
                        Open
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === 'transfers' ? (
            <ul className="store-card-list">
              {data.transfers.length === 0 ? <p className="text-[13px] text-erp-muted">No transfers.</p> : null}
              {data.transfers.map((t) => (
                <li key={t.id}>
                  <div className="store-action-card">
                    <div className="store-action-card__title font-mono">{t.number}</div>
                    <div className="store-action-card__detail">
                      {formatDate(t.date)} · {t.fromWh} → {t.toWh}
                    </div>
                    <div className="store-action-card__qty font-mono">qty {formatNumber(t.qty)}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === 'timeline' ? (
            <ol className="store-timeline">
              {data.timeline.length === 0 ? <p className="text-[13px] text-erp-muted">No events.</p> : null}
              {data.timeline.map((ev) => (
                <li key={ev.id} className="store-timeline__item">
                  <div className="store-timeline__dot" />
                  <div className="store-timeline__card">
                    <div className="store-timeline__meta">
                      <span className="store-timeline__kind">{ev.kind}</span>
                      <span>{formatDate(ev.at)}</span>
                    </div>
                    <div className="store-timeline__title">
                      {ev.href ? (
                        <Link to={ev.href} className="text-[#0078d4] hover:underline">
                          {ev.title}
                        </Link>
                      ) : (
                        ev.title
                      )}
                    </div>
                    {ev.subtitle ? <div className="store-timeline__sub">{ev.subtitle}</div> : null}
                    {ev.qty != null ? (
                      <div className="store-timeline__foot font-mono">qty {formatNumber(ev.qty)}</div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {tab === 'supplier_quality' ? (
            <div className="space-y-3">
              <p className="text-[13px] text-erp-muted">
                GRN receipt → purchase inspection → return → vendor adjustment / replacement (API).
              </p>
              {sqLoading ? (
                <LoadingState variant="card" />
              ) : sqTimeline.length === 0 ? (
                <p className="text-[13px] text-erp-muted">
                  No supplier quality events for this item (or API off / no receipts).
                </p>
              ) : (
                <ol className="store-timeline">
                  {sqTimeline.map((ev, idx) => (
                    <li key={`${ev.type}-${ev.number}-${idx}`} className="store-timeline__item">
                      <div className="store-timeline__dot" />
                      <div className="store-timeline__card">
                        <div className="store-timeline__meta">
                          <span className="store-timeline__kind">{ev.type.replace(/_/g, ' ')}</span>
                          <span>{ev.at ? formatDate(ev.at.slice(0, 10)) : '—'}</span>
                        </div>
                        <div className="store-timeline__title">
                          {ev.href ? (
                            <Link to={ev.href} className="text-[#0078d4] hover:underline">
                              {ev.number}
                            </Link>
                          ) : (
                            ev.number
                          )}
                          <span className="ml-2 text-[12px] text-erp-muted">{ev.status}</span>
                        </div>
                        {ev.detail ? <div className="store-timeline__sub">{ev.detail}</div> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}

          {tab === 'cost' ? (
            <div className="ops-summary-card">
              <div className="ops-summary-card__metrics">
                <OpsMetric label="Average cost" value={formatCurrency(overview.avgCost)} mono />
                <OpsMetric label="Stock value" value={formatCurrency(overview.stockValue)} mono />
                <OpsMetric
                  label="Last purchase rate"
                  value={
                    data.receipts[0] ? formatCurrency(data.receipts[0].rate) : '—'
                  }
                  mono
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="erp-btn erp-btn-secondary h-10 px-3" onClick={() => navigate('/inventory/costing')}>
                  Costing hub
                </button>
                <button
                  type="button"
                  className="erp-btn erp-btn-secondary h-10 px-3"
                  onClick={() => navigate('/inventory/costing/layers')}
                >
                  FIFO layers
                </button>
                <button
                  type="button"
                  className="erp-btn erp-btn-secondary h-10 px-3"
                  onClick={() => navigate(`/inventory/items/${data.itemId}/ledger`)}
                >
                  Item ledger
                </button>
              </div>
              <p className="mt-2 text-[12px] text-erp-muted">
                Cost layers and valuation stay finance-owned. Store users see operational avg cost only.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
