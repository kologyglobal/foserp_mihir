import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SaaSPageShell } from '../saas/SaaSPageShell'
import { SaaSDashboardHero } from '../saas/SaaSDashboardHero'
import { SaaSActionCard } from '../saas/SaaSActionCard'
import { SaaSEmptyState } from '../saas/SaaSEmptyState'
import { SaaSActivityFeed } from '../saas/SaaSActivityFeed'
import { CheckCircle2 } from 'lucide-react'
import { DynamicsKpiRow, DynamicsKpiTile } from './DynamicsKpiTile'
import { DynamicsDashboardPanel, DynamicsDashboardGrid } from './DynamicsDashboardPanel'
import { DynamicsDataGrid } from './DynamicsDataGrid'
import { DynamicsQueuePanel } from './DynamicsQueuePanel'
import { useErpExecutiveAnalytics, formatMetricCurrency } from '../../services/erpAnalyticsService'
import { buildNextBusinessActions } from '../../services/nextActionEngine'
import { getProductionControlTowerData, getExecutiveDashboardData } from '../../utils/controlTowerMetrics'
import { useNotifications } from '../../utils/workspaceMetrics'
import { TableLink } from '../ui/AppLink'
import { StatusBadge } from '../ui/StatusBadge'
import { formatDate } from '../../utils/dates/format'
import type { SalesOrder } from '../../types/mrp'
import type { WorkOrder } from '../../types/workorder'
import { wo360Path } from '../../config/controlTowerRoutes'

