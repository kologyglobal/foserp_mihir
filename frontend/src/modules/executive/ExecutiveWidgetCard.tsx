import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ExternalLink, Loader2, Settings2, X } from 'lucide-react'
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { isApiMode } from '../../config/apiConfig'
import { queryExecutiveWidget } from '../../services/api/executiveDashboardApi'
import { formatCurrency } from '../../utils/formatters/currency'
import type { DashboardGlobalFilters, DashboardWidgetLayout, WidgetQueryResult } from '../../types/executiveDashboard'
import { getWidgetDefinition } from './executiveWidgetCatalog'
import { queryWidgetDemo } from './queryWidgetDemo'
import { cn } from '../../utils/cn'

function formatValue(value: number | null | undefined, unit?: string | null) {
  if (value == null || Number.isNaN(value)) return '-'
  if (unit === 'INR') return formatCurrency(value)
  return String(value)
}

export function ExecutiveWidgetCard({
  widget,
  globalFilters,
  editing,
  onRemove,
  onConfigure,
}: {
  widget: DashboardWidgetLayout
  globalFilters: DashboardGlobalFilters
  editing: boolean
  onRemove?: () => void
  onConfigure?: () => void
}) {
  const navigate = useNavigate()
  const def = getWidgetDefinition(widget.widgetKey)
  const [result, setResult] = useState<WidgetQueryResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      try {
        if (isApiMode()) {
          const res = await queryExecutiveWidget({
            widgetKey: widget.widgetKey,
            visualization: widget.visualization,
            filters: widget.filters,
            globalFilters,
          })
          if (!cancelled) setResult(res.data)
        } else {
          if (!cancelled) setResult(queryWidgetDemo(widget.widgetKey, widget.visualization))
        }
      } catch {
        if (!cancelled) {
          // Prefer demo resolver over a dead tile when API is mid-rollout
          setResult(queryWidgetDemo(widget.widgetKey, widget.visualization))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [widget.widgetKey, widget.visualization, widget.filters, globalFilters, def?.name])

  const title = result?.title ?? def?.name ?? widget.widgetKey
  const drill = result?.drillDownPath

  return (
    <div className={cn('ceo-widget', editing && 'ceo-widget--editing')}>
      <div className="ceo-widget__header">
        <div className="min-w-0">
          <p className="ceo-widget__title">{title}</p>
          {result?.data.label ? <p className="ceo-widget__sub">{result.data.label}</p> : null}
        </div>
        <div className="ceo-widget__actions">
          {editing ? (
            <>
              <button type="button" className="ceo-widget__icon-btn" title="Configure" onClick={onConfigure}>
                <Settings2 className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="ceo-widget__icon-btn" title="Remove" onClick={onRemove}>
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : drill ? (
            <button
              type="button"
              className="ceo-widget__icon-btn"
              title="Drill down"
              onClick={() => navigate(drill)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="ceo-widget__body">
        {loading ? (
          <div className="ceo-widget__empty"><Loader2 className="h-5 w-5 animate-spin opacity-50" /></div>
        ) : result?.error ? (
          <div className="ceo-widget__empty text-[var(--saas-danger)]">
            <AlertTriangle className="mb-1 h-4 w-4" />
            <span className="text-xs">{result.error}</span>
          </div>
        ) : (
          <WidgetBody result={result!} onDrill={(href) => navigate(href)} />
        )}
      </div>
    </div>
  )
}

function WidgetBody({ result, onDrill }: { result: WidgetQueryResult; onDrill: (href: string) => void }) {
  const { visualization, data } = result

  if (visualization === 'EXCEPTION' && data.alerts) {
    return (
      <ul className="space-y-2">
        {data.alerts.map((a, i) => (
          <li key={i}>
            <button
              type="button"
              className={cn(
                'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--saas-bg-subtle)]',
                a.severity === 'critical' && 'text-[var(--saas-danger)]',
                a.severity === 'warning' && 'text-[var(--saas-warning)]',
              )}
              onClick={() => a.href && onDrill(a.href)}
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span>{a.message}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  if (visualization === 'STATUS' && data.statusCounts) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(data.statusCounts).map(([k, v]) => (
          <div key={k} className="rounded-md bg-[var(--saas-bg-subtle)] px-2 py-2">
            <p className="text-[11px] text-[var(--saas-muted)]">{k}</p>
            <p className="text-lg font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
    )
  }

  if (visualization === 'TABLE' && data.items) {
    return (
      <div className="overflow-auto">
        <table className="w-full text-left text-[12px]">
          <tbody>
            {data.items.map((row, i) => (
              <tr key={i} className="border-b border-[var(--saas-border)]/60">
                <td className="py-1.5 pr-2">
                  {row.href ? (
                    <button type="button" className="font-medium text-[var(--saas-primary)] hover:underline" onClick={() => onDrill(row.href!)}>
                      {row.label}
                    </button>
                  ) : (
                    row.label
                  )}
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold">
                  {typeof row.value === 'number' ? formatCurrency(row.value) : row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (visualization === 'PROGRESS' && data.progress) {
    const pct = Math.round(data.progress.pct)
    return (
      <div>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{formatValue(data.value, data.unit)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--saas-bg-subtle)]">
          <div className="h-full rounded-full bg-[var(--saas-primary)]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-[var(--saas-muted)]">{pct}% of plan</p>
      </div>
    )
  }

  if ((visualization === 'LINE' || visualization === 'BAR' || visualization === 'AREA') && data.labels?.length && data.series?.length) {
    const chartData = data.labels.map((label, i) => {
      const row: Record<string, string | number> = { name: label }
      for (const s of data.series!) row[s.name] = s.data[i] ?? 0
      return row
    })
    const seriesKey = data.series[0].name
    return (
      <div className="h-full min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          {visualization === 'BAR' ? (
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Tooltip />
              <Bar dataKey={seriesKey} fill="var(--saas-primary)" radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Tooltip />
              <Line type="monotone" dataKey={seriesKey} stroke="var(--saas-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  // KPI default
  const change = data.changePercentage
  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => result.drillDownPath && onDrill(result.drillDownPath)}
    >
      <p className="text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--saas-text)]">
        {formatValue(data.value, data.unit)}
      </p>
      {change != null ? (
        <p className={cn('mt-2 text-[12px] font-medium', change >= 0 ? 'text-[var(--saas-success)]' : 'text-[var(--saas-danger)]')}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs prior
        </p>
      ) : null}
    </button>
  )
}
