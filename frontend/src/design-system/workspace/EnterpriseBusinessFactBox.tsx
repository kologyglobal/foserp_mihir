import type { ReactNode } from 'react'
import { ErpFactBoxPanel } from '../../components/erp/card-form/ErpFactBoxPanel'
import { EnterpriseAiInsightsPanel } from './EnterpriseAiInsightsPanel'
import { EnterpriseCompletionProgress } from './EnterpriseCompletionProgress'
import { EnterpriseFinancialSummary } from './EnterpriseFinancialSummary'
import { EnterpriseRelatedRecords } from './EnterpriseRelatedRecords'
import { EnterpriseTimeline } from './EnterpriseTimeline'
import type {
  EnterpriseAiInsight,
  EnterpriseCompletionItem,
  EnterpriseFinancialLine,
  EnterpriseRelatedRecord,
  EnterpriseTimelineEvent,
} from './types'

export interface EnterpriseBusinessFactBoxProps {
  title?: string
  completion?: { percent: number; items: EnterpriseCompletionItem[] }
  aiInsights?: EnterpriseAiInsight[]
  timeline?: EnterpriseTimelineEvent[]
  related?: { title: string; records: EnterpriseRelatedRecord[] }[]
  financial?: EnterpriseFinancialLine[]
  children?: ReactNode
}

/** Sticky right-rail business insights — customer context, AI, related records, financials */
export function EnterpriseBusinessFactBox({
  title = 'Business Insights',
  completion,
  aiInsights = [],
  timeline = [],
  related = [],
  financial = [],
  children,
}: EnterpriseBusinessFactBoxProps) {
  return (
    <ErpFactBoxPanel title={title} sticky>
      <div className="ent-ws-factbox">
        {completion ? (
          <EnterpriseCompletionProgress percent={completion.percent} items={completion.items} />
        ) : null}
        {children}
        <EnterpriseAiInsightsPanel insights={aiInsights} />
        {financial.length > 0 ? <EnterpriseFinancialSummary lines={financial} /> : null}
        {related.map((group) => (
          <EnterpriseRelatedRecords key={group.title} title={group.title} records={group.records} />
        ))}
        {timeline.length > 0 ? <EnterpriseTimeline events={timeline} /> : null}
      </div>
    </ErpFactBoxPanel>
  )
}
