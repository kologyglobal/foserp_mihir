import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface RowActionItem {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  /** Navigate to this path when clicked (used instead of / alongside onClick). */
  to?: string
  danger?: boolean
  disabled?: boolean
  /** Shown as title/tooltip when the action is disabled. */
  disabledReason?: string
  /** Tooltip when the action is enabled (e.g. funnel caveats). */
  title?: string
  primary?: boolean
  separator?: boolean
}

export function EnterpriseRowActionsMenu({
  actions,
  className,
}: {
  actions: RowActionItem[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const positionMenu = useCallback(() => {
    const trigger = rootRef.current
    const menu = menuRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const menuWidth = Math.max(menu?.offsetWidth ?? 0, 180)
    const menuHeight = menu?.offsetHeight ?? actions.length * 34 + 8
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const openUp = menuHeight > spaceBelow && rect.top > spaceBelow
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))

    setMenuStyle({
      position: 'fixed',
      left,
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      transform: openUp ? 'translateY(-100%)' : undefined,
      zIndex: 10050,
      minWidth: 180,
    })
  }, [actions.length])

  useLayoutEffect(() => {
    if (!open) return
    positionMenu()
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return
    positionMenu()
    window.addEventListener('scroll', positionMenu, true)
    window.addEventListener('resize', positionMenu)
    return () => {
      window.removeEventListener('scroll', positionMenu, true)
      window.removeEventListener('resize', positionMenu)
    }
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (actions.length === 0) return null

  return (
    <div className={cn('ent-row-actions', className)} ref={rootRef} data-row-actions onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="ent-row-actions__trigger"
        aria-label="Row actions"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="ent-row-actions__menu ent-row-actions__menu--portal"
              style={menuStyle}
              role="menu"
              data-row-actions
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {actions.map((action) => {
                if (action.separator) {
                  return <div key={action.id} className="ent-row-actions__separator" role="separator" />
                }
                const Icon = action.icon
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    className={cn(
                      'ent-row-actions__item',
                      action.danger && 'ent-row-actions__item--danger',
                      action.primary && 'ent-row-actions__item--primary',
                    )}
                    disabled={action.disabled}
                    title={action.disabled ? action.disabledReason : action.title}
                    onMouseDown={(e) => {
                      // Keep portal menu from losing the gesture to document outside-close races
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (action.disabled) return
                      setOpen(false)
                      // Defer so unmount/close does not cancel navigation or drawer open
                      queueMicrotask(() => {
                        action.onClick?.()
                        if (action.to) navigate(action.to)
                      })
                    }}
                  >
                    {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-70" /> : null}
                    {action.label}
                  </button>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export function EnterpriseProbabilityBadge({ value }: { value: number }) {
  const tier = value >= 70 ? 'high' : value >= 40 ? 'medium' : 'low'
  const tierLabel = tier === 'high' ? 'High' : tier === 'medium' ? 'Medium' : 'Low'
  return (
    <span
      className={cn('ent-prob-badge', `ent-prob-badge--${tier}`)}
      title={`${tierLabel} probability (${value}%)`}
    >
      <span className="ent-prob-badge__value">{value}%</span>
    </span>
  )
}

export function EnterpriseStageStepper({
  stages,
  currentId,
}: {
  stages: { id: string; label: string }[]
  currentId: string
}) {
  return (
    <div className="ent-stage-stepper" aria-label="Stage progression">
      {stages.map((step, i) => (
        <span key={step.id} className="contents">
          {i > 0 ? (
            <span className="ent-stage-stepper__sep" aria-hidden>
              ›
            </span>
          ) : null}
          <span
            className={cn(
              'ent-stage-stepper__step',
              step.id === currentId && 'ent-stage-stepper__step--current',
            )}
          >
            {step.label}
          </span>
        </span>
      ))}
    </div>
  )
}

export function ActivityIndicatorStrip({
  counts,
}: {
  counts: Partial<Record<'calls' | 'emails' | 'meetings' | 'tasks' | 'notes' | 'followUps', number>>
}) {
  const items: { key: string; label: string; count: number }[] = [
    { key: 'calls', label: 'Calls', count: counts.calls ?? 0 },
    { key: 'emails', label: 'Emails', count: counts.emails ?? 0 },
    { key: 'meetings', label: 'Meetings', count: counts.meetings ?? 0 },
    { key: 'tasks', label: 'Tasks', count: counts.tasks ?? 0 },
    { key: 'notes', label: 'Notes', count: counts.notes ?? 0 },
    { key: 'followUps', label: 'F/U', count: counts.followUps ?? 0 },
  ].filter((x) => x.count > 0)

  if (items.length === 0) return <span className="text-[12px] text-erp-muted">—</span>

  return (
    <div className="ent-activity-strip">
      {items.map((item) => (
        <span
          key={item.key}
          className={cn('ent-activity-pill', item.count > 0 && 'ent-activity-pill--active')}
          title={`${item.label}: ${item.count}`}
        >
          {item.label} {item.count}
        </span>
      ))}
    </div>
  )
}

export function EnterpriseEmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="ent-empty-state">
      <p className="ent-empty-state__title">{title}</p>
      {description ? <p className="ent-empty-state__desc">{description}</p> : null}
      {action}
    </div>
  )
}

export function EnterpriseBulkActionBar({
  count,
  children,
  onClear,
}: {
  count: number
  children: ReactNode
  onClear: () => void
}) {
  if (count <= 0) return null
  return (
    <div className="ent-bulk-bar">
      <span className="text-[13px] font-semibold text-erp-primary">{count} selected</span>
      {children}
      <button type="button" className="text-[12px] font-semibold text-erp-muted hover:text-erp-text" onClick={onClear}>
        Clear
      </button>
    </div>
  )
}
