import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { DynamicsDashboardGrid, DynamicsDashboardPanel } from '@/components/dynamics'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  getStoreDashboard,
  type StoreDashKpi,
  type StoreDashboardData,
} from '@/services/inventory/storeOperationsService'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

const MODULE_LINKS: Array<{
  label: string
  href: string
  icon: typeof Package
  primary?: boolean
}> = [
  { label: 'Receive', href: '/inventory/store/receive', icon: ArrowDownToLine, primary: true },
  { label: 'Issue', href: '/inventory/store/issue', icon: ArrowUpFromLine, primary: true },
  { label: 'Transfer', href: '/inventory/store/transfer', icon: ArrowLeftRight, primary: true },
  { label: 'Stock Count', href: '/inventory/store/count', icon: ClipboardList },
  { label: 'Scan', href: '/inventory/store/scan', icon: ScanLine },
  { label: 'Item Search', href: '/inventory/ops/search', icon: Search },
  { label: 'Consolidated Stock', href: '/inventory/stock', icon: Package },
  { label: 'Warehouses', href: '/inventory/ops/warehouses', icon: Warehouse },
]

function kpiAccent(tone: StoreDashKpi['tone']): EnterpriseKpiItem['accent'] {
  if (tone === 'critical') return 'red'
  if (tone === 'warning') return 'amber'
  if (tone === 'ok') return 'green'
  return 'blue'
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        'inv-hub-badge',
        severity === 'CRITICAL' && 'inv-hub-badge--critical',
        severity === 'WARNING' && 'inv-hub-badge--warning',
        severity === 'INFO' && 'inv-hub-badge--info',
      )}
    >
      {severity}
    </span>
  )
}