/** CEO / Executive Dynamics-style compact dashboard */
export function DynamicsExecutiveDashboard({
  title,
  subtitle,
  badge,
  favoritePath,
}: {
  title: string
  subtitle?: string
  badge?: string
  favoritePath?: string
}) {
  const navigate = useNavigate()
  const a = useErpExecutiveAnalytics()
  const prod = useMemo(() => getProductionControlTowerData(), [a.runningWorkOrders, a.qcPending])
  const nextActions = useMemo(() => buildNextBusinessActions(6), [a.lastUpdated])
  const notifications = useNotifications()
  const openOrders = useMemo(() => getExecutiveDashboardData().openOrders, [a.orderBookCount])
  const updatedTime = new Date(a.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const woStatusChart = [
    { name: 'Running', count: prod.running },
    { name: 'QC hold', count: prod.qcHolds },
    { name: 'Rework', count: prod.reworkQueue },
    { name: 'Late', count: prod.late },
  ]

  const valueChart = [
    { name: 'Order book', value: a.orderBookValue / 10000000 },
    { name: 'WIP', value: a.wipValue / 10000000 },
    { name: 'Dispatch', value: a.dispatchReadyValue / 10000000 },
    { name: 'Invoiced', value: a.invoicedYtd / 10000000 },
  ]

  const woColumns = useMemo<ColumnDef<WorkOrder, unknown>[]>(
    () => [
      { accessorKey: 'woNo', header: 'WO', cell: ({ row }) => <TableLink to={wo360Path(row.original.id)}>{row.original.woNo}</TableLink> },
      { accessorKey: 'plannedFinishDate', header: 'Planned', cell: ({ row }) => formatDate(row.original.plannedFinishDate) },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  )

  const soColumns = useMemo<ColumnDef<SalesOrder, unknown>[]>(
    () => [
      { accessorKey: 'salesOrderNo', header: 'SO', cell: ({ row }) => <TableLink to={`/sales/orders/${row.original.id}`}>{row.original.salesOrderNo}</TableLink> },
      { accessorKey: 'requiredDate', header: 'Required', cell: ({ row }) => formatDate(row.original.requiredDate) },
      { accessorKey: 'grandTotal', header: 'Value', cell: ({ row }) => formatMetricCurrency(row.original.grandTotal ?? 0) },
    ],
    [],
  )

  const queueItems = notifications.slice(0, 6).map((n) => ({
    id: n.id,
    label: n.title,
    meta: n.description,
    severity: (n.severity === 'red' ? 'critical' : n.severity === 'amber' ? 'warning' : 'info') as 'critical' | 'warning' | 'info',
  }))

  return (
    <SaaSPageShell>
      <SaaSDashboardHero
        layout="dynamics"
        title={title}
        subtitle={subtitle ?? `Factory Live · ${a.plantName} · ${a.shift} · Updated ${updatedTime}`}
        badge={badge}
        healthScore={a.plantHealthScore}
        favoritePath={favoritePath}
        kpis={[]}
      />

      <DynamicsKpiRow>
        <DynamicsKpiTile label="Order book" value={formatMetricCurrency(a.orderBookValue)} helper={`${a.orderBookCount} open`} href="/sales/orders" />
        <DynamicsKpiTile label="Invoiced YTD" value={formatMetricCurrency(a.invoicedYtd)} helper="Revenue posted" href="/accounting/money-in/invoices" />
        <DynamicsKpiTile label="Outstanding AR" value={formatMetricCurrency(a.outstandingAr)} helper={a.overdueCount ? `${a.overdueCount} overdue` : 'On track'} href="/accounting/money-in/invoices" tone="warning" />
        <DynamicsKpiTile label="WIP value" value={formatMetricCurrency(a.wipValue)} helper={`${a.runningWorkOrders} WOs running`} href="/manufacturing/work-orders" />
        <DynamicsKpiTile label="Dispatch ready" value={formatMetricCurrency(a.dispatchReadyValue)} helper={`${a.dispatchReadyCount} ready`} href="/dispatch/register" tone="success" />
        <DynamicsKpiTile label="Delayed orders" value={a.delayedOrders} helper="Delivery risk" href="/sales/orders" tone={a.delayedOrders ? 'critical' : 'neutral'} />
        <DynamicsKpiTile label="Open NCR" value={a.openNcr} helper={`Yield ${a.firstPassYieldPct}%`} href="/quality/ncr" tone={a.openNcr ? 'warning' : 'neutral'} />
        <DynamicsKpiTile label="Pending approvals" value={a.pendingApprovals} helper="Awaiting sign-off" href="/purchase/approvals" tone="primary" />
      </DynamicsKpiRow>

      <DynamicsDashboardGrid>
        <DynamicsDashboardPanel title="Orders & value trend (₹ Cr)">
          <div className="dyn-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valueChart}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`₹${Number(v ?? 0).toFixed(2)} Cr`, 'Value']} />
                <Bar dataKey="value" fill="var(--dyn-primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel title="Work order status">
          <div className="dyn-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={woStatusChart}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--dyn-info)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DynamicsDashboardPanel>

        <DynamicsQueuePanel
          title="Pending actions by queue"
          items={queueItems.length > 0 ? queueItems : [{ id: 'ok', label: 'No critical queue items', meta: `Plant health ${a.plantHealthScore}%`, severity: 'success' }]}
        />
      </DynamicsDashboardGrid>

      <div className="dyn-dashboard-split">
        <DynamicsDashboardPanel title="Today needs attention" noPadding>
          <div className="dyn-action-grid">
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
              <SaaSEmptyState icon={CheckCircle2} title="No critical blockers" insight="Operations within plan." healthNote={`Updated ${updatedTime}`} />
            )}
          </div>
        </DynamicsDashboardPanel>
        <SaaSActivityFeed minEvents={10} />
      </div>

      <div className="dyn-dashboard-split">
        <DynamicsDashboardPanel title="Late work orders" noPadding>
          <DynamicsDataGrid data={prod.lateList.slice(0, 6)} columns={woColumns} onRowView={(row) => navigate(wo360Path(row.id))} emptyMessage="No overdue work orders." />
        </DynamicsDashboardPanel>
        <DynamicsDashboardPanel title="Open order book" noPadding>
          <DynamicsDataGrid data={openOrders.slice(0, 6)} columns={soColumns} onRowView={(row) => navigate(`/sales/orders/${row.id}`)} emptyMessage="No open sales orders." />
        </DynamicsDashboardPanel>
      </div>
    </SaaSPageShell>
  )
}
