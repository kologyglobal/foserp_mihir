import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Package,
  RefreshCw,
  ScanLine,
  Search,
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
import { StockStatusBadge } from '../ops/opsShared'
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

function KpiTile({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string
  value: string
  hint?: string
  emphasize?: boolean
}) {
  return (
    <div className="stock-360-kpi">
      <span className="stock-360-kpi__label">{label}</span>
      <span className={cn('stock-360-kpi__value', emphasize && 'stock-360-kpi__value--accent')}>
        {value}
      </span>
      {hint ? <span className="stock-360-kpi__hint">{hint}</span> : null}
    </div>
  )
}

function StockTable({
  columns,
  children,
  isEmpty,
  empty,
}: {
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center' }>
  children: ReactNode
  isEmpty?: boolean
  empty?: string
}) {
  return (
    <div className="stock-360-table-wrap">
      <table className="stock-360-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  c.align === 'right' && 'is-right',
                  c.align === 'center' && 'is-center',
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={columns.length} className="stock-360-table__empty">
                {empty ?? 'No records'}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}

function PanelHint({ children }: { children: ReactNode }) {
  return <p className="stock-360-hint">{children}</p>
}

function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="stock-360-section-head">
      <h3 className="stock-360-section-title">{title}</h3>
      {aside}
    </div>
  )
}

