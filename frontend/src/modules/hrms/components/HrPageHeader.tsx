import type { ReactNode } from 'react'
import { HrEmployeeCell } from './HrEmployeeCell'
import { cn } from '@/utils/cn'

interface HrPageHeaderProps {
  name: string
  code?: string | null
  /** e.g. "Senior Engineer · Manufacturing" */
  subtitle?: string | null
  branch?: string | null
  status?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Compact record header for Employee 360 (and similar HR detail pages) —
 * avatar + name/code, designation · department subtitle, status chip, actions.
 * Use below OperationalPageShell's backLink; the shell itself covers title/breadcrumbs elsewhere.
 */
export function HrPageHeader({ name, code, subtitle, branch, status, actions, className }: HrPageHeaderProps) {
  return (
    <div className={cn('hr-page-header', className)}>
      <div className="hr-page-header__identity">
        <HrEmployeeCell name={name} code={code} size="md" />
        <div className="hr-page-header__meta">
          {subtitle ? <span className="hr-page-header__subtitle">{subtitle}</span> : null}
          {branch ? <span className="hr-page-header__branch">{branch}</span> : null}
        </div>
      </div>
      <div className="hr-page-header__end">
        {status}
        {actions}
      </div>
    </div>
  )
}
