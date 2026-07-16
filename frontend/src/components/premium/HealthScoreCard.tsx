import { cn } from '../../utils/cn'

export function HealthScoreCard({
  score,
  label = 'Plant health',
  sublabel,
  compact = false,
}: {
  score: number
  label?: string
  sublabel?: string
  compact?: boolean
}) {
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 80 ? 'var(--erp-success)' : pct >= 60 ? 'var(--erp-warning)' : 'var(--erp-danger)'
  const size = compact ? 56 : 88
  const r = compact ? 22 : 36
  const stroke = compact ? 5 : 6
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const cx = size / 2

  const gauge = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--erp-border)" strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="d365-health-score-value">{pct}%</span>
      </div>
    </div>
  )

  if (compact) {
    return (
      <div className={cn('erp-premium-kpi erp-health-score-tile flex h-full flex-col p-4')}>
        <p className="d365-health-score-label">{label}</p>
        <div className="mt-2 flex flex-1 flex-col justify-center gap-2">
          {gauge}
          {sublabel ? <p className="d365-health-score-sublabel line-clamp-2">{sublabel}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="erp-premium-kpi flex h-full items-center gap-3 p-4">
      {gauge}
      <div className="min-w-0">
        <p className="d365-health-score-label">{label}</p>
        {sublabel && <p className="d365-health-score-sublabel">{sublabel}</p>}
      </div>
    </div>
  )
}