/** Item Stock 360 — Zoho-style dense operational detail. */
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

  const runSearch = useCallback(() => {
    void searchItemOpsSnapshot(searchQ)
      .then(setSearchHits)
      .catch(() => setSearchHits([]))
  }, [searchQ])

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
        backLink={{ to: '/inventory/stock', label: 'Back to Consolidated Stock' }}
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
  const activeWh = warehouseId
    ? data.warehouses.find((w) => w.warehouseId === warehouseId)
    : null

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title={data.itemCode}
      description={data.itemName}
      backLink={{ to: '/inventory/stock', label: 'Back to Consolidated Stock' }}
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
      <div className="item-stock-360">
        {/* Identity + search */}
        <section className="stock-360-identity" aria-label="Item summary">
          <div className="stock-360-identity__main">
            <div className="stock-360-identity__code-row">
              <span className="stock-360-identity__code">{data.itemCode}</span>
              <StockStatusBadge status={overview.status} />
              <span className="stock-360-identity__uom">{data.uom}</span>
            </div>
            <h2 className="stock-360-identity__name">{data.itemName}</h2>
            <p className="stock-360-identity__meta">
              {activeWh
                ? `Warehouse filter · ${activeWh.warehouseCode} — ${activeWh.warehouseName}`
                : `All warehouses · ${data.warehouses.length} location${data.warehouses.length === 1 ? '' : 's'}`}
              {' · '}
              Stock value {formatCurrency(overview.stockValue)}
            </p>
          </div>
          <div className="stock-360-search">
            <label className="stock-360-search__field">
              <Search className="h-3.5 w-3.5 text-erp-muted" aria-hidden />
              <input
                className="stock-360-search__input"
                placeholder="Find item by code or name…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch()
                }}
              />
            </label>
            <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]" onClick={runSearch}>
              Find
            </button>
          </div>
        </section>

        {searchHits.length > 0 ? (
          <div className="stock-360-search-results">
            {searchHits.map((h) => (
              <button
                key={h.itemId}
                type="button"
                className="stock-360-search-result"
                onClick={() => {
                  navigate(`/inventory/stock/${h.itemId}`)
                  setSearchHits([])
                  setSearchQ('')
                }}
              >
                <span className="stock-360-search-result__code">{h.itemCode}</span>
                <span className="stock-360-search-result__name">{h.itemName}</span>
                <span className="stock-360-search-result__qty">
                  {formatNumber(h.currentStock)} on hand
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {/* KPI strip */}
        <section className="stock-360-kpi-grid" aria-label="Stock metrics">
          <KpiTile label="On hand" value={formatNumber(overview.onHand)} emphasize />
          <KpiTile label="Available" value={formatNumber(overview.available)} emphasize />
          <KpiTile label="Reserved" value={formatNumber(overview.reserved)} />
          <KpiTile label="Incoming" value={formatNumber(overview.incoming)} />
          <KpiTile label="Issues (qty)" value={formatNumber(outgoing)} />
          <KpiTile label="Avg cost" value={formatCurrency(overview.avgCost)} />
          <KpiTile
            label="Last purchase"
            value={lastPurchase ? formatDate(lastPurchase) : '—'}
          />
          <KpiTile label="Last issue" value={lastIssue ? formatDate(lastIssue) : '—'} />
        </section>

        {/* Tabs */}
        <div className="stock-360-tabs" role="tablist" aria-label="Item stock sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={cn('stock-360-tab', tab === t.id && 'stock-360-tab--active')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="stock-360-panel" role="tabpanel">
          {tab === 'overview' ? (
            <div className="stock-360-stack">
              <SectionHead title="Warehouse balances" />
              <PanelHint>
                Working balance by warehouse. Receipts and timeline stay as separate documents.
              </PanelHint>
              <div className="stock-360-chips">
                <button
                  type="button"
                  className={cn('stock-360-chip', !warehouseId && 'stock-360-chip--active')}
                  onClick={() => {
                    const p = new URLSearchParams(params)
                    p.delete('warehouse')
                    setParams(p, { replace: true })
                  }}
                >
                  All warehouses
                </button>
                {data.warehouses.map((w) => (
                  <button
                    key={w.warehouseId}
                    type="button"
                    className={cn(
                      'stock-360-chip',
                      warehouseId === w.warehouseId && 'stock-360-chip--active',
                    )}
                    onClick={() => {
                      const p = new URLSearchParams(params)
                      p.set('warehouse', w.warehouseId)
                      setParams(p, { replace: true })
                    }}
                  >
                    {w.warehouseCode}
                    <span className="stock-360-chip__qty">{formatNumber(w.onHand)}</span>
                  </button>
                ))}
              </div>
              <StockTable
                columns={[
                  { key: 'wh', label: 'Warehouse' },
                  { key: 'oh', label: 'On Hand', align: 'right' },
                  { key: 'res', label: 'Reserved', align: 'right' },
                  { key: 'av', label: 'Available', align: 'right' },
                  { key: 'in', label: 'Incoming', align: 'right' },
                  { key: 'cost', label: 'Avg Cost', align: 'right' },
                  { key: 'val', label: 'Value', align: 'right' },
                ]}
                isEmpty={data.warehouses.length === 0}
                empty="No warehouse balances."
              >
                {data.warehouses.map((w) => (
                  <tr
                    key={w.warehouseId}
                    className={cn(
                      'stock-360-table__row-clickable',
                      warehouseId === w.warehouseId && 'is-selected',
                    )}
                    onClick={() => {
                      const p = new URLSearchParams(params)
                      p.set('warehouse', w.warehouseId)
                      setParams(p, { replace: true })
                    }}
                  >
                    <td>
                      <div className="stock-360-cell-primary font-mono">{w.warehouseCode}</div>
                      <div className="stock-360-cell-meta">{w.warehouseName}</div>
                    </td>
                    <td className="is-right is-num">{formatNumber(w.onHand)}</td>
                    <td className="is-right is-num">{formatNumber(w.reserved)}</td>
                    <td className="is-right is-num is-strong">{formatNumber(w.available)}</td>
                    <td className="is-right is-num">{formatNumber(w.incoming)}</td>
                    <td className="is-right is-num">{formatCurrency(w.avgCost)}</td>
                    <td className="is-right is-num">{formatCurrency(w.stockValue)}</td>
                  </tr>
                ))}
              </StockTable>
            </div>
          ) : null}

          {tab === 'warehouse' ? (
            <div className="stock-360-stack">
              <SectionHead title="All warehouses" />
              <StockTable
                columns={[
                  { key: 'wh', label: 'Warehouse' },
                  { key: 'oh', label: 'On Hand', align: 'right' },
                  { key: 'res', label: 'Reserved', align: 'right' },
                  { key: 'av', label: 'Available', align: 'right' },
                  { key: 'in', label: 'Incoming', align: 'right' },
                  { key: 'cost', label: 'Avg Cost', align: 'right' },
                  { key: 'val', label: 'Stock Value', align: 'right' },
                ]}
                isEmpty={data.warehouses.length === 0}
                empty="No warehouse balances."
              >
                {data.warehouses.map((w) => (
                  <tr key={w.warehouseId}>
                    <td>
                      <div className="stock-360-cell-primary font-mono">{w.warehouseCode}</div>
                      <div className="stock-360-cell-meta">{w.warehouseName}</div>
                    </td>
                    <td className="is-right is-num">{formatNumber(w.onHand)}</td>
                    <td className="is-right is-num">{formatNumber(w.reserved)}</td>
                    <td className="is-right is-num is-strong">{formatNumber(w.available)}</td>
                    <td className="is-right is-num">{formatNumber(w.incoming)}</td>
                    <td className="is-right is-num">{formatCurrency(w.avgCost)}</td>
                    <td className="is-right is-num">{formatCurrency(w.stockValue)}</td>
                  </tr>
                ))}
              </StockTable>
            </div>
          ) : null}

          {tab === 'bin' ? (
            <div className="stock-360-stack">
              <SectionHead title="Bin references" />
              {data.bins.length === 0 ? (
                <PanelHint>
                  No bin references on documents for this item. Put-away records storage bins on transfer /
                  GRN lines — there is no separate bin balance table.
                </PanelHint>
              ) : (
                <StockTable
                  columns={[
                    { key: 'bin', label: 'Bin' },
                    { key: 'wh', label: 'Warehouse' },
                    { key: 'qty', label: 'Qty', align: 'right' },
                    { key: 'doc', label: 'Source document' },
                    { key: 'note', label: 'Note' },
                  ]}
                >
                  {data.bins.map((b, i) => (
                    <tr key={`${b.binCode}-${i}`}>
                      <td className="font-mono is-strong">{b.binCode}</td>
                      <td>{b.warehouseName}</td>
                      <td className="is-right is-num">{formatNumber(b.qty)}</td>
                      <td>
                        {b.sourceDocumentNo ? (
                          b.href ? (
                            <Link to={b.href} className="stock-360-link">
                              {b.sourceDocumentNo}
                            </Link>
                          ) : (
                            b.sourceDocumentNo
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="stock-360-cell-meta">{b.note || '—'}</td>
                    </tr>
                  ))}
                </StockTable>
              )}
            </div>
          ) : null}

          {tab === 'batch' ? (
            <div className="stock-360-stack">
              <SectionHead title="Batches" />
              {data.batches.length === 0 ? (
                <PanelHint>No batch balances (item may not be batch-tracked).</PanelHint>
              ) : (
                <StockTable
                  columns={[
                    { key: 'batch', label: 'Batch' },
                    { key: 'wh', label: 'Warehouse' },
                    { key: 'qty', label: 'Qty', align: 'right' },
                    { key: 'st', label: 'Status' },
                    { key: 'exp', label: 'Expiry' },
                  ]}
                >
                  {data.batches.map((b, i) => (
                    <tr key={`${b.batchNo}-${i}`}>
                      <td className="font-mono is-strong">{b.batchNo}</td>
                      <td>{b.warehouseName}</td>
                      <td className="is-right is-num">{formatNumber(b.qty)}</td>
                      <td>{b.status}</td>
                      <td>{b.expiryDate ? formatDate(b.expiryDate) : '—'}</td>
                    </tr>
                  ))}
                </StockTable>
              )}
            </div>
          ) : null}

          {tab === 'serial' ? (
            <div className="stock-360-stack">
              <SectionHead title="Serials" />
              {(data.serials?.length ?? 0) === 0 ? (
                <PanelHint>
                  No serial tracking records or document serials for this item. Serials live on inventory
                  serial masters and GRN/issue lines — they are never rolled into a balance table.
                </PanelHint>
              ) : (
                <StockTable
                  columns={[
                    { key: 'ser', label: 'Serial no.' },
                    { key: 'src', label: 'Source' },
                    { key: 'st', label: 'Status' },
                    { key: 'wh', label: 'Warehouse' },
                    { key: 'doc', label: 'Document' },
                  ]}
                >
                  {(data.serials ?? []).map((s, i) => (
                    <tr key={`${s.serialNo}-${i}`}>
                      <td className="font-mono is-strong">{s.serialNo}</td>
                      <td>
                        <span className="stock-360-tag">
                          {s.source === 'master' ? 'Master' : 'Document'}
                        </span>
                      </td>
                      <td>{s.status}</td>
                      <td>{s.warehouseName}</td>
                      <td>
                        {s.sourceDocumentNo ? (
                          s.href ? (
                            <Link to={s.href} className="stock-360-link">
                              {s.sourceDocumentNo}
                            </Link>
                          ) : (
                            s.sourceDocumentNo
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </StockTable>
              )}
            </div>
          ) : null}

          {tab === 'reservations' ? (
            <div className="stock-360-stack">
              <SectionHead
                title="Reservations"
                aside={(
                  <button
                    type="button"
                    className="erp-btn erp-btn-secondary h-8 px-3 text-[12px]"
                    onClick={() => navigate('/inventory/store/reservations')}
                  >
                    Manage
                  </button>
                )}
              />
              {data.reservations.length === 0 ? (
                <PanelHint>No reservations for this item.</PanelHint>
              ) : (
                <StockTable
                  columns={[
                    { key: 'ref', label: 'Reference' },
                    { key: 'type', label: 'Demand' },
                    { key: 'wh', label: 'Warehouse' },
                    { key: 'qty', label: 'Qty', align: 'right' },
                    { key: 'st', label: 'Status' },
                  ]}
                >
                  {data.reservations.map((r) => (
                    <tr key={r.id}>
                      <td className="is-strong">{r.referenceNo}</td>
                      <td>{r.demandType}</td>
                      <td>{r.warehouseName}</td>
                      <td className="is-right is-num">{formatNumber(r.qty)}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </StockTable>
              )}
            </div>
          ) : null}

          {tab === 'receipts' ? (
            <div className="stock-360-stack">
              <SectionHead title="Purchase receipts" />
              <div className="stock-360-kpi-grid stock-360-kpi-grid--compact">
                <KpiTile label="Receipt lines" value={String(data.receiptSummary.totalReceipts)} />
                <KpiTile label="Qty received" value={formatNumber(data.receiptSummary.totalQtyReceived)} />
                <KpiTile label="Avg rate" value={formatCurrency(data.receiptSummary.averagePurchaseRate)} />
                <KpiTile label="GRNs" value={String(data.receiptSummary.grnCount)} />
                <KpiTile label="Vendors" value={String(data.receiptSummary.vendorCount)} />
                <KpiTile
                  label="Last purchase"
                  value={
                    data.receiptSummary.lastPurchaseDate
                      ? formatDate(data.receiptSummary.lastPurchaseDate)
                      : '—'
                  }
                />
              </div>
              <PanelHint>Each GRN is listed separately — never merged.</PanelHint>
              <StockTable
                columns={[
                  { key: 'grn', label: 'GRN' },
                  { key: 'date', label: 'Date' },
                  { key: 'vendor', label: 'Vendor' },
                  { key: 'wh', label: 'Warehouse' },
                  { key: 'qty', label: 'Qty', align: 'right' },
                  { key: 'rate', label: 'Rate', align: 'right' },
                  { key: 'st', label: 'Status' },
                ]}
                isEmpty={data.receipts.length === 0}
                empty="No receipts."
              >
                {data.receipts.map((r, idx) => (
                  <tr key={`${r.grnId}-${idx}`}>
                    <td>
                      <Link to={r.href} className="stock-360-link font-mono">
                        {r.grnNumber}
                      </Link>
                    </td>
                    <td className="is-num">{formatDate(r.receiptDate)}</td>
                    <td>{r.vendorName}</td>
                    <td>{r.warehouseName}</td>
                    <td className="is-right is-num">{formatNumber(r.qty)}</td>
                    <td className="is-right is-num">{formatCurrency(r.rate)}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </StockTable>
            </div>
          ) : null}

          {tab === 'issues' ? (
            <div className="stock-360-stack">
              <SectionHead title="Material issues" />
              <StockTable
                columns={[
                  { key: 'no', label: 'Issue no.' },
                  { key: 'date', label: 'Date' },
                  { key: 'ref', label: 'Reference' },
                  { key: 'qty', label: 'Qty', align: 'right' },
                  { key: 'open', label: '' },
                ]}
                isEmpty={data.issues.length === 0}
                empty="No issues loaded."
              >
                {data.issues.map((iss) => (
                  <tr key={iss.id}>
                    <td className="is-strong font-mono">{iss.number}</td>
                    <td className="is-num">{formatDate(iss.date)}</td>
                    <td>{iss.reference}</td>
                    <td className="is-right is-num">{formatNumber(iss.qty)}</td>
                    <td>
                      {iss.href ? (
                        <Link to={iss.href} className="stock-360-link">
                          Open
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </StockTable>
            </div>
          ) : null}

          {tab === 'transfers' ? (
            <div className="stock-360-stack">
              <SectionHead title="Transfers" />
              <StockTable
                columns={[
                  { key: 'no', label: 'Transfer no.' },
                  { key: 'date', label: 'Date' },
                  { key: 'route', label: 'From → To' },
                  { key: 'qty', label: 'Qty', align: 'right' },
                ]}
                isEmpty={data.transfers.length === 0}
                empty="No transfers."
              >
                {data.transfers.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono is-strong">{t.number}</td>
                    <td className="is-num">{formatDate(t.date)}</td>
                    <td>
                      {t.fromWh} → {t.toWh}
                    </td>
                    <td className="is-right is-num">{formatNumber(t.qty)}</td>
                  </tr>
                ))}
              </StockTable>
            </div>
          ) : null}

          {tab === 'timeline' ? (
            <div className="stock-360-stack">
              <SectionHead title="Operational timeline" />
              {data.timeline.length === 0 ? (
                <PanelHint>No events recorded for this item.</PanelHint>
              ) : (
                <ol className="stock-360-timeline">
                  {data.timeline.map((ev) => (
                    <li key={ev.id} className="stock-360-timeline__item">
                      <div className="stock-360-timeline__dot" />
                      <div className="stock-360-timeline__card">
                        <div className="stock-360-timeline__meta">
                          <span className="stock-360-tag">{ev.kind}</span>
                          <span>{formatDate(ev.at)}</span>
                        </div>
                        <div className="stock-360-timeline__title">
                          {ev.href ? (
                            <Link to={ev.href} className="stock-360-link">
                              {ev.title}
                            </Link>
                          ) : (
                            ev.title
                          )}
                        </div>
                        {ev.subtitle ? (
                          <div className="stock-360-timeline__sub">{ev.subtitle}</div>
                        ) : null}
                        {ev.qty != null ? (
                          <div className="stock-360-timeline__foot">qty {formatNumber(ev.qty)}</div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}

          {tab === 'supplier_quality' ? (
            <div className="stock-360-stack">
              <SectionHead title="Supplier quality history" />
              <PanelHint>
                GRN receipt → purchase inspection → return → vendor adjustment / replacement.
              </PanelHint>
              {sqLoading ? (
                <LoadingState variant="card" />
              ) : sqTimeline.length === 0 ? (
                <PanelHint>
                  No supplier quality events for this item (or API off / no receipts).
                </PanelHint>
              ) : (
                <ol className="stock-360-timeline">
                  {sqTimeline.map((ev, idx) => (
                    <li key={`${ev.type}-${ev.number}-${idx}`} className="stock-360-timeline__item">
                      <div className="stock-360-timeline__dot" />
                      <div className="stock-360-timeline__card">
                        <div className="stock-360-timeline__meta">
                          <span className="stock-360-tag">{ev.type.replace(/_/g, ' ')}</span>
                          <span>{ev.at ? formatDate(ev.at.slice(0, 10)) : '—'}</span>
                        </div>
                        <div className="stock-360-timeline__title">
                          {ev.href ? (
                            <Link to={ev.href} className="stock-360-link">
                              {ev.number}
                            </Link>
                          ) : (
                            ev.number
                          )}
                          <span className="ml-2 text-[12px] text-erp-muted">{ev.status}</span>
                        </div>
                        {ev.detail ? (
                          <div className="stock-360-timeline__sub">{ev.detail}</div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}

          {tab === 'cost' ? (
            <div className="stock-360-stack">
              <SectionHead title="Cost snapshot" />
              <div className="stock-360-kpi-grid stock-360-kpi-grid--compact">
                <KpiTile label="Average cost" value={formatCurrency(overview.avgCost)} emphasize />
                <KpiTile label="Stock value" value={formatCurrency(overview.stockValue)} emphasize />
                <KpiTile
                  label="Last purchase rate"
                  value={data.receipts[0] ? formatCurrency(data.receipts[0].rate) : '—'}
                />
                <KpiTile label="Reorder level" value={formatNumber(overview.reorderLevel)} />
              </div>
              <div className="stock-360-actions">
                <button
                  type="button"
                  className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]"
                  onClick={() => navigate('/inventory/costing')}
                >
                  Costing hub
                </button>
                <button
                  type="button"
                  className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]"
                  onClick={() => navigate('/inventory/costing/layers')}
                >
                  FIFO layers
                </button>
                <button
                  type="button"
                  className="erp-btn erp-btn-secondary h-9 px-3 text-[12px]"
                  onClick={() => navigate(`/inventory/items/${data.itemId}/ledger`)}
                >
                  Item ledger
                </button>
              </div>
              <PanelHint>
                Cost layers and valuation stay finance-owned. Store users see operational average cost only.
              </PanelHint>
            </div>
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
