import { Sparkles } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { EnterpriseAiInsight } from './types'

const toneClass: Record<NonNullable<EnterpriseAiInsight['tone']>, string> = {
  neutral: '',
  info: 'ent-ws-ai__item--info',
  success: 'ent-ws-ai__item--success',
  warning: 'ent-ws-ai__item--warning',
  critical: 'ent-ws-ai__item--critical',
}

export function EnterpriseAiInsightsPanel({ insights }: { insights: EnterpriseAiInsight[] }) {
  if (!insights.length) return null

  return (
    <div className="ent-ws-ai" aria-label="AI insights">
      <p className="ent-ws-ai__title">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        AI Insights
      </p>
      <ul className="ent-ws-ai__list">
        {insights.map((insight) => (
          <li key={insight.id} className={cn('ent-ws-ai__item', insight.tone ? toneClass[insight.tone] : '')}>
            <span className="ent-ws-ai__label">{insight.label}</span>
            <span className="ent-ws-ai__value">{insight.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
