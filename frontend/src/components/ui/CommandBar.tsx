import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, Circle } from 'lucide-react'
import { cn } from '../../utils/cn'

interface CommandBarProps {
  children: ReactNode
  className?: string
}

/** Compact horizontal action strip */
export function CommandBar({ children, className }: CommandBarProps) {
  return (
    <div className={cn('erp-command-bar', className)}>
      {children}
    </div>
  )
}

export function CommandBarGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="erp-command-group flex items-center gap-1.5 border-r border-erp-border px-2 py-0 last:border-r-0">
      {label && (
        <span className="erp-command-group-label mr-1 hidden sm:inline">
          {label}
        </span>
      )}
      <div className="erp-command-group__actions flex flex-nowrap items-center gap-1.5">{children}</div>
    </div>
  )
}

interface CommandBarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  /** Primary action — filled button (e.g. New Lead) */
  primary?: boolean
  /** Secondary emphasis — outlined highlight (e.g. Export) */
  accent?: boolean
}

/** Portal tooltip — escapes stacking contexts / overflow clipping so it always paints on top. */
function DisabledReasonTooltip({ anchor, text }: { anchor: HTMLElement; text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', opacity: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = anchor.getBoundingClientRect()
    const width = el.offsetWidth
    const height = el.offsetHeight
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8))
    const below = rect.bottom + 6
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below
    setStyle({ position: 'fixed', left, top, zIndex: 10060 })
  }, [anchor, text])

  return createPortal(
    <div ref={ref} role="tooltip" className="erp-tooltip-bubble" style={style}>
      {text}
    </div>,
    document.body,
  )
}

export function CommandBarButton({
  icon: Icon,
  label,
  primary,
  accent,
  className,
  title,
  disabled,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: CommandBarButtonProps) {
  // Disabled buttons get an instant portal tooltip (native title is too slow / easy to miss)
  const disabledTooltip = disabled && title ? title : undefined
  const [tipAnchor, setTipAnchor] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!disabledTooltip) setTipAnchor(null)
  }, [disabledTooltip])

  const button = (
    <button
      type="button"
      disabled={disabled}
      title={disabledTooltip ? undefined : title}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className={cn(
        'erp-command-btn',
        'inline-flex h-9 min-h-9 max-h-9 shrink-0 items-center justify-center gap-1.5',
        'box-border whitespace-nowrap rounded-lg px-3 py-0 text-[13px] font-semibold leading-none',
        'transition-[box-shadow,background,border-color,filter] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erp-primary/30 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-40',
        primary && 'erp-command-btn-primary text-white',
        accent && !primary && 'erp-command-btn-accent',
        !primary && !accent && 'border border-erp-border bg-erp-surface text-erp-text shadow-sm enabled:hover:border-erp-primary/35 enabled:hover:bg-erp-primary-soft enabled:hover:shadow-md',
        className,
      )}
      {...props}
    >
      <Icon
        className={cn(
          'erp-command-btn__icon h-4 w-4 shrink-0',
          primary ? 'text-white' : accent ? 'text-teal-700' : 'text-erp-primary',
        )}
        strokeWidth={1.75}
      />
      <span className="erp-command-btn__label">{label}</span>
    </button>
  )

  // Browsers do not dispatch JS mouse events on disabled form controls, so the
  // hover handlers must live on a wrapper element instead of the button itself.
  if (!disabledTooltip) return button
  return (
    <span
      className="erp-command-btn-wrap inline-flex h-9 items-center"
      onMouseEnter={(e) => setTipAnchor(e.currentTarget)}
      onMouseLeave={() => setTipAnchor(null)}
    >
      {button}
      {tipAnchor ? <DisabledReasonTooltip anchor={tipAnchor} text={disabledTooltip} /> : null}
    </span>
  )
}

export function CommandBarDivider() {
  return <div className="mx-0.5 w-px self-stretch bg-erp-border" />
}

export interface CommandBarOverflowAction {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  disabled?: boolean
  disabledReason?: string
  danger?: boolean
}

/** Single trigger button that opens a dropdown of secondary actions */
export function CommandBarOverflowMenu({
  actions,
  label = 'Actions',
  icon: TriggerIcon = ChevronDown,
  iconOnly = false,
}: {
  actions: CommandBarOverflowAction[]
  label?: string
  icon?: LucideIcon
  /** Icon-only trigger (e.g. three-dot More Actions) */
  iconOnly?: boolean
}) {
  const visible = actions.filter((a) => a.label)
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const positionMenu = useCallback(() => {
    const trigger = ref.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menu = menuRef.current
    const width = Math.max(menu?.offsetWidth ?? 0, 200)
    const height = menu?.scrollHeight ?? visible.length * 34 + 8
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const openUp = height > spaceBelow && spaceAbove > spaceBelow
    setMenuStyle({
      position: 'fixed',
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      maxHeight: Math.max(120, (openUp ? spaceAbove : spaceBelow) - 4),
      zIndex: 10070,
      minWidth: Math.max(width, rect.width),
    })
  }, [visible.length])

  useLayoutEffect(() => {
    if (!open) return
    positionMenu()
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', positionMenu, true)
    window.addEventListener('resize', positionMenu)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', positionMenu, true)
      window.removeEventListener('resize', positionMenu)
    }
  }, [open, positionMenu])

  if (visible.length === 0) return null

  return (
    <div className={cn('erp-command-more', iconOnly && 'erp-command-more--icon')} ref={ref}>
      {iconOnly ? (
        <button
          type="button"
          className={cn(
            'erp-command-more__icon-btn',
            open && 'erp-command-more__icon-btn--open',
          )}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={label}
          title={label}
        >
          <TriggerIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      ) : (
        <CommandBarButton
          icon={TriggerIcon}
          label={label}
          accent
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          aria-expanded={open}
          aria-haspopup="menu"
          className={open ? 'border-erp-primary/35 bg-erp-primary-soft' : undefined}
        />
      )}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="erp-command-more__menu erp-command-more__menu--portal"
              style={menuStyle}
              role="menu"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {visible.map((action) => {
                const Icon = action.icon ?? Circle
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    className={cn(
                      'erp-command-more__item',
                      action.danger && 'erp-command-more__item--danger',
                    )}
                    disabled={action.disabled}
                    title={action.disabled ? action.disabledReason : undefined}
                    onClick={() => {
                      setOpen(false)
                      action.onClick?.()
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-70" />
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
