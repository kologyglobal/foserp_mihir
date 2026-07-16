import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DynamicsDashboardPanel } from '../dynamics/DynamicsDashboardPanel'
import type {
  PurchaseDashboardCategorySlice,
  PurchaseDashboardTrendPoint,
  PurchaseDashboardVendorRow,
} from '../../types/purchaseDomain'
import { formatCurrency } from '../../utils/formatters/currency'

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid var(--erp-border)',
  background: 'var(--erp-surface)',
  fontSize: 12,
}

const CATEGORY_COLORS = ['#0f6cbd', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#64748b']

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="crm-chart-empty px-4 py-8 text-center">
      <p className="crm-helper-text text-[13px] text-erp-muted">{message}</p>
    </div>
  )
}

export function PurchaseMonthlyTrendChart({ data }: { data: PurchaseDashboardTrendPoint[] }) {
  const hasValue = data.some((d) => d.value > 0)

  return (
    <DynamicsDashboardPanel title="Monthly Purchase Trend">
      {!hasValue ? (
        <ChartEmpty message="No purchase orders in the selected period." />
      ) : (
        <div className="crm-chart-panel h-[240px] w-full">
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
                tick={{ fontSize: 11, fill: 'var(--erp-muted)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Purchase value']}
              />
              <Bar dataKey="value" fill="var(--erp-primary)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function PurchaseByCategoryChart({ data }: { data: PurchaseDashboardCategorySlice[] }) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel title="Purchase by Category">
      {data.length === 0 ? (
        <ChartEmpty message="No category spend for the selected filters." />
      ) : (
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="crm-chart-panel h-[220px] w-full">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                  cursor="pointer"
                  onClick={(slice) => {
                    const href = (slice as { href?: string })?.href
                    if (href) navigate(href)
                  }}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, _name, item) => {
                    const row = item?.payload as PurchaseDashboardCategorySlice | undefined
                    return [formatCurrency(Number(value ?? 0)), row?.label ?? 'Category']
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 self-center pr-2">
            {data.map((row, index) => (
              <li key={row.category}>
                <button
                  type="button"
                  onClick={() => navigate(row.href)}
                  className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[12px] hover:bg-erp-primary-soft"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                  />
                  <span className="flex-1 truncate text-erp-text">{row.label}</span>
                  <span className="tabular-nums text-erp-muted">{formatCurrency(row.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function PurchaseTopVendorsChart({ data }: { data: PurchaseDashboardVendorRow[] }) {
  const navigate = useNavigate()
  const chartData = data.map((v) => ({
    ...v,
    shortName: v.vendorName.length > 22 ? `${v.vendorName.slice(0, 20)}…` : v.vendorName,
  }))

  return (
    <DynamicsDashboardPanel title="Top Vendors" noPadding={chartData.length > 0}>
      {chartData.length === 0 ? (
        <ChartEmpty message="No vendor purchases in the selected period." />
      ) : (
        <div className="crm-chart-panel h-[260px] w-full p-3">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--erp-border)" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'var(--erp-muted)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                width={120}
                tick={{ fontSize: 11, fill: 'var(--erp-text)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, _name, item) => {
                  const row = item?.payload as PurchaseDashboardVendorRow | undefined
                  return [
                    `${formatCurrency(Number(value ?? 0))} · ${row?.poCount ?? 0} PO(s)`,
                    row?.vendorName ?? 'Vendor',
                  ]
                }}
              />
              <Bar
                dataKey="totalValue"
                fill="#0f6cbd"
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
                cursor="pointer"
                onClick={(d) => {
                  const href = (d as { href?: string })?.href
                  if (href) navigate(href)
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}
