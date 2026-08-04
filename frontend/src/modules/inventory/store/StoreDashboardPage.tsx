import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardList,
  Package,
  RefreshCw,
  ScanLine,
  Search,
  Warehouse,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { getStoreDashboard, type StoreDashKpi, type StoreDashboardData } from '@/services/inventory/storeOperationsService'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import { Link } from 'react-router-dom'

function KpiCard({ k }: { k: StoreDashKpi }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className={cn(
        'store-kpi-card',
        k.tone === 'warning' && 'store-kpi-card--warning',
        k.tone === 'critical' && 'store-kpi-card--critical',
        k.tone === 'ok' && 'store-kpi-card--ok',
      )}
      onClick={() => navigate(k.href)}
    >
      <span className="store-kpi-card__label">{k.label}</span>
      <span className="store-kpi-card__value">{k.value}</span>
    </button>
  )
}

const QUICK: Array<{ label: string; href: string; icon: typeof Package; primary?: boolean }> = [
  { label: 'Receive', href: '/inventory/store/receive', icon: ArrowDownToLine, primary: true },
  { label: 'Issue', href: '/inventory/store/issue', icon: ArrowUpFromLine, primary: true },
  { label: 'Transfer', href: '/inventory/store/transfer', icon: ArrowLeftRight, primary: true },
  { label: 'Count', href: '/inventory/store/count', icon: ClipboardList },
  { label: 'Scan', href: '/inventory/store/scan', icon: ScanLine },
  { label: 'Search item', href: '/inventory/ops/search', icon: Search },
  { label: 'Stock 360', href: '/inventory/stock', icon: Package },
  { label: 'Warehouse', href: '/inventory/ops/warehouses', icon: Warehouse },
]

/** Daily store hub — balances/queue only; posts via existing engines. */
export function StoreDashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<StoreDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(0)

  const load = useCallback(async () => {
    void token
    setLoading(true)
    try {
      setData(await getStoreDashboard())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title="Store Dashboard"
      description="Daily work in a few taps. Balances for ops · Ledger & GRNs remain audit truth (never merged)."
      breadcrumbs={[{ label: 'Store' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory"
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
          secondaryActions={[
            { id: 'timeline', label: 'Timeline', onClick: () => navigate('/inventory/store/timeline') },
            { id: 'mfg', label: 'Production queue', onClick: () => navigate('/manufacturing/store-workbench') },
          ]}
        />
      )}
    >
      {loading ? <LoadingState variant="dashboard" /> : null}

      {!loading && data ? (
        <div className="store-ops-page">
          <section className="store-quick-actions" aria-label="Quick actions">
            {QUICK.map((q) => {
              const Icon = q.icon
              return (
                <button
                  key={q.href}
                  type="button"
                  className={cn('store-quick-btn', q.primary && 'store-quick-btn--primary')}
                  onClick={() => navigate(q.href)}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span>{q.label}</span>
                </button>
              )
            })}
          </section>

          <section className="store-kpi-grid" aria-label="Store KPIs">
            {data.kpis.map((k) => (
              <KpiCard key={k.id} k={k} />
            ))}
          </section>

          <section className="store-section">
            <div className="store-section__head">
              <h2 className="store-section__title">Needs action</h2>
              <span className="text-[12px] text-erp-muted">Updated {formatDate(data.asOf)}</span>
            </div>
            {data.queue.length === 0 ? (
              <EmptyState icon={Package} title="All clear" description="No pending store actions in the current queues." />
            ) : (
              <ul className="store-card-list">
                {data.queue.map((row) => (
                  <li key={row.key}>
                    <button
                      type="button"
                      className={cn(
                        'store-action-card',
                        row.severity === 'CRITICAL' && 'store-action-card--critical',
                        row.severity === 'WARNING' && 'store-action-card--warning',
                      )}
                      onClick={() => {
                        if (row.deepLink) navigate(row.deepLink)
                      }}
                    >
                      <div className="store-action-card__top">
                        <span className="store-action-card__severity">{row.severity}</span>
                        <span className="store-action-card__domain">{row.domain}</span>
                      </div>
                      <div className="store-action-card__title">{row.title}</div>
                      <div className="store-action-card__detail">{row.detail}</div>
                      {row.quantity != null ? (
                        <div className="store-action-card__qty font-mono">Qty {row.quantity}</div>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="store-two-col">
            <section className="store-section">
              <div className="store-section__head">
                <h2 className="store-section__title">Low stock</h2>
                <Link to="/inventory/stock" className="text-[12px] font-semibold text-[#0078d4]">
                  Open stock
                </Link>
              </div>
              {data.lowStock.length === 0 ? (
                <p className="text-[13px] text-erp-muted">No low-stock balances in the sample window.</p>
              ) : (
                <ul className="store-card-list">
                  {data.lowStock.map((r) => (
                    <li key={`${r.itemId}:${r.warehouseId}`}>
                      <button
                        type="button"
                        className="store-action-card"
                        onClick={() => navigate(`/inventory/stock/${r.itemId}?warehouse=${r.warehouseId}`)}
                      >
                        <div className="store-action-card__title">
                          <span className="font-mono text-[11px] text-erp-muted">{r.itemCode}</span> {r.itemName}
                        </div>
                        <div className="store-action-card__detail">
                          {r.warehouseName} · on hand {formatNumber(r.onHand)} · avail {formatNumber(r.available)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="store-section">
              <div className="store-section__head">
                <h2 className="store-section__title">Today&apos;s movements</h2>
                <Link to="/inventory/store/timeline" className="text-[12px] font-semibold text-[#0078d4]">
                  Full timeline
                </Link>
              </div>
              {data.todayMoves.length === 0 ? (
                <p className="text-[13px] text-erp-muted">No ledger movements today in the first page.</p>
              ) : (
                <ul className="store-card-list">
                  {data.todayMoves.map((ev) => (
                    <li key={ev.id}>
                      <button
                        type="button"
                        className="store-action-card"
                        onClick={() => (ev.href ? navigate(ev.href) : undefined)}
                      >
                        <div className="store-action-card__title">{ev.title}</div>
                        {ev.subtitle ? <div className="store-action-card__detail">{ev.subtitle}</div> : null}
                        {ev.qty != null ? (
                          <div className="store-action-card__qty font-mono">qty {formatNumber(ev.qty)}</div>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {!loading && !data ? (
        <EmptyState
          icon={Package}
          title="Could not load store dashboard"
          description="Check inventory permissions and API connectivity."
          action={(
            <button type="button" className="erp-btn erp-btn-primary h-9 px-3" onClick={() => setToken((n) => n + 1)}>
              Retry
            </button>
          )}
        />
      ) : null}
    </OperationalPageShell>
  )
}
