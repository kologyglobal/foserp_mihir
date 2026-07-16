import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '../../utils/cn'

/**
 * Real record hyperlink for document numbers, customer names, etc.
 * Supports Ctrl/Cmd-click, middle-click, and browser "Open in new tab".
 * Do not force target="_blank" — normal click stays in-app via React Router.
 */
export function RecordLink({ className, children, ...props }: LinkProps) {
  return (
    <Link className={cn('record-link', className)} {...props}>
      {children}
    </Link>
  )
}

/** Table document-number / code cell — RecordLink with monospace key styling */
export function RecordIdLink({
  to,
  children,
  className,
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  return (
    <RecordLink to={to} className={cn('erp-cell-link', className)}>
      {children}
    </RecordLink>
  )
}
