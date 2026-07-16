import { Sparkles } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { Enterprise360AiInsight } from './types'

const toneClass: Record<NonNullable<Enterprise360AiInsight['tone']>, string> = {
  neutral: 'ent-360-ai__item--neutral',
  info: 'ent-360-ai__item--info',
  success: 'ent-360-ai__item--success',
  warning: 'ent-360-ai__item--warning',
  critical: 'ent-360-ai__item--critical',
}

export function Enterprise360AiPanel({
  title = 'AI Insights',
  insights,
  score,
  scoreLabel = 'Health Score',
}: {
  title?: string
  insights: Enterprise360AiInsight[]
  score?: number
  scoreLabel?: string
}) {
  return (
    <aside className="ent-360-ai" aria-label={title}>
      <div className="ent-360-ai__head">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h2 className="ent-360-ai__title">{title}</h2>
      </div>
      {score != null ? (
        <div className="ent-360-ai__score">
          <span className="ent-360-ai__score-value">{score}</span>
          <span className="ent-360-ai__score-max">/100</span>
          <span className="ent-360-ai__score-label">{scoreLabel}</span>
        </div>
      ) : null}
      <ul className="ent-360-ai__list">
        {insights.map((item) => (
          <li key={item.id} className={cn('ent-360-ai__item', toneClass[item.tone ?? 'neutral'])}>
            <span className="ent-360-ai__item-label">{item.label}</span>
            <span className="ent-360-ai__item-value">{item.value}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
