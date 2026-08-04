import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Search } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { searchItemOpsSnapshot } from '@/services/inventory'
import type { ItemSearchSnapshot } from '@/types/operationalStockViews'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'

export function OpsSearchPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const initial = params.get('q') ?? ''
  const [q, setQ] = useState(initial)
  const [hits, setHits] = useState<ItemSearchSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState(0)

  const load = useCallback(async () => {
    void token
    const query = (params.get('q') ?? q).trim()
    if (!query) {
      setHits([])
      return
    }
    setLoading(true)
    try {
      setHits(await searchItemOpsSnapshot(query))
    } catch {
      setHits([])
    } finally {
      setLoading(false)
    }
  }, [params, q, token])

  useEffect(() => {
    void load()
  }, [load])

  const submit = () => {
    const next = new URLSearchParams(params)
    if (q.trim()) next.set('q', q.trim())
    else next.delete('q')
    setParams(next, { replace: true })
    setToken((n) => n + 1)
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title="Operations Search"
      description="Find item stock, recent GRNs, and open PO pending quantity."
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Ops Search' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/ops/search"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'refresh',
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => setToken((n) => n + 1),
          }}
        />
      )}
      filterBar={(
        <div className="ops-filter-bar">
          <label className="ops-filter-bar__search">
            <Search className="h-3.5 w-3.5 text-erp-muted" aria-hidden />
            <input
              className="erp-input h-8 min-w-[16rem] flex-1 text-[12px]"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder="Item code or name…"
            />
          </label>
          <button type="button" className="erp-btn erp-btn-primary h-8 px-3 text-[12px]" onClick={submit}>
            Search
          </button>
        </div>
      )}
    >
      {loading ? <LoadingState variant="table" /> : null}
      {!loading && !q.trim() ? (
        <EmptyState icon={Search} title="Enter a search term" description="Search by item code or name." />
      ) : null}
      {!loading && q.trim() && hits.length === 0 ? (
        <EmptyState icon={Search} title="No matches" description="Try another item code or name." />
      ) : null}
      {!loading && hits.length > 0 ? (
        <div className="ops-summary-grid">
          {hits.map((h) => (
            <div key={h.itemId} className="ops-summary-card">
              <button
                type="button"
                className="mb-2 text-left"
                onClick={() => navigate(`/inventory/stock/${h.itemId}`)}
              >
                <div className="font-mono text-[11px] text-erp-muted">{h.itemCode}</div>
                <div className="text-[14px] font-semibold text-[#0078d4]">{h.itemName}</div>
              </button>
              <div className="ops-summary-card__metrics mb-2">
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">On hand</span>
                  <span className="ops-summary-card__metric-value font-mono">{formatNumber(h.currentStock)}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Available</span>
                  <span className="ops-summary-card__metric-value font-mono">{formatNumber(h.available)}</span>
                </div>
                <div className="ops-summary-card__metric">
                  <span className="ops-summary-card__metric-label">Avg cost</span>
                  <span className="ops-summary-card__metric-value font-mono">{formatCurrency(h.avgCost)}</span>
                </div>
              </div>
              {h.recentReceipts.length > 0 ? (
                <div className="mb-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase text-erp-muted">Recent GRNs</div>
                  <ul className="space-y-1 text-[12px]">
                    {h.recentReceipts.map((r, i) => (
                      <li key={`${r.grnId}-${i}`} className="flex justify-between gap-2">
                        <Link to={r.href} className="font-mono text-[#0078d4] hover:underline">{r.grnNumber}</Link>
                        <span className="text-erp-muted">{formatDate(r.receiptDate)} · {formatNumber(r.qty)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {h.pendingPurchaseOrders.length > 0 ? (
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase text-erp-muted">Open POs</div>
                  <ul className="space-y-1 text-[12px]">
                    {h.pendingPurchaseOrders.map((p) => (
                      <li key={p.poId} className="flex justify-between gap-2">
                        <Link to={p.href} className="font-mono text-[#0078d4] hover:underline">{p.poNumber}</Link>
                        <span className="font-mono">pending {formatNumber(p.pendingQty)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
