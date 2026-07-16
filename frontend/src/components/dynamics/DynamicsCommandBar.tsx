import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export function DynamicsCommandBar({
  children,
  meta,
  className,
}: {
  children?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('dyn-command-bar', className)}>
      <div className="dyn-command-bar-actions">{children}</div>
      {meta && <div className="dyn-command-bar-meta">{meta}</div>}
    </div>
  )
}

export function DynamicsCommandButton({
  children,
  onClick,
  primary,
  icon,
}: {
  children: ReactNode
  onClick?: () => void
  primary?: boolean
  icon?: ReactNode
}) {
  return (
    <button type="button" className={cn('dyn-command-btn', primary && 'dyn-command-btn-primary')} onClick={onClick}>
      {icon}
      {children}
    </button>
  )
}
