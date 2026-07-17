import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

/**
 * Standard panel wrapper for CRM/ERP register tables.
 * Pairs with embedded `registerFilter` on the table grid (search, chips, sort, saved views).
 */
export function EnterpriseRegisterTableShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('erp-page-panel erp-register-table-shell overflow-visible p-0', className)}>
      {children}
    </div>
  )
}
