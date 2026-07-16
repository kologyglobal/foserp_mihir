import { NavLink } from 'react-router-dom'
import {
  FINANCIAL_REPORT_WORKSPACE_TABS,
  type FinancialReportWorkspaceTab,
} from '@/types/financialReports'
import { cn } from '@/utils/cn'

/** Fallback if types module lags — mirrors FINANCIAL_REPORT_WORKSPACE_TABS paths. */
const FALLBACK_TABS: { id: FinancialReportWorkspaceTab; label: string; path: string }[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/reports' },
  { id: 'trial_balance', label: 'Trial Balance', path: '/accounting/reports/trial-balance' },
  { id: 'profit_loss', label: 'Profit & Loss', path: '/accounting/reports/profit-loss' },
  { id: 'balance_sheet', label: 'Balance Sheet', path: '/accounting/reports/balance-sheet' },
  { id: 'cash_flow', label: 'Cash Flow Statement', path: '/accounting/reports/cash-flow' },
  { id: 'general_ledger', label: 'General Ledger Report', path: '/accounting/reports/general-ledger' },
  { id: 'account_schedules', label: 'Account Schedules', path: '/accounting/reports/account-schedules' },
  { id: 'cost_centre', label: 'Cost Centre Profitability', path: '/accounting/reports/cost-centre' },
  { id: 'department', label: 'Department Performance', path: '/accounting/reports/department' },
  { id: 'project', label: 'Project Profitability', path: '/accounting/reports/project' },
  { id: 'manufacturing', label: 'Manufacturing Cost Summary', path: '/accounting/reports/manufacturing' },
  { id: 'budget_vs_actual', label: 'Budget vs Actual', path: '/accounting/reports/budget-vs-actual' },
  { id: 'comparative', label: 'Comparative Statements', path: '/accounting/reports/comparative' },
  { id: 'ratios', label: 'Ratio Analysis', path: '/accounting/reports/ratios' },
  { id: 'financial_mis', label: 'Financial MIS', path: '/accounting/reports/mis' },
  { id: 'setup', label: 'Report Setup', path: '/accounting/reports/setup' },
]

const TABS = FINANCIAL_REPORT_WORKSPACE_TABS.length > 0 ? FINANCIAL_REPORT_WORKSPACE_TABS : FALLBACK_TABS

export function FinancialReportsWorkspaceTabs({
  active,
  preserveQuery,
}: {
  active: FinancialReportWorkspaceTab
  /** Optional query string (without ?) preserved across tab navigation */
  preserveQuery?: string
}) {
  const suffix = preserveQuery ? `?${preserveQuery}` : ''
  return (
    <nav
      className="flex gap-0.5 overflow-x-auto border-b border-erp-border bg-white px-1"
      aria-label="Financial reports workspace"
    >
      {TABS.map((tab) => (
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
