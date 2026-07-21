import { Activity, StickyNote } from 'lucide-react'
import { CrmSmartOverviewPanel, type CrmSmartQuickAction } from './CrmSmartOverviewPanel'
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
  /** Hide gap chips on pristine create forms. Default true. */
  showGapSignals?: boolean
}

export function LeadSmartOverviewPanel({
  input,
  onGoToSection,
  onCreateOpportunity,
  onCreateQuotation,
  onScheduleFollowUp,
  onLogActivity,
  showGapSignals = true,
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

  const quickActions: CrmSmartQuickAction[] = []
  if (onLogActivity) {
    quickActions.push({
      id: 'log-activity',
      label: 'Log activity',
      icon: Activity,
      onClick: onLogActivity,
    })
  }
  if (onScheduleFollowUp && nextAction.id !== 'schedule_followup') {
    quickActions.push({
      id: 'schedule-followup',
      label: 'Schedule follow-up',
      icon: StickyNote,
      onClick: onScheduleFollowUp,
    })
  } else if (nextAction.id !== 'add_requirement') {
    quickActions.push({
      id: 'add-note',
      label: 'Add requirement note',
      icon: StickyNote,
      onClick: () => onGoToSection('requirement', 'productRequirement'),
    })
  }

  return (
    <CrmSmartOverviewPanel
      ariaLabel="Smart lead overview"
      title={leadOverviewTitle(input)}
      variant="lean"
      contextLine={stageOwner}
      progressLabel="Record Health"
      progressPercent={computeLeadQualificationPercent(input)}
      signals={buildLeadSmartSignals(input)}
      showGapSignals={showGapSignals}
      nextAction={{
        id: nextAction.id,
        title: nextAction.title,
        description: nextAction.description,
        ctaLabel: nextAction.ctaLabel,
        focusField: nextAction.focusField,
        sectionId: nextAction.sectionId ?? undefined,
      }}
      onNextAction={() => runAction(nextAction)}
      quickActions={quickActions}
      aiInsight={buildLeadAiInsight(input)}
    />
  )
}
