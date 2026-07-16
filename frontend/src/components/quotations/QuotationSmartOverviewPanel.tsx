import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import {
  buildQuotationAiInsight,
  buildQuotationSmartSignals,
  computeQuotationCompleteness,
  quotationOverviewTitle,
  resolveQuotationNextBestAction,
  type QuotationSmartOverviewInput,
} from '@/utils/quotationSmartOverview'
import type { CrmSmartNextAction } from '@/components/crm/CrmSmartOverviewPanel'

export interface QuotationSmartOverviewPanelProps {
  input: QuotationSmartOverviewInput
  revisionNo: number
  onGoToSection: (sectionId: string) => void
  onEdit?: () => void
  onPreview?: () => void
  onCreateSalesOrder?: () => void
  canEdit?: boolean
}

export function QuotationSmartOverviewPanel({
  input,
  revisionNo,
  onGoToSection,
  onEdit,
  onPreview,
  onCreateSalesOrder,
  canEdit = false,
}: QuotationSmartOverviewPanelProps) {
  const nextAction = resolveQuotationNextBestAction(input)
  const readiness = computeQuotationCompleteness(input)

  function runAction(action: CrmSmartNextAction) {
    if (action.id === 'convert_so' && onCreateSalesOrder) {
      onCreateSalesOrder()
      return
    }
    if (action.id === 'add_lines') {
      onGoToSection('products')
      return
    }
    if (action.id === 'set_validity' || action.id === 'link_customer') {
      onGoToSection('summary')
      return
    }
    if (action.id === 'review') {
      if (onPreview) onPreview()
      else onGoToSection('commercial')
      return
    }
    if (canEdit && onEdit) onEdit()
    else onGoToSection('summary')
  }

  const contextLine = [
    `R${revisionNo}`,
    input.ownerName?.trim() || 'Unassigned',
  ].join(' · ')

  return (
    <CrmSmartOverviewPanel
      ariaLabel="Smart quotation overview"
      title={quotationOverviewTitle(input)}
      variant="lean"
      contextLine={contextLine}
      progressLabel="Quotation readiness"
      progressPercent={readiness}
      signals={buildQuotationSmartSignals(input)}
      nextAction={nextAction}
      onNextAction={() => runAction(nextAction)}
      aiInsight={buildQuotationAiInsight(input)}
    />
  )
}
