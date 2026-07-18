import type { EnterpriseQuickAction } from '../../design-system/workspace/EnterpriseFormContextPanel'
import { cn } from '../../utils/cn'
import {
  PurchaseAiInsightsRestoreButton,
  PurchaseAiInsightsShell,
  PurchaseAiOverviewBlock,
  PurchaseAiSuggestionsBlock,
  usePurchaseAiInsightsOpen,
  type PurchaseAiOverviewRow,
} from './PurchaseAiInsightsPanel'

export type PurchaseRegisterOverviewRow = PurchaseAiOverviewRow

interface PurchaseRegisterContextPanelProps {
  overview: PurchaseRegisterOverviewRow[]
  suggestions: EnterpriseQuickAction[]
  ariaLabel?: string
  title?: string
  subtitle?: string
  /** Persist hide preference. Defaults to shared purchase AI insights key. */
  storageKey?: string
  className?: string
}

/**
 * List-register right rail — AI-style Overview + Suggested actions.
 * Collapsible: close hides the panel; a sparkles button restores it.
 */
export function PurchaseRegisterContextPanel({
  overview,
  suggestions,
  ariaLabel = 'Register overview and suggestions',
  title = 'Purchase Insights',
  subtitle = 'AI suggested next actions for this register.',
  storageKey,
  className,
}: PurchaseRegisterContextPanelProps) {
  const [open, setOpen] = usePurchaseAiInsightsOpen(storageKey)

  if (!open) {
    return (
      <aside
        className={cn(
          'masters-context-panel masters-context-panel--insights-collapsed sticky top-2 flex justify-end self-start',
          className,
        )}
        aria-label={ariaLabel}
      >
        <PurchaseAiInsightsRestoreButton label={title} onClick={() => setOpen(true)} />
      </aside>
    )
  }

  return (
    <aside
      className={cn('masters-context-panel w-full min-w-0 xl:w-[280px]', className)}
      aria-label={ariaLabel}
    >
      <PurchaseAiInsightsShell title={title} subtitle={subtitle} onClose={() => setOpen(false)}>
        <PurchaseAiOverviewBlock rows={overview} />
        <PurchaseAiSuggestionsBlock suggestions={suggestions} />
      </PurchaseAiInsightsShell>
    </aside>
  )
}
