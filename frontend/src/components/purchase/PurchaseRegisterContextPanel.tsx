import type { EnterpriseQuickAction } from '../../design-system/workspace/EnterpriseFormContextPanel'
import {
  PurchaseAiInsightsShell,
  PurchaseAiOverviewBlock,
  PurchaseAiSuggestionsBlock,
  type PurchaseAiOverviewRow,
} from './PurchaseAiInsightsPanel'

export type PurchaseRegisterOverviewRow = PurchaseAiOverviewRow

interface PurchaseRegisterContextPanelProps {
  overview: PurchaseRegisterOverviewRow[]
  suggestions: EnterpriseQuickAction[]
  ariaLabel?: string
  title?: string
  subtitle?: string
}

/**
 * List-register right rail — AI-style Overview + Suggested actions.
 */
export function PurchaseRegisterContextPanel({
  overview,
  suggestions,
  ariaLabel = 'Register overview and suggestions',
  title = 'Purchase Insights',
  subtitle = 'AI suggested next actions for this register.',
}: PurchaseRegisterContextPanelProps) {
  return (
    <aside className="masters-context-panel min-w-0" aria-label={ariaLabel}>
      <PurchaseAiInsightsShell title={title} subtitle={subtitle}>
        <PurchaseAiOverviewBlock rows={overview} />
        <PurchaseAiSuggestionsBlock suggestions={suggestions} />
      </PurchaseAiInsightsShell>
    </aside>
  )
}
