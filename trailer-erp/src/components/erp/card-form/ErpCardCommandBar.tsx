import { useEffect, useState, type ReactNode } from 'react'
import {
  CommandBar,
  CommandBarButton,
  CommandBarDivider,
  CommandBarGroup,
  CommandBarOverflowMenu,
} from '../../ui/CommandBar'
import type { ErpCardCommandAction } from './types'
import { cn } from '../../../utils/cn'

interface ErpCardCommandBarProps {
  homeActions?: ErpCardCommandAction[]
  reportActions?: ErpCardCommandAction[]
  moreActions?: ErpCardCommandAction[]
  children?: ReactNode
  className?: string
  /** Inline in unified workspace header — hides group labels */
  inline?: boolean
  /** Label for the overflow menu trigger (default: Actions) */
  overflowMenuLabel?: string
  /**
   * On viewports ≤1023px, collapse non-primary / non-pinned home actions into the overflow menu.
   * Default: true for `inline` bars (360 workspaces).
   */
  collapseSecondaryOnNarrow?: boolean
}

function ActionGroup({
  label,
  actions,
  inline,
}: {
  label: string
  actions?: ErpCardCommandAction[]
  inline?: boolean
}) {
  if (!actions?.length) return null
  return (
    <CommandBarGroup label={inline ? undefined : label}>
      {actions.filter((a) => a.icon).map((action) => (
        <CommandBarButton
          key={action.id}
          icon={action.icon!}
          label={action.label}
          primary={action.primary}
          accent={action.accent}
          disabled={action.disabled}
          title={action.disabled ? action.disabledReason : undefined}
          onClick={action.onClick}
        />
      ))}
    </CommandBarGroup>
  )
}

function toOverflowActions(actions: ErpCardCommandAction[]) {
  return actions
    .filter((a) => a.icon)
    .map((action) => ({
      id: action.id,
      label: action.label,
      icon: action.icon,
      onClick: action.onClick,
      disabled: action.disabled,
      disabledReason: action.disabledReason,
      danger: action.danger,
    }))
}

function useNarrowViewport(enabled: boolean) {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 1023px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [enabled])

  return enabled && narrow
}

/** Standard BC-style command bar: Home | Reports | Actions ▾ */
export function ErpCardCommandBar({
  homeActions = [],
  reportActions = [],
  moreActions = [],
  children,
  className,
  inline = false,
  overflowMenuLabel = 'Actions',
  collapseSecondaryOnNarrow = inline,
}: ErpCardCommandBarProps) {
  const narrow = useNarrowViewport(collapseSecondaryOnNarrow)

  const visibleHome = narrow
    ? homeActions.filter((a) => a.primary || a.pin)
    : homeActions
  const collapsedHome = narrow
    ? homeActions.filter((a) => !(a.primary || a.pin))
    : []
  const overflowActions = [...collapsedHome, ...moreActions]

  const hasGroups = visibleHome.length > 0 || reportActions.length > 0 || overflowActions.length > 0

  return (
    <CommandBar className={cn('erp-card-form-command-bar', inline && 'erp-command-bar--inline', className)}>
      {hasGroups ? (
        <>
          <ActionGroup label="Home" actions={visibleHome} inline={inline} />
          {reportActions.length > 0 ? <CommandBarDivider /> : null}
          <ActionGroup label="Reports" actions={reportActions} inline={inline} />
          {overflowActions.length > 0 ? (
            <>
              <CommandBarDivider />
              <CommandBarGroup label={inline ? undefined : overflowMenuLabel}>
                <CommandBarOverflowMenu
                  actions={toOverflowActions(overflowActions)}
                  label={overflowMenuLabel}
                />
              </CommandBarGroup>
            </>
          ) : null}
        </>
      ) : null}
      {children}
    </CommandBar>
  )
}

export { CommandBar, CommandBarButton, CommandBarGroup, CommandBarDivider }
