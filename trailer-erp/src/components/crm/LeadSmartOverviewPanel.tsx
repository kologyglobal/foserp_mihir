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
  onGoToSection: (sectionId: string) => void
  onCreateOpportunity: () => void
  onScheduleFollowUp?: () => void
  onLogActivity?: () => void
}

export function LeadSmartOverviewPanel({
  input,
  onGoToSection,
  onCreateOpportunity,
  onScheduleFollowUp,
}: LeadSmartOverviewPanelProps) {
  const nextAction = resolveLeadNextBestAction(input)

  function runAction(action: LeadNextBestAction) {
    if (action.id === 'create_opportunity') {
      onCreateOpportunity()
      return
    }
    if (action.id === 'schedule_followup' && onScheduleFollowUp) {
      onScheduleFollowUp()
      return
    }
    if (action.sectionId) onGoToSection(action.sectionId)
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
      nextAction={nextAction}
      onNextAction={() => runAction(nextAction)}
      aiInsight={buildLeadAiInsight(input)}
    />
  )
}
