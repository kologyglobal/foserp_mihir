/**
 * Period Close fine-grained frontend permissions.
 *
 * SECURITY: Backend must enforce tenant isolation + RBAC on every period-close
 * read/write when APIs exist. UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const PERIOD_CLOSE_PERMISSIONS = [
  'accounting.period_close.view',
  'accounting.period_close.manage_checklist',
  'accounting.period_close.reconcile',
  'accounting.period_close.manage_accruals',
  'accounting.period_close.manage_prepaid',
  'accounting.period_close.fx_preview',
  'accounting.period_close.lock',
  'accounting.period_close.reopen_request',
  'accounting.period_close.approve_reopen',
  'accounting.period_close.year_end_preview',
  'accounting.period_close.approve_year_end',
  'accounting.period_close.export',
  'accounting.period_close.manage_setup',
  'accounting.period_close.view_audit',
] as const

export type PeriodClosePermission = (typeof PERIOD_CLOSE_PERMISSIONS)[number]

const ALL = [...PERIOD_CLOSE_PERMISSIONS]

const VIEWER: PeriodClosePermission[] = [
  'accounting.period_close.view',
  'accounting.period_close.export',
  'accounting.period_close.view_audit',
]

const ACCOUNTANT: PeriodClosePermission[] = [
  ...VIEWER,
  'accounting.period_close.manage_checklist',
  'accounting.period_close.reconcile',
  'accounting.period_close.manage_accruals',
  'accounting.period_close.manage_prepaid',
  'accounting.period_close.fx_preview',
  'accounting.period_close.reopen_request',
  'accounting.period_close.year_end_preview',
]

const FINANCE_MANAGER: PeriodClosePermission[] = [...ALL]
const ADMIN: PeriodClosePermission[] = [...ALL]

const ROLE_PACKS: Partial<Record<ErpRole, PeriodClosePermission[]>> = {
  admin: ADMIN,
  ceo: FINANCE_MANAGER,
  director: FINANCE_MANAGER,
  accounts_head: FINANCE_MANAGER,
  accounts_user: ACCOUNTANT,
  accounts: ACCOUNTANT,
  management: FINANCE_MANAGER,
  purchase_head: VIEWER,
  purchase_user: ['accounting.period_close.view'],
  sales_manager: VIEWER,
  sales: ['accounting.period_close.view'],
}

function resolvePeriodClosePermissions(role: ErpRole): Set<PeriodClosePermission> {
  return new Set(ROLE_PACKS[role] ?? ACCOUNTANT)
}

export function hasPeriodClosePermission(permission: PeriodClosePermission, role?: ErpRole): boolean {
  const effective = role ?? getSessionUser().role
  return resolvePeriodClosePermissions(effective).has(permission)
}

export function usePeriodClosePermissions() {
  const role = getSessionUser().role
  return useMemo(() => {
    const set = resolvePeriodClosePermissions(role)
    const can = (p: PeriodClosePermission) => set.has(p)
    return {
      role,
      can,
      canView: can('accounting.period_close.view'),
      canManageChecklist: can('accounting.period_close.manage_checklist'),
      canReconcile: can('accounting.period_close.reconcile'),
      canManageAccruals: can('accounting.period_close.manage_accruals'),
      canManagePrepaid: can('accounting.period_close.manage_prepaid'),
      canFxPreview: can('accounting.period_close.fx_preview'),
      canLock: can('accounting.period_close.lock'),
      canReopenRequest: can('accounting.period_close.reopen_request'),
      canApproveReopen: can('accounting.period_close.approve_reopen'),
      canYearEndPreview: can('accounting.period_close.year_end_preview'),
      canApproveYearEnd: can('accounting.period_close.approve_year_end'),
      canExport: can('accounting.period_close.export'),
      canManageSetup: can('accounting.period_close.manage_setup'),
      canViewAudit: can('accounting.period_close.view_audit'),
    }
  }, [role])
}
