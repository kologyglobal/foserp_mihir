import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SalesOrder } from '../../types/mrp'
import { DynamicsDashboardPanel } from '../dynamics/DynamicsDashboardPanel'
import { formatMetricCurrency } from '../../utils/workspaceMetrics'
import {
  buildSalesDeliveryBuckets,
  buildSalesStatusChartData,
} from '../../utils/salesDashboardMetrics'
import {
  buildCustomerOrderBookChartData,
  buildMonthlyBookingTrend,
  buildOwnerOrderBookChartData,
  formatSalesCurrency,
} from '../../utils/salesManagementMetrics'
import type { SalesManagementMetrics } from '../../utils/salesManagementMetrics'
import { salesCustomer360Path } from '../../config/entity360Routes'

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid var(--erp-border)',
  background: 'var(--erp-surface)',
  fontSize: 12,
}

const STATUS_COLORS = [
  'var(--erp-primary)',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#64748b',
  '#94a3b8',
]

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="crm-chart-empty">
      <div className="crm-chart-empty-bars" aria-hidden>
        {[40, 65, 45, 80, 55].map((h, i) => (
          <span key={i} className="crm-chart-empty-bar" style={{ height: `${h}%` }} />
        ))}
      </div>
      <p className="crm-helper-text">{message}</p>
    </div>
  )
}

