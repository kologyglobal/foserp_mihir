import { CrmSmartOverviewPanel } from './CrmSmartOverviewPanel'
import {
  buildOpportunityAiInsight,
  buildOpportunityHealthBreakdown,
  buildOpportunityReadinessBreakdown,
  buildOpportunitySmartSignals,
  opportunityOverviewTitle,
  resolveOpportunityNextBestAction,
  type OpportunitySmartOverviewInput,
} from '@/utils/opportunitySmartOverview'
import { opportunityStageLabel } from '@/utils/opportunityUtils'
import type { CrmSmartNextAction } from '@/components/crm/CrmSmartOverviewPanel'

export interface OpportunitySmartOverviewPanelProps {
  input: OpportunitySmartOverviewInput
  onGoToSection: (sectionId: string) => void
  onScheduleFollowUp?: () => void
  onCreateQuotation?: () => void
  onCreateSalesOrder?: () => void
  onLogActivity?: () => void
}

export function OpportunitySmartOverviewPanel({
  input,
  onGoToSection,
  onScheduleFollowUp,
  onCreateQuotation,
  onCreateSalesOrder,
}: OpportunitySmartOverviewPanelProps) {
  const nextAction = resolveOpportunityNextBestAction(input)
  const health = buildOpportunityHealthBreakdown(input)
  const readiness = buildOpportunityReadinessBreakdown(input)

  function runAction(action: CrmSmartNextAction) {
    if (action.id === 'schedule_followup' && onScheduleFollowUp) {
      onScheduleFollowUp()
      return
    }
    if (action.id === 'create_quotation' && onCreateQuotation) {
      onCreateQuotation()
      return
    }
    if (action.id === 'create_so' && onCreateSalesOrder) {
      onCreateSalesOrder()
      return
    }
    const sectionId = (action as { sectionId?: string }).sectionId
      ?? (action.id === 'add_lines' ? 'products'
        : action.id === 'set_value' ? 'commercial'
          : action.id === 'link_company' ? 'summary'
            : undefined)
    if (sectionId) onGoToSection(sectionId)
  }

  const stageOwner = `${opportunityStageLabel(input.stage)} · ${input.ownerName || '—'}`

  return (
    <CrmSmartOverviewPanel
      ariaLabel="Smart opportunity overview"
      title={opportunityOverviewTitle(input)}
      variant="lean"
      contextLine={stageOwner}
      progressLabel="Deal readiness"
      progressPercent={readiness.score}
      progressTooltip={readiness.tooltip}
      scoreCards={[
        {
          id: 'readiness',
          label: 'Deal Readiness',
          percent: readiness.score,
          tooltip: readiness.tooltip,
          factors: readiness.factors.map((f) => ({
            label: f.label,
            ok: f.ok,
            detail: f.detail,
          })),
        },
        {
          id: 'health',
          label: 'Health Score',
          percent: health.score,
          tooltip: health.tooltip,
          factors: health.factors.map((f) => ({
            label: f.label,
            ok: f.ok,
            detail: f.detail,
          })),
        },
      ]}
      signals={buildOpportunitySmartSignals(input)}
      nextAction={nextAction}
      onNextAction={() => runAction(nextAction)}
      aiInsight={buildOpportunityAiInsight(input)}
    />
  )
}
