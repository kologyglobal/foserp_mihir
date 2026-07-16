import { useMemo } from 'react'
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
import type { CrmActivity, FollowUp, Opportunity } from '../../types/crm'
import { DynamicsDashboardPanel } from '../dynamics/DynamicsDashboardPanel'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import {
  buildActivityTrendData,
  buildFollowUpUrgencyData,
  buildOutcomeChartData,
  buildOwnerPipelineData,
  buildPipelineChartData,
  buildStageCountFunnel,
  type ActivityTrendPoint,
  type FollowUpUrgencyPoint,
  type OutcomeChartPoint,
  type OwnerPipelinePoint,
  type PipelineChartPoint,
} from '../../utils/crmDashboardCharts'

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid var(--erp-border)',
  background: 'var(--erp-surface)',
  fontSize: 12,
}

function CrmChartEmpty({ message }: { message: string }) {
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

export function CrmPipelineValueChart({
  opportunities,
  data: dataProp,
}: {
  opportunities?: Opportunity[]
  data?: PipelineChartPoint[]
}) {
  const navigate = useNavigate()
  const data = useMemo(
    () => dataProp ?? buildPipelineChartData(opportunities ?? []),
    [dataProp, opportunities],
  )

  return (
    <DynamicsDashboardPanel title="Pipeline value by stage" noPadding>
      {data.every((d) => d.value === 0) ? (
        <CrmChartEmpty message="No open pipeline value yet." />
      ) : (
        <div className="crm-chart-panel">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--erp-border)" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'var(--erp-muted)' }}
                tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="shortLabel"
                width={72}
                tick={{ fontSize: 11, fill: 'var(--erp-text)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, _name, item) => {
                  const n = Number(value ?? 0)
                  const count = (item?.payload as { count?: number })?.count ?? 0
                  return [`${formatCrmCurrency(n)} · ${count} deals`, 'Pipeline']
                }}
              />
              <Bar
                dataKey="value"
                radius={[0, 6, 6, 0]}
                barSize={18}
                cursor="pointer"
                onClick={(d) => navigate(`/crm/opportunities?stage=${d.id}`)}
              >
                {data.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="crm-chart-legend">
            {data.map((d) => (
              <button
                key={d.id}
                type="button"
                className="crm-chart-legend-item"
                onClick={() => navigate(`/crm/opportunities?stage=${d.id}`)}
              >
                <span className="crm-chart-legend-dot" style={{ background: d.color }} />
                <span>{d.shortLabel}</span>
                <span className="crm-chart-legend-value">{d.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function CrmDealOutcomesChart({
  openCount,
  wonCount,
  lostCount,
  conversionRate,
  weightedForecast,
  data: dataProp,
}: {
  openCount: number
  wonCount: number
  lostCount: number
  conversionRate: number
  weightedForecast: number
  data?: OutcomeChartPoint[]
}) {
  const navigate = useNavigate()
  const data = useMemo(
    () => dataProp ?? buildOutcomeChartData(openCount, wonCount, lostCount),
    [dataProp, openCount, wonCount, lostCount],
  )
  const total = openCount + wonCount + lostCount

  const stageHref = (name: string) => {
    if (name === 'Won') return '/crm/opportunities?stage=won'
    if (name === 'Lost') return '/crm/opportunities?stage=lost'
    return '/crm/opportunities'
  }

  return (
    <DynamicsDashboardPanel title="Deal outcomes" noPadding>
      {total === 0 ? (
        <CrmChartEmpty message="No deals recorded yet." />
      ) : (
        <div className="crm-chart-panel crm-chart-panel-split">
          <div className="crm-chart-donut-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                  cursor="pointer"
                  onClick={(_, index) => {
                    const row = data[index]
                    if (row) navigate(stageHref(row.name))
                  }}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v ?? 0, 'Deals']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="crm-chart-donut-center">
              <span className="crm-kpi-value">{conversionRate}%</span>
              <span className="crm-kpi-label">Win rate</span>
            </div>
          </div>
          <div className="crm-chart-outcome-legend">
            {data.map((d) => (
              <button
                key={d.name}
                type="button"
                className="crm-chart-outcome-row dashboard-clickable-row"
                onClick={() => navigate(stageHref(d.name))}
              >
                <span className="crm-chart-legend-dot" style={{ background: d.color }} />
                <span className="crm-card-title">{d.name}</span>
                <span className="crm-chart-outcome-count">{d.value}</span>
              </button>
            ))}
            <button
              type="button"
              className="crm-chart-forecast-row dashboard-clickable-row"
              onClick={() => navigate('/crm/forecast')}
            >
              <span className="crm-helper-text">Weighted forecast</span>
              <span className="crm-card-title text-erp-primary">{formatCrmCurrency(weightedForecast)}</span>
            </button>
          </div>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function CrmLeadStageFunnelChart({
  funnel,
}: {
  funnel: { stage: string; label: string; count: number }[]
}) {
  const navigate = useNavigate()
  const max = Math.max(...funnel.map((d) => d.count), 1)
  const fills = ['#2563eb', '#0891b2', '#4f46e5', '#16a34a', '#14532d']

  return (
    <DynamicsDashboardPanel title="Lead stage funnel" noPadding>
      <div className="crm-funnel-viz">
        {funnel.map((row, i) => {
          const widthPct = row.count === 0 ? 14 : Math.max(30, (row.count / max) * 100)
          return (
            <button
              key={row.stage}
              type="button"
              className="crm-funnel-viz-row"
              onClick={() => navigate(`/crm/leads?stage=${row.stage}`)}
              style={{ width: `${widthPct}%` }}
            >
              <div className="crm-funnel-viz-bar" style={{ background: fills[i] ?? fills[0] }}>
                <span className="crm-funnel-viz-count">{row.count}</span>
                <span className="crm-funnel-viz-label">{row.label}</span>
              </div>
            </button>
          )
        })}
      </div>
    </DynamicsDashboardPanel>
  )
}

export function CrmStageFunnelChart({
  opportunities,
  data: dataProp,
}: {
  opportunities?: Opportunity[]
  data?: Array<{ id: string; stage: string; short: string; count: number; fill: string }>
}) {
  const navigate = useNavigate()
  const data = useMemo(
    () => dataProp ?? buildStageCountFunnel(opportunities ?? []),
    [dataProp, opportunities],
  )
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <DynamicsDashboardPanel title="Deal flow funnel" noPadding>
      <div className="crm-funnel-viz">
        {data.map((stage) => {
          const widthPct = stage.count === 0 ? 14 : Math.max(30, (stage.count / max) * 100)
          return (
            <button
              key={stage.id}
              type="button"
              className="crm-funnel-viz-row"
              onClick={() => navigate(`/crm/opportunities?stage=${stage.id}`)}
              style={{ width: `${widthPct}%` }}
            >
              <div className="crm-funnel-viz-bar" style={{ background: stage.fill }}>
                <span className="crm-funnel-viz-count">{stage.count}</span>
                <span className="crm-funnel-viz-label">{stage.short}</span>
              </div>
            </button>
          )
        })}
      </div>
    </DynamicsDashboardPanel>
  )
}

export function CrmActivityTrendChart({
  activities,
  data: dataProp,
}: {
  activities?: CrmActivity[]
  data?: ActivityTrendPoint[]
}) {
  const data = useMemo(
    () => dataProp ?? buildActivityTrendData(activities ?? [], 7),
    [dataProp, activities],
  )

  return (
    <DynamicsDashboardPanel title="Activity trend (7 days)" noPadding>
      <div className="crm-chart-panel">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--erp-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--erp-muted)' }} axisLine={false} tickLine={false} />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'var(--erp-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [Number(value ?? 0), 'Activities']} />
            <Bar dataKey="count" fill="var(--erp-primary)" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
        <p className="crm-chart-caption">
          {data.reduce((s, d) => s + d.count, 0)} activities logged this week
        </p>
      </div>
    </DynamicsDashboardPanel>
  )
}

export function CrmFollowUpUrgencyChart({
  followUps,
  data: dataProp,
}: {
  followUps?: FollowUp[]
  data?: FollowUpUrgencyPoint[]
}) {
  const data = useMemo(
    () => dataProp ?? buildFollowUpUrgencyData(followUps ?? []),
    [dataProp, followUps],
  )
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <DynamicsDashboardPanel title="Follow-up urgency" noPadding>
      {total === 0 ? (
        <CrmChartEmpty message="No open follow-ups." />
      ) : (
        <div className="crm-chart-panel crm-chart-panel-split">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={4}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [v ?? 0, 'Follow-ups']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="crm-chart-outcome-legend">
            {data.map((d) => (
              <div key={d.name} className="crm-chart-outcome-row">
                <span className="crm-chart-legend-dot" style={{ background: d.color }} />
                <span className="crm-card-title">{d.name}</span>
                <span className="crm-chart-outcome-count">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function CrmOwnerPipelineChart({
  opportunities,
  data: dataProp,
}: {
  opportunities?: Opportunity[]
  data?: OwnerPipelinePoint[]
}) {
  const navigate = useNavigate()
  const data = useMemo(
    () => dataProp ?? buildOwnerPipelineData(opportunities ?? []),
    [dataProp, opportunities],
  )

  return (
    <DynamicsDashboardPanel title="Pipeline by sales owner" noPadding>
      {data.length === 0 ? (
        <CrmChartEmpty message="No open opportunities assigned." />
      ) : (
        <div className="crm-chart-panel">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--erp-border)" />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'var(--erp-muted)' }}
                tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="owner"
                width={88}
                tick={{ fontSize: 11, fill: 'var(--erp-text)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, _name, item) => {
                  const n = Number(value ?? 0)
                  const count = (item?.payload as { count?: number })?.count ?? 0
                  return [`${formatCrmCurrency(n)} · ${count} deals`, 'Pipeline']
                }}
              />
              <Bar
                dataKey="value"
                fill="var(--erp-primary)"
                radius={[0, 6, 6, 0]}
                barSize={16}
                cursor="pointer"
                onClick={() => navigate('/crm/opportunities')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DynamicsDashboardPanel>
  )
}

export function CrmHotDealsChart({
  opportunities,
  maxValue,
}: {
  opportunities: Opportunity[]
  maxValue: number
}) {
  const navigate = useNavigate()
  const data = useMemo(
    () =>
      opportunities.slice(0, 6).map((o) => ({
        id: o.id,
        name: o.opportunityName.length > 28 ? `${o.opportunityName.slice(0, 26)}…` : o.opportunityName,
        value: o.value,
        probability: o.probability,
        pct: (o.value / maxValue) * 100,
      })),
    [opportunities, maxValue],
  )

  if (!data.length) return null

  return (
    <div className="crm-hot-chart">
      {data.map((d) => (
        <button
          key={d.id}
          type="button"
          className="crm-hot-chart-row"
          onClick={() => navigate(`/crm/opportunities/${d.id}`)}
        >
          <div className="crm-hot-chart-row-top">
            <span className="crm-card-title truncate">{d.name}</span>
            <span className="crm-hot-value">{formatCrmCurrency(d.value)}</span>
          </div>
          <div className="crm-hot-chart-track">
            <div
              className="crm-hot-chart-fill"
              style={{ width: `${d.pct}%`, opacity: 0.35 + (d.probability / 100) * 0.65 }}
            />
          </div>
          <span className="crm-helper-text">{d.probability}% probability</span>
        </button>
      ))}
    </div>
  )
}
