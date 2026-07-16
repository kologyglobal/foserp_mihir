import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface StickyCommandBarProps {
  children: ReactNode
  className?: string
}

/** Sticky operational command strip — sits under page title */
export function StickyCommandBar({ children, className }: StickyCommandBarProps) {
  return (
    <div className={cn('erp-sticky-command-bar', className)}>
      {children}
    </div>
  )
}
