/**
 * Budgeting & Forecasting fine-grained frontend permissions.
 *
 * SECURITY: Backend must enforce tenant isolation + RBAC on every budgeting
 * read/write when APIs exist. UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const BUDGETING_PERMISSIONS = [
  'accounting.budgeting.view',
  'accounting.budgeting.create',
  'accounting.budgeting.edit',
  'accounting.budgeting.approve',
  'accounting.budgeting.export',
  'accounting.budgeting.setup',
] as const

export type BudgetingPermission = (typeof BUDGETING_PERMISSIONS)[number]

const ALL = [...BUDGETING_PERMISSIONS]

const VIEWER: BudgetingPermission[] = ['accounting.budgeting.view', 'accounting.budgeting.export']

const PREPARER: BudgetingPermission[] = [
  ...VIEWER,
  'accounting.budgeting.create',
  'accounting.budgeting.edit',
]

const APPROVER: BudgetingPermission[] = [...PREPARER, 'accounting.budgeting.approve']

const ADMIN: BudgetingPermission[] = [...ALL]

const ROLE_PACKS: Partial<Record<ErpRole, BudgetingPermission[]>> = {
  admin: ADMIN,
  ceo: ADMIN,
  director: ADMIN,
  accounts_head: ADMIN,
  accounts_user: PREPARER,
  accounts: PREPARER,
  management: APPROVER,
  purchase_head: VIEWER,
  purchase_user: ['accounting.budgeting.view'],
  sales_manager: VIEWER,
  sales: ['accounting.budgeting.view'],
}

function resolveBudgetingPermissions(role: ErpRole): Set<BudgetingPermission> {
  return new Set(ROLE_PACKS[role] ?? PREPARER)
}

export function hasBudgetingPermission(permission: BudgetingPermission, role?: ErpRole): boolean {
  const effective = role ?? getSessionUser().role
  return resolveBudgetingPermissions(effective).has(permission)
}

export function useBudgetingPermissions() {
  const role = getSessionUser().role
  return useMemo(() => {
    const set = resolveBudgetingPermissions(role)
    const can = (p: BudgetingPermission) => set.has(p)
    return {
      role,
      can,
      canView: can('accounting.budgeting.view'),
      canCreate: can('accounting.budgeting.create'),
      canEdit: can('accounting.budgeting.edit'),
      canApprove: can('accounting.budgeting.approve'),
      canExport: can('accounting.budgeting.export'),
      canSetup: can('accounting.budgeting.setup'),
    }
  }, [role])
}
