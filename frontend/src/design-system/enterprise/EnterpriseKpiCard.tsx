import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'
import { formatRelativeTime } from '../../utils/dates/format'
import type { EnterpriseKpiItem } from './enterpriseKpiTypes'

const ACCENT_BORDER: Record<NonNullable<EnterpriseKpiItem['accent']>, string> = {
  blue: 'ent-kpi-card--accent-blue',
  green: 'ent-kpi-card--accent-green',
  amber: 'ent-kpi-card--accent-amber',
  red: 'ent-kpi-card--accent-red',
  slate: 'ent-kpi-card--accent-slate',
}

const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇'] as const

function useAnimatedNumber(value: string | number, enabled: boolean) {
  const numeric = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  const isNumeric = !Number.isNaN(numeric) && typeof value === 'number'
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    if (!enabled || !isNumeric || prev.current === value) {
      setDisplay(value)
      prev.current = value
      return
    }
    const from = typeof prev.current === 'number' ? prev.current : numeric
    const to = numeric
    const start = performance.now()
    const duration = 400
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
      else prev.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, enabled, isNumeric, numeric])

  return display
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  return (
    <span className="ent-kpi-card__sparkline" aria-hidden>
      {values.map((v, i) => {
        const idx = Math.min(SPARK_CHARS.length - 1, Math.max(0, Math.round(v * (SPARK_CHARS.length - 1))))
        return <span key={i}>{SPARK_CHARS[idx]}</span>
      })}
    </span>
  )
}

function TrendBadge({ trend }: { trend: NonNullable<EnterpriseKpiItem['trend']> }) {
  const Icon = trend.direction === 'up' ? ArrowUp : trend.direction === 'down' ? ArrowDown : Minus
  const toneClass =
    trend.tone === 'positive' || trend.direction === 'up'
      ? 'ent-kpi-card__trend--up'
      : trend.tone === 'negative' || trend.direction === 'down'
        ? 'ent-kpi-card__trend--down'
        : 'ent-kpi-card__trend--neutral'
  return (
    <span className={cn('ent-kpi-card__trend', toneClass)}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {trend.label}
    </span>
  )
}

export function EnterpriseKpiCard({
  item,
  animateValue = true,
}: {
  item: EnterpriseKpiItem
  animateValue?: boolean
}) {
  const Icon: LucideIcon | undefined = item.icon
  const clickable = Boolean(item.onClick || item.href)
  const animated = useAnimatedNumber(item.value, animateValue && typeof item.value === 'number')
  const displayValue = typeof item.value === 'number' ? animated : item.value
  const isCurrency = typeof displayValue === 'string' && /^₹/.test(displayValue)

  const secondary = item.context ?? item.helper
  const updatedLabel =
    item.updatedAt != null
      ? `Updated ${formatRelativeTime(
          typeof item.updatedAt === 'number'
            ? new Date(item.updatedAt).toISOString()
            : typeof item.updatedAt === 'string'
              ? item.updatedAt
              : item.updatedAt.toISOString(),
        )}`
      : null

  const body = (
    <>
      <div className="ent-kpi-card__head">
        <span className="ent-kpi-card__label">{item.label}</span>
        {Icon ? (
          <span className="ent-kpi-card__icon" aria-hidden>
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <div className="ent-kpi-card__value-row">
        <span className={cn('ent-kpi-card__value', isCurrency && 'ent-kpi-card__value--currency')}>{displayValue}</span>
        {item.sparkline && item.sparkline.length > 0 ? <Sparkline values={item.sparkline} /> : null}
      </div>
      {(item.trend || secondary || updatedLabel) ? (
        <div className="ent-kpi-card__foot">
          {item.trend ? <TrendBadge trend={item.trend} /> : null}
          {secondary ? <span className="ent-kpi-card__context">{secondary}</span> : null}
          {!item.trend && !secondary && updatedLabel ? (
            <span className="ent-kpi-card__context">{updatedLabel}</span>
          ) : null}
        </div>
      ) : null}
    </>
  )

  const className = cn(
    'ent-kpi-card',
    item.accent && ACCENT_BORDER[item.accent],
    clickable && 'ent-kpi-card--clickable',
    item.active && 'ent-kpi-card--active',
  )

  if (item.href) {
    return (
      <Link to={item.href} className={className}>
        {body}
      </Link>
    )
  }
  if (item.onClick) {
    return (
      <button type="button" className={className} onClick={item.onClick}>
        {body}
      </button>
    )
  }
  return <div className={className}>{body}</div>
}