/** Store / Inventory module home — desktop web hub (Zoho-style), not a mobile app shell. */
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

  const kpiStrip: EnterpriseKpiItem[] | undefined = useMemo(() => {
    if (!data) return undefined
    return data.kpis.map((k) => ({
      id: k.id,
      label: k.label,
      value: k.value,
      accent: kpiAccent(k.tone),
      onClick: () => navigate(k.href),
    }))
  }, [data, navigate])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title="Store"
      description="Stock health, store queues, and warehouse operations — open registers and action items from one place."
      breadcrumbs={[
        { label: 'Home', to: '/home' },
        { label: 'Store' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory"
      kpiStrip={!loading && data ? kpiStrip : undefined}
    >
      {loading ? <LoadingState variant="dashboard" /> : null}

      {!loading && data ? (
        <div className="inv-hub">
          <nav className="inv-hub-shortcuts" aria-label="Store modules">
            {MODULE_LINKS.map((q) => {
              const Icon = q.icon
              return (
                <Link
                  key={q.href}
                  to={q.href}
                  className={cn('inv-hub-shortcut', q.primary && 'inv-hub-shortcut--primary')}
                >
                  <Icon className="inv-hub-shortcut__icon" aria-hidden />
                  <span>{q.label}</span>
                </Link>
              )
            })}
          </nav>

          <p className="inv-hub-meta flex flex-wrap items-center gap-3">
            <span>Updated {formatDateTime(data.asOf) || formatDate(data.asOf)}</span>
            <button
              type="button"
              className="erp-btn erp-btn--ghost erp-btn--sm inline-flex items-center gap-1"
              onClick={() => setToken((n) => n + 1)}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </button>
          </p>

          <DynamicsDashboardPanel
            title="Needs action"
            noPadding
            actions={(
              <Link to="/inventory/store/timeline" className="inv-hub-panel-link">
                View timeline →
              </Link>
            )}
          >
            {data.queue.length === 0 ? (
              <div className="px-4 py-8">
                <EmptyState
                  icon={Package}
                  title="All clear"
                  description="No pending store actions in the current queues."
                />
              </div>
            ) : (
              <div className="inv-hub-table-wrap">
                <table className="inv-hub-table">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Domain</th>
                      <th>Title</th>
                      <th>Detail</th>
                      <th className="inv-hub-table__num">Qty</th>
                      <th className="inv-hub-table__action"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.queue.map((row) => (
                      <tr
                        key={row.key}
                        className={cn(row.deepLink && 'inv-hub-table__row--clickable')}
                        onClick={() => {
                          if (row.deepLink) navigate(row.deepLink)
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && row.deepLink) {
                            e.preventDefault()
                            navigate(row.deepLink)
                          }
                        }}
                        tabIndex={row.deepLink ? 0 : undefined}
                        role={row.deepLink ? 'link' : undefined}
                      >
                        <td>
                          <SeverityBadge severity={row.severity} />
                        </td>
                        <td className="inv-hub-table__muted">{row.domain}</td>
                        <td className="inv-hub-table__strong">{row.title}</td>
                        <td className="inv-hub-table__muted inv-hub-table__clamp">{row.detail}</td>
                        <td className="inv-hub-table__num font-mono">
                          {row.quantity != null && row.quantity !== '' ? row.quantity : '—'}
                        </td>
                        <td className="inv-hub-table__action">
                          {row.deepLink ? (
                            <span className="inv-hub-open">Open</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DynamicsDashboardPanel>

          <DynamicsDashboardGrid>
            <DynamicsDashboardPanel
              title="Low stock"
              noPadding
              actions={(
                <Link to="/inventory/stock?lowStock=1" className="inv-hub-panel-link">
                  Open stock →
                </Link>
              )}
            >
              {data.lowStock.length === 0 ? (
                <p className="inv-hub-empty">No low-stock balances in the current window.</p>
              ) : (
                <div className="inv-hub-table-wrap">
                  <table className="inv-hub-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Warehouse</th>
                        <th className="inv-hub-table__num">On hand</th>
                        <th className="inv-hub-table__num">Available</th>
                        <th className="inv-hub-table__num">Reorder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lowStock.map((r) => (
                        <tr
                          key={`${r.itemId}:${r.warehouseId}`}
                          className="inv-hub-table__row--clickable"
                          onClick={() =>
                            navigate(`/inventory/stock/${r.itemId}?warehouse=${r.warehouseId}`)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              navigate(`/inventory/stock/${r.itemId}?warehouse=${r.warehouseId}`)
                            }
                          }}
                          tabIndex={0}
                          role="link"
                        >
                          <td>
                            <div className="inv-hub-item">
                              <span className="inv-hub-item__code font-mono">{r.itemCode}</span>
                              <span className="inv-hub-item__name">{r.itemName}</span>
                            </div>
                          </td>
                          <td className="inv-hub-table__muted">{r.warehouseName}</td>
                          <td className="inv-hub-table__num font-mono">{formatNumber(r.onHand)}</td>
                          <td className="inv-hub-table__num font-mono">{formatNumber(r.available)}</td>
                          <td className="inv-hub-table__num font-mono">
                            {formatNumber(r.reorderLevel)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DynamicsDashboardPanel>

            <DynamicsDashboardPanel
              title="Today's movements"
              noPadding
              actions={(
                <Link to="/inventory/store/timeline" className="inv-hub-panel-link">
                  Full timeline →
                </Link>
              )}
            >
              {data.todayMoves.length === 0 ? (
                <p className="inv-hub-empty">No ledger movements today in the first page.</p>
              ) : (
                <div className="inv-hub-table-wrap">
                  <table className="inv-hub-table">
                    <thead>
                      <tr>
                        <th>Movement</th>
                        <th>Item</th>
                        <th className="inv-hub-table__num">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.todayMoves.map((ev) => (
                        <tr
                          key={ev.id}
                          className={cn(ev.href && 'inv-hub-table__row--clickable')}
                          onClick={() => {
                            if (ev.href) navigate(ev.href)
                          }}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && ev.href) {
                              e.preventDefault()
                              navigate(ev.href)
                            }
                          }}
                          tabIndex={ev.href ? 0 : undefined}
                          role={ev.href ? 'link' : undefined}
                        >
                          <td className="inv-hub-table__strong">{ev.title}</td>
                          <td className="inv-hub-table__muted inv-hub-table__clamp">
                            {ev.subtitle ?? '—'}
                          </td>
                          <td className="inv-hub-table__num font-mono">
                            {ev.qty != null ? formatNumber(ev.qty) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DynamicsDashboardPanel>
          </DynamicsDashboardGrid>
        </div>
      ) : null}

      {!loading && !data ? (
        <EmptyState
          icon={Package}
          title="Could not load inventory dashboard"
          description="Check inventory permissions and API connectivity."
          action={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-3"
              onClick={() => setToken((n) => n + 1)}
            >
              Retry
            </button>
          )}
        />
      ) : null}
    </OperationalPageShell>
  )
}
