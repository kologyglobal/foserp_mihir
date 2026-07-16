import { CrmSmartOverviewPanel } from './CrmSmartOverviewPanel'
import {
  buildCompanyAiInsight,
  buildCompanySmartSignals,
  companyContextLine,
  companyOverviewTitle,
  computeCompanyCompleteness,
  resolveCompanyNextBestAction,
  type CompanySmartOverviewInput,
} from '../../utils/companySmartOverview'

export interface CompanySmartOverviewPanelProps {
  input: CompanySmartOverviewInput
  onGoToSection: (sectionId: string, focusField?: string) => void
}

export function CompanySmartOverviewPanel({
  input,
  onGoToSection,
}: CompanySmartOverviewPanelProps) {
  const nextAction = resolveCompanyNextBestAction(input)

  function runNextAction() {
    if (nextAction.id === 'enter_name') {
      onGoToSection('quick', 'customerName')
      return
    }
    if (nextAction.id === 'complete_address') {
      onGoToSection('billing', 'addressLine1')
      return
    }
    if (nextAction.id === 'add_gstin') {
      onGoToSection('tax', 'gstin')
      return
    }
    if (nextAction.id === 'set_territory') {
      onGoToSection('quick', 'salesTerritory')
      return
    }
    onGoToSection('quick')
  }

  return (
    <CrmSmartOverviewPanel
      ariaLabel="Smart company overview"
      title={companyOverviewTitle(input)}
      variant="lean"
      contextLine={companyContextLine(input)}
      progressLabel="Company readiness"
      progressPercent={computeCompanyCompleteness(input)}
      signals={buildCompanySmartSignals(input)}
      nextAction={nextAction}
      onNextAction={runNextAction}
      aiInsight={buildCompanyAiInsight(input)}
    />
  )
}
