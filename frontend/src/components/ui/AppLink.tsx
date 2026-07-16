import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { RecordLink } from '../common/RecordLink'

/** In-app navigation link — no default blue underline */
export function AppLink({ className, children, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        'inline-flex items-center gap-1.5 font-medium text-erp-muted transition-colors hover:text-erp-primary',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  )
}

/** Table cell link for item codes, document numbers (real href via RecordLink) */
export function TableLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <RecordLink to={to} className={cn('erp-cell-link', className)}>
      {children}
    </RecordLink>
  )
}
