import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, LayoutDashboard } from 'lucide-react'
import { SaaSPageShell } from './SaaSPageShell'
import { SaaSDashboardHero } from './SaaSDashboardHero'
import { SaaSActionCard } from './SaaSActionCard'
import { SaaSActivityFeed } from './SaaSActivityFeed'
import { SaaSEmptyState } from './SaaSEmptyState'
import { SaaSKpiCard } from './SaaSKpiCard'
import { RiskMeter } from '../premium/RiskMeter'
import { useErpExecutiveAnalytics, formatMetricCurrency } from '../../services/erpAnalyticsService'
import { buildNextBusinessActions } from '../../services/nextActionEngine'
import { getProductionControlTowerData } from '../../utils/controlTowerMetrics'
import type { SaaSKpiCardProps } from './SaaSKpiCard'

export function SaaSCommandDashboard({
  title,
  subtitle,
  badge,
  favoritePath,
  deepDashboardPath,
  deepDashboardLabel,
  roleKpis = [],
  extra,
  quickActions,
  showNextActions = true,
}: {
  title: string
  subtitle?: string
  badge?: string
  favoritePath?: string
  deepDashboardPath?: string
  deepDashboardLabel?: string
  roleKpis?: SaaSKpiCardProps[]
  extra?: ReactNode
  quickActions?: ReactNode
  /** When false, caller renders NextActionPanel (e.g. role home). */
  showNextActions?: boolean
}) {
  const navigate = useNavigate()
  const a = useErpExecutiveAnalytics()
  const prod = useMemo(() => getProductionControlTowerData(), [a.runningWorkOrders, a.qcPending])
  const nextActions = useMemo(() => buildNextBusinessActions(6), [a.lastUpdated])
  const updatedTime = new Date(a.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const heroKpis: SaaSKpiCardProps[] = [
    { label: 'Order book', value: formatMetricCurrency(a.orderBookValue), helper: `${a.orderBookCount} open orders`, href: '/sales/orders' },
    { label: 'WIP value', value: formatMetricCurrency(a.wipValue), helper: `${a.runningWorkOrders} WOs running`, href: '/manufacturing/work-orders' },
    { label: 'Dispatch ready', value: formatMetricCurrency(a.dispatchReadyValue), helper: `${a.dispatchReadyCount} ready to load`, href: '/dispatch/register' },
    { label: 'Invoiced YTD', value: formatMetricCurrency(a.invoicedYtd), helper: 'Revenue posted this FY', href: '/accounting/money-in/invoices' },
    { label: 'Outstanding AR', value: formatMetricCurrency(a.outstandingAr), helper: a.overdueCount > 0 ? `${a.overdueCount} overdue` : 'Collections on track', href: '/accounting/money-in/invoices' },
    { label: 'Delayed orders', value: a.delayedOrders, helper: a.delayedOrders ? 'Late SO / delivery risk' : 'On-time delivery healthy', href: '/sales/orders' },
    { label: 'Open NCR', value: a.openNcr, helper: a.openNcr ? 'Quality review needed' : `First-pass yield ${a.firstPassYieldPct}%`, href: '/quality/ncr' },
    { label: 'Pending approvals', value: a.pendingApprovals, helper: 'Awaiting sign-off', href: '/purchase/approvals' },
  ]

  return (
    <SaaSPageShell>
      <SaaSDashboardHero
        layout="dynamics"
        title={title}
        subtitle={subtitle ?? `Factory Live · ${a.plantName} · ${a.shift} · Updated ${updatedTime}`}
        badge={badge}
        healthScore={a.plantHealthScore}
        favoritePath={favoritePath}
        kpis={heroKpis}
        actions={
          <>
            {deepDashboardPath && (
              <button type="button" className="saas-btn-primary" onClick={() => navigate(deepDashboardPath)}>
                <LayoutDashboard className="h-4 w-4" />
                {deepDashboardLabel ?? 'Control tower'}
              </button>
            )}
            {quickActions}
          </>
        }
      />

      {roleKpis.length > 0 && (
        <section className="saas-panel p-4">
          <h2 className="saas-panel-title mb-3">Role snapshot</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {roleKpis.map((k) => (
              <SaaSKpiCard key={k.label} {...k} />
            ))}
          </div>
        </section>
      )}

      {showNextActions && (
        <section className="saas-panel">
          <div className="saas-panel-header">
            <h2 className="saas-panel-title">Today needs attention</h2>
            <span className="saas-status-badge saas-status-warning">{nextActions.length} actions</span>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {nextActions.length > 0 ? (
              nextActions.map((action) => (
                <SaaSActionCard
                  key={action.id}
                  title={action.title}
                  reason={action.reason}
                  valueImpact={action.valueImpact}
                  severity={action.severity}
                  actionLabel={action.actionLabel}
                  onClick={() => navigate(action.route)}
                />
              ))
            ) : (
              <div className="sm:col-span-2 xl:col-span-3">
                <SaaSEmptyState
                  icon={CheckCircle2}
                  title="No critical blockers right now"
                  insight="Factory operating within plan — review dispatch-ready trailers."
                  healthNote={`Plant health ${a.plantHealthScore}%`}
                />
              </div>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SaaSActivityFeed minEvents={10} />
        </div>
        <div className="space-y-5 lg:col-span-4">
          <section className="saas-panel">
            <div className="saas-panel-header">
              <h3 className="saas-panel-title">Business risk</h3>
            </div>
            <div className="grid gap-3 p-4">
              <RiskMeter label="Material shortage" value={a.materialShortages} max={15} />
              <RiskMeter label="Vendor delay" value={a.vendorDelays} max={10} />
              <RiskMeter label="Delivery risk" value={a.delayedOrders} max={10} />
              <RiskMeter label="Production bottleneck" value={prod.late} max={10} />
              <RiskMeter label="Cash collection" value={a.overdueCount} max={10} level={a.overdueCount > 3 ? 'high' : 'low'} />
            </div>
          </section>
          <section className="saas-panel">
            <div className="saas-panel-header">
              <h3 className="saas-panel-title">Financial snapshot</h3>
            </div>
            <div className="d365-data-rows p-4">
              <div className="d365-data-row">
                <span className="d365-data-row-label">Invoiced</span>
                <span className="d365-data-row-value">{formatMetricCurrency(a.invoicedYtd)}</span>
              </div>
              <div className="d365-data-row">
                <span className="d365-data-row-label">Collected</span>
                <span className="d365-data-row-value text-[var(--d365-brand)]">{formatMetricCurrency(a.invoicedYtd - a.outstandingAr)}</span>
              </div>
              <div className="d365-data-row">
                <span className="d365-data-row-label">Outstanding</span>
                <span className="d365-data-row-value">{formatMetricCurrency(a.outstandingAr)}</span>
              </div>
              <div className="d365-data-row">
                <span className="d365-data-row-label">Overdue</span>
                <span className="d365-data-row-value text-[var(--erp-danger-solid)]">{formatMetricCurrency(a.overdueAr)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {extra}
    </SaaSPageShell>
  )
}
