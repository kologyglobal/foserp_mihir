import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Circle } from 'lucide-react'
import { StickyCommandBar } from '../design-system/StickyCommandBar'
import { CommandBar, CommandBarButton, CommandBarGroup, CommandBarOverflowMenu } from '../ui/CommandBar'
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
   * Prefer keeping this action in the visible header when overflow kicks in
   * (e.g. Edit / Save Draft next to primary Submit).
   */
  pin?: boolean
}

interface ErpCommandBarProps {
  children?: ReactNode
  primaryAction?: ErpCommandAction
  /** Header/overflow candidates (after primary) */
  secondaryActions?: ErpCommandAction[]
  /** Extra overflow candidates (merged into the same ≤3 rule) */
  moreActions?: ErpCommandAction[]
  destructiveActions?: ErpCommandAction[]
  sticky?: boolean
  /** Inline in page title row (enterprise layout) */
  inline?: boolean
  className?: string
  /** Optional group label left of buttons. Omitted by default (no “Actions” chrome). */
  groupLabel?: string
  /**
   * @deprecated Replaced by the ≤3 header rule. Kept for call-site compatibility.
   */
  collapseSecondaryOnNarrow?: boolean
  /** Label for the overflow menu (default: More) */
  moreActionsLabel?: string
  /**
   * Max buttons in the header before overflow.
   * ≤ this count → show all. > this count → keep (max - 1) outside + More.
   * Default: 3 → 1–3 stay in header; 4+ → 2 outside + More.
   */
  maxHeaderActions?: number
}

type HeaderAction = ErpCommandAction & { variant: NonNullable<ErpCommandAction['variant']> }

function renderAction(action: HeaderAction) {
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
      danger: a.id === 'cancel' || a.id === 'close' || a.id === 'delete',
    }))
}

/**
 * Header button rule:
 * - 1–3 visible actions → show all in the header (no More)
 * - 4+ visible actions → keep 2 in the header, put the rest under More
 */
export function splitHeaderActions(
  actions: HeaderAction[],
  maxHeaderActions = 3,
): { header: HeaderAction[]; overflow: HeaderAction[] } {
  const max = Math.max(1, maxHeaderActions)
  if (actions.length <= max) {
    return { header: actions, overflow: [] }
  }
  const keepOutside = Math.max(1, max - 1)
  // Primary is usually first; then prefer pinned actions among the rest.
  const [first, ...rest] = actions
  const pinned = rest.filter((a) => a.pin)
  const unpinned = rest.filter((a) => !a.pin)
  const ordered = first ? [first, ...pinned, ...unpinned] : [...pinned, ...unpinned]
  return {
    header: ordered.slice(0, keepOutside),
    overflow: ordered.slice(keepOutside),
  }
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
  groupLabel,
  moreActionsLabel = 'More',
  maxHeaderActions = 3,
}: ErpCommandBarProps) {
  const pool: HeaderAction[] = []

  if (primaryAction && !primaryAction.hidden) {
    pool.push({ ...primaryAction, variant: 'primary' })
  }
  for (const a of secondaryActions) {
    if (a.hidden) continue
    pool.push({ ...a, variant: a.variant ?? 'secondary' })
  }
  for (const a of moreActions) {
    if (a.hidden) continue
    pool.push({ ...a, variant: a.variant ?? 'secondary' })
  }
  for (const a of destructiveActions) {
    if (a.hidden) continue
    pool.push({ ...a, variant: a.variant ?? 'accent' })
  }

  const { header, overflow } = splitHeaderActions(pool, maxHeaderActions)

  const bar = (
    <CommandBar className={cn(inline && 'erp-command-bar--inline', className)}>
      {children ?? (
        <CommandBarGroup label={inline ? undefined : groupLabel}>
          {header.map((a) => renderAction(a))}
          {overflow.length > 0 ? (
            <CommandBarOverflowMenu actions={toOverflow(overflow)} label={moreActionsLabel} />
          ) : null}
        </CommandBarGroup>
      )}
    </CommandBar>
  )

  if (inline || !sticky) return bar
  return <StickyCommandBar>{bar}</StickyCommandBar>
}