export function SalesOrderStatusChart({ salesOrders }: { salesOrders: SalesOrder[] }) {
  const navigate = useNavigate()
  const data = useMemo(() => buildSalesStatusChartData(salesOrders), [salesOrders])

  return (
    <DynamicsDashboardPanel title="Orders by status" noPadding>
      {data.length === 0 ? (
        <ChartEmpty message="No sales orders yet — create from CRM or direct entry." />
      ) : (
        <div className="crm-chart-panel">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--erp-border)" />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--erp-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="shortLabel"
                width={88}
                tick={{ fontSize: 11, fill: 'var(--erp-text)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, _name, item) => {
                  const n = Number(value ?? 0)
                  const row = item?.payload as { value?: number }
                  return [`${n} orders · ${formatMetricCurrency(row?.value ?? 0)}`, 'Count']
                }}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
                cursor="pointer"
                onClick={(d) => {
                  const status = (d as { status?: string }).status
                  if (status) navigate(`/sales/orders?status=${status}`)
                }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function SalesDeliveryCommitmentChart({ salesOrders }: { salesOrders: SalesOrder[] }) {
  const data = useMemo(() => buildSalesDeliveryBuckets(salesOrders), [salesOrders])

  return (
    <DynamicsDashboardPanel title="Delivery commitments" actions={<span className="dyn-entity-list-meta">Active orders by month</span>} noPadding>
      {data.length === 0 ? (
        <ChartEmpty message="No active delivery commitments on the order book." />
      ) : (
        <div className="crm-chart-panel">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--erp-border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--erp-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--erp-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => {
                  const n = Number(value ?? 0)
                  return [n, name === 'overdue' ? 'Overdue' : 'Due']
                }}
              />
              <Bar dataKey="count" fill="var(--erp-primary)" radius={[4, 4, 0, 0]} maxBarSize={36} name="Due" />
              <Bar dataKey="overdue" fill="var(--erp-danger)" radius={[4, 4, 0, 0]} maxBarSize={36} name="Overdue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function SalesCommercialFunnelChart({ funnel }: { funnel: SalesManagementMetrics['commercialFunnel'] }) {
  const navigate = useNavigate()
  const stageHref = (shortLabel: string) => {
    if (shortLabel === 'Leads') return '/crm/leads'
    if (shortLabel === 'Opportunities') return '/crm/opportunities'
    if (shortLabel === 'Quotations') return '/crm/quotations'
    if (shortLabel === 'Sales Orders') return '/sales/orders'
    return '/accounting/money-in/invoices'
  }

  return (
    <DynamicsDashboardPanel title="Commercial funnel" actions={<span className="dyn-entity-list-meta">Lead → Invoice</span>} noPadding>
      {funnel.every((f) => f.count === 0) ? (
        <ChartEmpty message="No commercial activity in the funnel yet." />
      ) : (
        <div className="crm-chart-panel">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnel} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--erp-border)" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--erp-muted)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="shortLabel" width={88} tick={{ fontSize: 11, fill: 'var(--erp-text)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, _name, item) => {
                  const n = Number(value ?? 0)
                  const row = item?.payload as { value?: number }
                  return [`${n} · ${formatSalesCurrency(row?.value ?? 0)}`, 'Count']
                }}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
                fill="var(--erp-primary)"
                cursor="pointer"
                onClick={(d) => {
                  const label = (d as { shortLabel?: string }).shortLabel
                  if (label) navigate(stageHref(label))
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function SalesCustomerOrderBookChart({ topCustomers }: { topCustomers: SalesManagementMetrics['topCustomers'] }) {
  const navigate = useNavigate()
  const data = useMemo(() => buildCustomerOrderBookChartData(topCustomers), [topCustomers])
  return (
    <DynamicsDashboardPanel title="Order book by customer" noPadding>
      {data.length === 0 ? (
        <ChartEmpty message="No customer order book data." />
      ) : (
        <div className="crm-chart-panel">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--erp-border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--erp-muted)' }} tickFormatter={(v) => `${(Number(v) / 100000).toFixed(0)}L`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 10, fill: 'var(--erp-text)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, _name, item) => {
                const row = item?.payload as { fullLabel?: string; count?: number }
                return [`${formatSalesCurrency(Number(value ?? 0))} · ${row?.count ?? 0} SOs`, row?.fullLabel ?? '']
              }} />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
                fill="#3b82f6"
                cursor="pointer"
                onClick={(_, index) => {
                  const row = topCustomers[index]
                  if (row) navigate(salesCustomer360Path(row.customerId))
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function SalesOwnerOrderBookChart({ topOwners }: { topOwners: SalesManagementMetrics['topOwners'] }) {
  const data = useMemo(() => buildOwnerOrderBookChartData(topOwners), [topOwners])
  return (
    <DynamicsDashboardPanel title="Order book by sales owner" noPadding>
      {data.length === 0 ? (
        <ChartEmpty message="Assign sales owners on orders to see performance." />
      ) : (
        <div className="crm-chart-panel">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--erp-border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--erp-muted)' }} tickFormatter={(v) => `${(Number(v) / 100000).toFixed(0)}L`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 10, fill: 'var(--erp-text)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, _name, item) => {
                const row = item?.payload as { fullLabel?: string; count?: number }
                return [`${formatSalesCurrency(Number(value ?? 0))} · ${row?.count ?? 0} SOs`, row?.fullLabel ?? '']
              }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function SalesBookingTrendChart({ salesOrders }: { salesOrders: SalesOrder[] }) {
  const data = useMemo(() => buildMonthlyBookingTrend(salesOrders), [salesOrders])
  return (
    <DynamicsDashboardPanel title="Booking vs invoiced trend" actions={<span className="dyn-entity-list-meta">Monthly value</span>} noPadding>
      {data.length === 0 ? (
        <ChartEmpty message="No booking history yet." />
      ) : (
        <div className="crm-chart-panel">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--erp-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--erp-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--erp-muted)' }} tickFormatter={(v) => `${(Number(v) / 100000).toFixed(0)}L`} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [formatSalesCurrency(Number(value ?? 0)), name === 'invoiced' ? 'Invoiced' : 'Booked']} />
              <Bar dataKey="booked" fill="var(--erp-primary)" radius={[4, 4, 0, 0]} maxBarSize={28} name="Booked" />
              <Bar dataKey="invoiced" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} name="Invoiced" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}
