import type { ReactNode } from 'react'
import {
  EnterpriseFormContextPanel,
  type EnterpriseQuickAction,
} from '../../design-system/workspace/EnterpriseFormContextPanel'

export interface PurchaseRegisterOverviewRow {
  label: string
  value: ReactNode
  highlight?: boolean
}

interface PurchaseRegisterContextPanelProps {
  overview: PurchaseRegisterOverviewRow[]
  suggestions: EnterpriseQuickAction[]
  ariaLabel?: string
}

/**
 * List-register right rail — Overview + Suggestions.
 * Reuses CRM/enterprise `EnterpriseFormContextPanel` (same as form fact-box context).
 */
export function PurchaseRegisterContextPanel({
  overview,
  suggestions,
  ariaLabel = 'Register overview and suggestions',
}: PurchaseRegisterContextPanelProps) {
  return (
    <aside className="masters-context-panel min-w-0" aria-label={ariaLabel}>
      <EnterpriseFormContextPanel
        summaryTitle="Overview"
        actionsTitle="Suggestions"
        summary={overview}
        actions={suggestions}
      />
    </aside>
  )
}
