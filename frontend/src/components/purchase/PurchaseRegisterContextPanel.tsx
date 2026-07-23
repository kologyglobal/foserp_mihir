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

export type PurchaseRegisterFilterBarChildren = (ctx: {
  restoreButton: ReactNode
  open: boolean
  setOpen: (open: boolean) => void
}) => ReactNode

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
   * `filterBar` — gold path (Requisitions): closed = no band (page puts restore in filter `afterFilters`);
   *   open = table left | insights right. Pass children as a function to receive `restoreButton`.
   */
  placement?: 'band' | 'rail' | 'split' | 'filterBar'
  /** Required for `placement="split"` / `filterBar` — usually the register table. */
  children?: ReactNode | PurchaseRegisterFilterBarChildren
}

/**
 * Register insights panel.
 * Prefer `placement="filterBar"` so the restore sparkle sits beside Filters (Requisitions gold path).
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
  const isRail = placement === 'rail' || placement === 'split' || placement === 'filterBar'

  const restoreButton = (
    <PurchaseAiInsightsRestoreButton
      label={title}
      pressed={open}
      onClick={() => setOpen(!open)}
    />
  )

  const openPanel = (
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

  const collapsedBand = (
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
  )

  if (placement === 'filterBar' && children != null) {
    const table =
      typeof children === 'function'
        ? children({ restoreButton, open, setOpen })
        : children

    return (
      <div
        className={
          open
            ? 'purchase-register-split flex flex-col gap-3 xl:flex-row xl:items-start'
            : 'space-y-3'
        }
      >
        <div className="min-w-0 flex-1 overflow-x-auto">{table}</div>
        {open ? openPanel : null}
      </div>
    )
  }

  if (placement === 'split' && children != null) {
    const table = typeof children === 'function' ? children({ restoreButton, open, setOpen }) : children

    if (!open) {
      return (
        <div className="purchase-register-split purchase-register-split--collapsed space-y-3">
          {collapsedBand}
          <div className="min-w-0">{table}</div>
        </div>
      )
    }

    return (
      <div className="purchase-register-split flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 overflow-x-auto">{table}</div>
        {openPanel}
      </div>
    )
  }

  return open ? openPanel : collapsedBand
}
