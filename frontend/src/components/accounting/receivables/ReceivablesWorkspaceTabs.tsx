import { NavLink } from 'react-router-dom'
import { RECEIVABLE_WORKSPACE_TABS, type ReceivableWorkspaceTab } from '@/types/receivables'
import { cn } from '@/utils/cn'

export function ReceivablesWorkspaceTabs({
  active,
  preserveQuery,
}: {
  active: ReceivableWorkspaceTab
  /** Optional query string (without ?) preserved across tab navigation */
  preserveQuery?: string
}) {
  const suffix = preserveQuery ? `?${preserveQuery}` : ''
  return (
    <nav
      className="flex gap-0.5 overflow-x-auto border-b border-erp-border bg-white px-1"
      aria-label="Receivables workspace"
    >
      {RECEIVABLE_WORKSPACE_TABS.map((tab) => (
        <NavLink
          key={tab.id}
          to={`${tab.path}${suffix}`}
          end={tab.id === 'overview'}
          className={cn(
            'shrink-0 border-b-2 px-3 py-2 text-[12px] font-semibold transition-colors',
            active === tab.id
              ? 'border-erp-primary text-erp-primary'
              : 'border-transparent text-erp-muted hover:text-erp-text',
          )}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
