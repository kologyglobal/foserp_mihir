import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, TrendingUp, Trophy, XCircle } from 'lucide-react'
import type { Opportunity } from '../../types/crm'
import { buildPipelineFunnelData, formatCrmCurrency } from '../../utils/crmMetrics'
import { CLOSED_STAGES, resolveStageTheme } from '../../utils/crmStageTheme'
import { cn } from '../../utils/cn'

interface CrmPipelineFunnelProps {
  opportunities?: Opportunity[]
  variant?: 'hero' | 'compact'
  onStageClick?: (stageId: Opportunity['stage']) => void
  className?: string
}

export function CrmPipelineFunnel({
  opportunities = [],
  variant = 'hero',
  onStageClick,
  className,
}: CrmPipelineFunnelProps) {
  const navigate = useNavigate()
  const funnel = useMemo(
    () => buildPipelineFunnelData(opportunities, { includeClosed: variant === 'hero' }),
    [opportunities, variant],
  )

  const openStages = funnel.stages.filter((s) => !CLOSED_STAGES.has(s.id) && s.id !== 'on_hold')
  const closedStages = funnel.stages.filter((s) => CLOSED_STAGES.has(s.id))
  const maxCount = Math.max(...openStages.map((s) => s.count), 1)

  function handleStageClick(stageId: Opportunity['stage']) {
    if (onStageClick) {
      onStageClick(stageId)
      return
    }
    navigate(`/crm/opportunities?stage=${stageId}`)
  }

  if (variant === 'compact') {
    const stagesToShow = [...openStages, ...funnel.stages.filter((s) => s.id === 'on_hold')]
    return (
      <section className={cn('crm-opp-funnel-strip', className)}>
        <div className="crm-opp-funnel-strip__header">
          <div>
            <h2 className="crm-opp-funnel-strip__title">Pipeline overview</h2>
            <p className="crm-opp-funnel-strip__subtitle">Click a stage to jump to its column</p>
          </div>
          <div className="crm-opp-funnel-strip__summary">
            <div className="crm-opp-funnel-strip__stat">
              <span className="crm-kpi-label">Open pipeline</span>
              <span className="crm-opp-funnel-strip__value">{formatCrmCurrency(funnel.openPipeline)}</span>
            </div>
            <div className="crm-opp-funnel-strip__stat">
              <span className="crm-kpi-label">Weighted</span>
              <span className="crm-opp-funnel-strip__value crm-opp-funnel-strip__value--accent">
                {formatCrmCurrency(funnel.weightedPipeline)}
              </span>
            </div>
          </div>
        </div>
        <div className="crm-pipeline-stage-scroll crm-opp-funnel-strip__stages" role="list">
          {stagesToShow.map(({ id, label, count, value }) => {
            const theme = resolveStageTheme(id)
            const barPct = count === 0 ? 6 : Math.max(18, (count / maxCount) * 100)
            return (
              <button
                key={id}
                type="button"
                role="listitem"
                onClick={() => handleStageClick(id)}
                className="crm-opp-funnel-stage"
                aria-label={`${label}: ${count} deals, ${formatCrmCurrency(value)}`}
              >
                <div className="crm-opp-funnel-stage__head">
                  <h3 className="crm-opp-funnel-stage__name">{label}</h3>
                  <span className={cn('crm-opp-funnel-stage__count', theme.pill)}>{count}</span>
                </div>
                <div className="crm-opp-funnel-stage__bar-track" aria-hidden>
                  <div
                    className={cn('crm-opp-funnel-stage__bar-fill', theme.accent)}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <p className="crm-opp-funnel-stage__value">{formatCrmCurrency(value)}</p>
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative p-5 lg:p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-300/90">Sales pipeline</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight lg:text-2xl">Opportunity funnel</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              Live deal flow from first contact through negotiation — click any stage to drill into deals.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Open pipeline</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-300">{formatCrmCurrency(funnel.openPipeline)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Weighted forecast</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-sky-300">{formatCrmCurrency(funnel.weightedPipeline)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Won YTD</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-lg font-bold tabular-nums text-amber-300">
                <Trophy className="h-4 w-4 shrink-0" />
                {formatCrmCurrency(funnel.wonValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
          <div className="space-y-1.5">
            {openStages.map((stage, index) => {
              const theme = resolveStageTheme(stage.id)
              const widthPct = stage.count === 0 ? 18 : Math.max(22, (stage.count / maxCount) * 100)
              const isLast = index === openStages.length - 1

              return (
                <div key={stage.id} className="group">
                  <button
                    type="button"
                    onClick={() => handleStageClick(stage.id)}
                    className="relative mx-auto block w-full transition-transform duration-200 hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    style={{ maxWidth: `${widthPct}%` }}
                  >
                    <div
                      className="relative overflow-hidden rounded-lg px-4 py-2.5 shadow-lg transition-shadow group-hover:shadow-xl"
                      style={{
                        background: `linear-gradient(135deg, ${theme.funnel}ee, ${theme.funnel}99)`,
                        borderBottom: isLast ? 'none' : `2px solid ${theme.funnel}44`,
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="min-w-0 text-left">
                          <p className="truncate text-[13px] font-bold">{stage.label}</p>
                          <p className="text-[11px] tabular-nums text-white/80">{formatCrmCurrency(stage.value)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-2xl font-black tabular-nums leading-none">{stage.count}</span>
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-white/70">deals</p>
                        </div>
                      </div>
                    </div>
                  </button>

                  {!isLast && stage.conversionFromPrev !== null && openStages[index + 1] ? (
                    <div className="flex items-center justify-center gap-1 py-0.5 text-[10px] text-slate-400">
                      <ChevronRight className="h-3 w-3 rotate-90 opacity-50" />
                      <span>
                        {openStages[index + 1].conversionFromPrev !== null
                          ? `${openStages[index + 1].conversionFromPrev}% advance`
                          : '—'}
                      </span>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Outcomes</p>
            {closedStages.map((stage) => {
              const theme = resolveStageTheme(stage.id)
              const Icon = stage.id === 'won' ? Trophy : XCircle
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => handleStageClick(stage.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:scale-[1.02]',
                    stage.id === 'won'
                      ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20'
                      : 'border-red-500/30 bg-red-500/10 hover:bg-red-500/20',
                  )}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${theme.funnel}33` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: theme.funnel }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{stage.label}</p>
                    <p className="text-xs tabular-nums text-slate-300">
                      {stage.count} deals · {formatCrmCurrency(stage.value)}
                    </p>
                  </div>
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => navigate('/crm/opportunities')}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Open full pipeline
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            {openStages.reduce((s, st) => s + st.count, 0)} active deals in pipeline
          </span>
          <span>·</span>
          <span>{funnel.wonCount} won · {funnel.lostCount} lost</span>
        </div>
      </div>
    </section>
  )
}
