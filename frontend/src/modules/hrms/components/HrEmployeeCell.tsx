import { cn } from '@/utils/cn'

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

interface HrEmployeeCellProps {
  name: string
  code?: string | null
  className?: string
  size?: 'sm' | 'md'
}

/** Avatar-initials + name + employee code — the standard employee identity cell across HRMS registers. */
export function HrEmployeeCell({ name, code, className, size = 'md' }: HrEmployeeCellProps) {
  return (
    <div className={cn('hr-employee-cell', className)}>
      <span className={cn('hr-employee-cell__avatar', size === 'sm' && 'hr-employee-cell__avatar--sm')} aria-hidden>
        {initialsFor(name)}
      </span>
      <span className="hr-employee-cell__meta">
        <span className="hr-employee-cell__name">{name}</span>
        {code ? <span className="hr-employee-cell__code">{code}</span> : null}
      </span>
    </div>
  )
}
