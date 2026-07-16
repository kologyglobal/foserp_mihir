import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronRight,
  FileText,
  IndianRupee,
  ShoppingCart,
  Target,
} from 'lucide-react'
import type { DashboardFeedFilter, DashboardFeedItem } from '../../types/dashboardInteraction'
import { DASHBOARD_FEED_FILTER_LABELS } from '../../types/dashboardInteraction'
import type { DashboardNavigation } from './useDashboardNavigation'
import { DynamicsDashboardPanel } from '../dynamics/DynamicsDashboardPanel'
import { formatDate } from '../../utils/dates/format'
import { cn } from '../../utils/cn'

const FILTER_ICONS: Partial<Record<DashboardFeedFilter, typeof Activity>> = {
  all: Activity,
  pipeline: Target,
  lead: Bell,
  quotation: FileText,
  order: ShoppingCart,
  billing: IndianRupee,
  alert: AlertTriangle,
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'dashboard-feed-dot-critical',
  high: 'dashboard-feed-dot-high',
  medium: 'dashboard-feed-dot-medium',
  low: 'dashboard-feed-dot-low',
  info: 'dashboard-feed-dot-info',
}

function matchesFilter(item: DashboardFeedItem, filter: DashboardFeedFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'activity') return item.category === 'activity'
  return item.category === filter
}

export function DashboardManagementFeed({
  items,
  title = 'Live management feed',
  subtitle = 'Every update across pipeline, orders & billing — click any row for details',
  maxItems = 20,
  navigation,
}: {
  items: DashboardFeedItem[]
  title?: string
  subtitle?: string
  maxItems?: number
  navigation: DashboardNavigation
}) {
  const [filter, setFilter] = useState<DashboardFeedFilter>('all')

  const filters = useMemo(() => {
    const counts = new Map<DashboardFeedFilter, number>()
    counts.set('all', items.length)
    for (const item of items) {
      for (const f of ['pipeline', 'lead', 'quotation', 'order', 'billing', 'alert', 'activity'] as DashboardFeedFilter[]) {
        if (matchesFilter(item, f)) counts.set(f, (counts.get(f) ?? 0) + 1)
      }
    }
    return (['all', 'pipeline', 'lead', 'quotation', 'order', 'billing', 'alert', 'activity'] as DashboardFeedFilter[])
      .filter((f) => (counts.get(f) ?? 0) > 0)
  }, [items])

  const filtered = useMemo(
    () => items.filter((i) => matchesFilter(i, filter)).slice(0, maxItems),
    [items, filter, maxItems],
  )

  if (items.length === 0) return null

  return (
    <DynamicsDashboardPanel
      title={title}
      actions={<span className="dyn-entity-list-meta">{items.length} updates</span>}
      noPadding
      className="dashboard-management-feed"
    >
      <div className="dashboard-feed-header">
        <p className="dashboard-feed-subtitle">{subtitle}</p>
        <div className="dashboard-feed-filters" role="tablist" aria-label="Feed filters">
          {filters.map((f) => {
            const Icon = FILTER_ICONS[f] ?? Activity
            const count = items.filter((i) => matchesFilter(i, f)).length
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={cn('dashboard-feed-filter', filter === f && 'dashboard-feed-filter-active')}
                onClick={() => setFilter(f)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {DASHBOARD_FEED_FILTER_LABELS[f]}
                <span className="dashboard-feed-filter-count">{count}</span>
              </button>
            )
          })}
        </div>
      </div>
      <ul className="dashboard-feed-list">
        {filtered.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="dashboard-feed-row"
              onClick={() => navigation.openFeedItem(item)}
            >
              <span
                className={cn('dashboard-feed-dot', SEVERITY_DOT[item.severity ?? 'info'])}
                aria-hidden
              />
              <div className="dashboard-feed-main">
                <p className="dashboard-feed-title">{item.title}</p>
                {item.subtitle ? <p className="dashboard-feed-meta">{item.subtitle}</p> : null}
              </div>
              <div className="dashboard-feed-aside">
                <span className="dashboard-feed-time">{formatDate(item.timestamp.slice(0, 10))}</span>
                <ChevronRight className="h-4 w-4 text-erp-muted" aria-hidden />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </DynamicsDashboardPanel>
  )
}
