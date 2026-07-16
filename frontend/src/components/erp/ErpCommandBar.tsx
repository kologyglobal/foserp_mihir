import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Circle } from 'lucide-react'
import { StickyCommandBar } from '../design-system/StickyCommandBar'
import { CommandBar, CommandBarButton, CommandBarGroup, CommandBarOverflowMenu } from '../ui/CommandBar'
import { MQ_BELOW_LG, useMediaQuery } from '../../hooks/useMediaQuery'
import { cn } from '../../utils/cn'

export interface ErpCommandAction {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost'
  disabled?: boolean
  disabledReason?: string
  hidden?: boolean
  /**
   * Keep visible when `collapseSecondaryOnNarrow` collapses the bar below `lg`.
   * Use for Save Draft alongside primary Submit.
   */
  pin?: boolean
}

interface ErpCommandBarProps {
  children?: ReactNode
  primaryAction?: ErpCommandAction
  /** Import, Export, Refresh — visible secondary actions */
  secondaryActions?: ErpCommandAction[]
  /** Save View, Duplicate, Archive — overflow menu */
  moreActions?: ErpCommandAction[]
  destructiveActions?: ErpCommandAction[]
  sticky?: boolean
  /** Inline in page title row (enterprise layout) */
  inline?: boolean
  className?: string
  groupLabel?: string
  /**
   * Below `lg`, move unpinned secondary actions into “More actions”.
   * Default: true for inline bars (purchase / CRM document editors).
   */
  collapseSecondaryOnNarrow?: boolean
  /** Label for the overflow menu (default: More actions) */
  moreActionsLabel?: string
}

function renderAction(action: ErpCommandAction) {
  if (action.hidden) return null
  const Icon = action.icon ?? Circle
  return (
    <CommandBarButton
      key={action.id}
      icon={Icon}
      label={action.label}
      primary={action.variant === 'primary'}
      accent={action.variant === 'accent' || action.variant === 'secondary'}
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.disabled ? action.disabledReason : undefined}
    />
  )
}

function toOverflow(actions: ErpCommandAction[]) {
  return actions
    .filter((a) => !a.hidden)
    .map((a) => ({
      id: a.id,
      label: a.label,
      icon: a.icon,
      onClick: a.onClick,
      disabled: a.disabled,
      disabledReason: a.disabledReason,
    }))
}

/** Unified ERP command bar — list, detail, and transactional pages */
export function ErpCommandBar({
  children,
  primaryAction,
  secondaryActions = [],
  moreActions = [],
  destructiveActions = [],
  sticky = true,
  inline = false,
  className,
  groupLabel = 'Actions',
  collapseSecondaryOnNarrow = inline,
  moreActionsLabel = 'More actions',
}: ErpCommandBarProps) {
  const narrow = useMediaQuery(MQ_BELOW_LG, collapseSecondaryOnNarrow)

  const visibleSecondary = narrow
    ? secondaryActions.filter((a) => a.pin)
    : secondaryActions
  const collapsedSecondary = narrow
    ? secondaryActions.filter((a) => !a.pin)
    : []
  const overflowActions = [...collapsedSecondary, ...moreActions, ...destructiveActions]
  const showOverflow = overflowActions.some((a) => !a.hidden)

  const bar = (
    <CommandBar className={cn(inline && 'erp-command-bar--inline', className)}>
      {children ?? (
        <CommandBarGroup label={inline ? undefined : groupLabel}>
          {primaryAction ? renderAction({ ...primaryAction, variant: 'primary' }) : null}
          {visibleSecondary.map((a) => renderAction({ ...a, variant: a.variant ?? 'secondary' }))}
          {showOverflow ? (
            <CommandBarOverflowMenu
              actions={toOverflow(overflowActions)}
              label={moreActionsLabel}
            />
          ) : (
            destructiveActions.map((a) => renderAction({ ...a, variant: a.variant ?? 'accent' }))
          )}
        </CommandBarGroup>
      )}
    </CommandBar>
  )

  if (inline || !sticky) return bar
  return <StickyCommandBar>{bar}</StickyCommandBar>
}
