/**
 * Financial Reports fine-grained frontend permissions.
 *
 * SECURITY: All permissions must also be enforced by the future backend
 * (tenant isolation + RBAC on every reports read / export / setup change).
 * UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const FINANCIAL_REPORTS_PERMISSIONS = [
  'accounting.reports.view',
  'accounting.reports.view_trial_balance',
  'accounting.reports.view_profit_loss',
  'accounting.reports.view_balance_sheet',
  'accounting.reports.view_cash_flow',
  'accounting.reports.view_schedules',
  'accounting.reports.manage_schedules',
  'accounting.reports.view_mis',
  'accounting.reports.view_manufacturing',
  'accounting.reports.view_budget',
  'accounting.reports.export',
  'accounting.reports.print',
  'accounting.reports.manage_setup',
  'accounting.reports.view_sensitive',
] as const

export type FinancialReportsPermission = (typeof FINANCIAL_REPORTS_PERMISSIONS)[number]

const ALL = [...FINANCIAL_REPORTS_PERMISSIONS]

/** AP clerk — standard reports; no setup or schedule management */
const ACCOUNTS_USER: FinancialReportsPermission[] = [
  'accounting.reports.view',
  'accounting.reports.view_trial_balance',
  'accounting.reports.view_profit_loss',
  'accounting.reports.view_balance_sheet',
  'accounting.reports.view_cash_flow',
  'accounting.reports.view_schedules',
  'accounting.reports.view_budget',
  'accounting.reports.export',
  'accounting.reports.print',
]

const ACCOUNTS_HEAD: FinancialReportsPermission[] = [
  ...ALL.filter((p) => p !== 'accounting.reports.view_sensitive'),
  'accounting.reports.view_sensitive',
]

const AUDITOR: FinancialReportsPermission[] = [
  'accounting.reports.view',
  'accounting.reports.view_trial_balance',
  'accounting.reports.view_profit_loss',
  'accounting.reports.view_balance_sheet',
  'accounting.reports.view_cash_flow',
  'accounting.reports.view_schedules',
  'accounting.reports.view_mis',
  'accounting.reports.view_manufacturing',
  'accounting.reports.view_budget',
  'accounting.reports.export',
  'accounting.reports.print',
  'accounting.reports.view_sensitive',
]

const CFO_CEO: FinancialReportsPermission[] = [...ALL]

const PRODUCTION_MFG: FinancialReportsPermission[] = [
  'accounting.reports.view',
  'accounting.reports.view_manufacturing',
  'accounting.reports.view_mis',
  'accounting.reports.print',
]

const ROLE_PACKS: Partial<Record<ErpRole, FinancialReportsPermission[]>> = {
  admin: ACCOUNTS_HEAD,
  ceo: CFO_CEO,
  director: CFO_CEO,
  accounts_head: ACCOUNTS_HEAD,
  accounts_user: ACCOUNTS_USER,
  accounts: ACCOUNTS_USER,
  management: CFO_CEO,
  production_head: PRODUCTION_MFG,
  production_supervisor: PRODUCTION_MFG,
  production: PRODUCTION_MFG,
  planning_manager: [...ACCOUNTS_USER, 'accounting.reports.view_manufacturing', 'accounting.reports.view_mis'],
  planning: [...ACCOUNTS_USER, 'accounting.reports.view_manufacturing', 'accounting.reports.view_mis'],
  purchase_head: AUDITOR,
  purchase_user: ['accounting.reports.view', 'accounting.reports.view_budget', 'accounting.reports.print'],
  purchase: ['accounting.reports.view', 'accounting.reports.view_budget', 'accounting.reports.print'],
  engineering_head: AUDITOR,
  quality_head: PRODUCTION_MFG,
  dispatch_manager: ['accounting.reports.view', 'accounting.reports.view_mis', 'accounting.reports.print'],
  sales_manager: ['accounting.reports.view', 'accounting.reports.view_mis', 'accounting.reports.print'],
  sales: ['accounting.reports.view', 'accounting.reports.view_mis', 'accounting.reports.print'],
}

function resolve(role: ErpRole): Set<FinancialReportsPermission> {
  return new Set(ROLE_PACKS[role] ?? ACCOUNTS_USER)
}

export function hasFinancialReportsPermission(
  permission: FinancialReportsPermission,
  role?: ErpRole,
): boolean {
  return resolve(role ?? getSessionUser().role).has(permission)
}

export function useFinancialReportsPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolve(user.role)
    const can = (p: FinancialReportsPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('accounting.reports.view'),
      canViewTrialBalance: can('accounting.reports.view_trial_balance'),
      canViewProfitLoss: can('accounting.reports.view_profit_loss'),
      canViewBalanceSheet: can('accounting.reports.view_balance_sheet'),
      canViewCashFlow: can('accounting.reports.view_cash_flow'),
      canViewSchedules: can('accounting.reports.view_schedules'),
      canManageSchedules: can('accounting.reports.manage_schedules'),
      canViewMis: can('accounting.reports.view_mis'),
      canViewManufacturing: can('accounting.reports.view_manufacturing'),
      canViewBudget: can('accounting.reports.view_budget'),
      canExport: can('accounting.reports.export'),
      canPrint: can('accounting.reports.print'),
      canManageSetup: can('accounting.reports.manage_setup'),
      canViewSensitive: can('accounting.reports.view_sensitive'),
      can,
    }
  }, [user.role])
}
