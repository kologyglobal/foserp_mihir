import { NavLink, useLocation } from 'react-router-dom'
import {
  BUDGETING_NAV,
  BUDGETING_WORKSPACE_TABS,
  budgetingNavIsActive,
} from '@/config/budgetingNav'
import { cn } from '@/utils/cn'

const GROUP_LABEL: Record<string, string> = {
  overview: '',
  prepare: 'Prepare',
  dimensions: 'Budgets',
  analyse: 'Analyse',
  ops: 'Governance',
}

/** Exact Budgeting & Forecasting submenu tree */
export function BudgetingSideNav() {
  const { pathname } = useLocation()
  let lastGroup = ''
  return (
    <nav
      className="flex max-h-[calc(100vh-12rem)] w-full shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-erp-border bg-white p-2 md:w-52 lg:w-56"
      aria-label="Budgeting and forecasting navigation"
    >
      {BUDGETING_NAV.map((item) => {
        const showGroup = item.group !== lastGroup && item.group !== 'overview'
        lastGroup = item.group
        const active = budgetingNavIsActive(pathname, item)
        return (
          <div key={item.id}>
            {showGroup ? (
              <div className="mb-1 mt-2 px-2 text-[10px] font-bold uppercase tracking-wide text-erp-muted">
                {GROUP_LABEL[item.group]}
              </div>
            ) : null}
            <NavLink
              to={item.path}
              end={Boolean(item.end)}
              className={cn(
                'block rounded px-2 py-1.5 text-[12px] font-medium transition-colors',
                active ? 'bg-erp-primary/10 text-erp-primary' : 'text-erp-text hover:bg-erp-surface',
              )}
            >
              {item.label}
            </NavLink>
          </div>
        )
      })}
    </nav>
  )
}

/** Secondary condensed chips — does not replace the side tree */
export function BudgetingWorkspaceTabs() {
  const { pathname } = useLocation()

  return (
    <nav
      className="flex gap-0.5 overflow-x-auto border-b border-erp-border bg-white px-1"
      aria-label="Budgeting workspace shortcuts"
    >
      {BUDGETING_WORKSPACE_TABS.map((tab) => {
        const active = tab.end
          ? pathname === tab.path
          : pathname === tab.path || pathname.startsWith(`${tab.path}/`)
        return (
          <NavLink
            key={tab.id}
            to={tab.path}
            end={tab.end}
            className={cn(
              'shrink-0 border-b-2 px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
              active ? 'border-erp-primary text-erp-primary' : 'border-transparent text-erp-muted hover:text-erp-text',
            )}
          >
            {tab.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
