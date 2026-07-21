import type { ReactNode } from 'react'
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
  /**
   * `band` — full-width above the table (default).
   * `rail` — sticky column (parent supplies flex row).
   * `split` — wraps `children`: open = table left | insights right; closed = sparkle above table.
   */
  placement?: 'band' | 'rail' | 'split'
  /** Required for `placement="split"` — usually the register table. */
  children?: ReactNode
}

/**
 * Register insights panel.
 * `split`: open → table left + insights right; closed → restore sparkle above table.
 */
export function PurchaseRegisterContextPanel({
  overview,
  suggestions,
  ariaLabel = 'Register overview and suggestions',
  title = 'Purchase Insights',
  subtitle = 'AI suggested next actions for this register.',
  storageKey,
  className,
  placement = 'band',
  children,
}: PurchaseRegisterContextPanelProps) {
  const [open, setOpen] = usePurchaseAiInsightsOpen(storageKey)
  const isRail = placement === 'rail' || placement === 'split'

  const panel = !open ? (
    <div
      className={cn(
        'purchase-register-insights purchase-register-insights--collapsed',
        placement === 'rail' && 'purchase-register-insights--rail purchase-register-insights--rail-collapsed',
        className,
      )}
      aria-label={ariaLabel}
    >
      <PurchaseAiInsightsRestoreButton label={title} onClick={() => setOpen(true)} />
    </div>
  ) : (
    <div
      className={cn(
        'purchase-register-insights',
        isRail && 'purchase-register-insights--rail',
        className,
      )}
      aria-label={ariaLabel}
    >
      <PurchaseAiInsightsShell
        title={title}
        subtitle={subtitle}
        variant="register"
        onClose={() => setOpen(false)}
      >
        <PurchaseAiOverviewBlock rows={overview} />
        <PurchaseAiSuggestionsBlock suggestions={suggestions} />
      </PurchaseAiInsightsShell>
    </div>
  )

  if (placement === 'split' && children != null) {
    if (!open) {
      return (
        <div className="purchase-register-split purchase-register-split--collapsed space-y-3">
          {panel}
          <div className="min-w-0">{children}</div>
        </div>
      )
    }

    return (
      <div className="purchase-register-split flex flex-row items-start gap-3">
        <div className="min-w-0 flex-1 overflow-x-auto">{children}</div>
        {panel}
      </div>
    )
  }

  return panel
}
