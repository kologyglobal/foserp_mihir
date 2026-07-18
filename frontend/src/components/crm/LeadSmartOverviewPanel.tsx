import { CrmSmartOverviewPanel } from './CrmSmartOverviewPanel'
import {
  buildLeadAiInsight,
  buildLeadSmartSignals,
  computeLeadQualificationPercent,
  leadOverviewTitle,
  resolveLeadNextBestAction,
  type LeadNextBestAction,
  type LeadSmartOverviewInput,
} from '../../utils/leadSmartOverview'
import { leadStageLabel } from '../../utils/leadUtils'

export interface LeadSmartOverviewPanelProps {
  input: LeadSmartOverviewInput
  onGoToSection: (sectionId: string, focusField?: string) => void
  onCreateOpportunity: () => void
  onCreateQuotation?: () => void
  onScheduleFollowUp?: () => void
  onLogActivity?: () => void
}

export function LeadSmartOverviewPanel({
  input,
  onGoToSection,
  onCreateOpportunity,
  onCreateQuotation,
  onScheduleFollowUp,
}: LeadSmartOverviewPanelProps) {
  const nextAction = resolveLeadNextBestAction(input)

  function runAction(action: LeadNextBestAction) {
    if (action.id === 'create_opportunity') {
      onCreateOpportunity()
      return
    }
    if (action.id === 'create_quotation' && onCreateQuotation) {
      onCreateQuotation()
      return
    }
    if (action.id === 'schedule_followup' && onScheduleFollowUp) {
      onScheduleFollowUp()
      return
    }
    if (action.sectionId) onGoToSection(action.sectionId, action.focusField)
  }

  const stageOwner = `${leadStageLabel(input.leadStage)} · ${input.ownerName || '—'}`

  return (
    <CrmSmartOverviewPanel
      ariaLabel="Smart lead overview"
      title={leadOverviewTitle(input)}
      variant="lean"
      contextLine={stageOwner}
      progressPercent={computeLeadQualificationPercent(input)}
      signals={buildLeadSmartSignals(input)}
      nextAction={{
        id: nextAction.id,
        title: nextAction.title,
        description: nextAction.description,
        ctaLabel: nextAction.ctaLabel,
        focusField: nextAction.focusField,
        sectionId: nextAction.sectionId ?? undefined,
      }}
      onNextAction={() => runAction(nextAction)}
      aiInsight={buildLeadAiInsight(input)}
    />
  )
}
