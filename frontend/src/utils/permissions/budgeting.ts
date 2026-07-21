/**
 * Budgeting fine-grained frontend permissions (demo packs + API session keys).
 * Backend keys: finance.budget.*.
 */

import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const BUDGETING_PERMISSIONS = [
  'finance.budget.view',
  'finance.budget.create',
  'finance.budget.edit',
  'finance.budget.approve',
] as const

export type BudgetingPermission = (typeof BUDGETING_PERMISSIONS)[number]

const ALL: BudgetingPermission[] = [...BUDGETING_PERMISSIONS]

const VIEWER: BudgetingPermission[] = ['finance.budget.view']

const MANAGER: BudgetingPermission[] = [...ALL]

const ROLE_PACKS: Partial<Record<ErpRole, BudgetingPermission[]>> = {
  admin: ALL,
  ceo: MANAGER,
  director: MANAGER,
  accounts_head: MANAGER,
  accounts_user: VIEWER,
  accounts: VIEWER,
  management: VIEWER,
}

function resolveDemoPermissions(role: ErpRole): Set<BudgetingPermission> {
  return new Set(ROLE_PACKS[role] ?? VIEWER)
}

function resolveApiPermissions(): Set<BudgetingPermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(perms.filter((p): p is BudgetingPermission => (BUDGETING_PERMISSIONS as readonly string[]).includes(p)))
}

export function hasBudgetingPermission(permission: BudgetingPermission, role?: ErpRole): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) return resolveApiPermissions().has(permission)
  const effective = role ?? getSessionUser().role
  return resolveDemoPermissions(effective).has(permission)
}

export function useBudgetingPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set =
      isApiMode() && hasWorkspaceAdminRole()
        ? new Set<BudgetingPermission>(BUDGETING_PERMISSIONS)
        : isApiMode()
          ? resolveApiPermissions()
          : resolveDemoPermissions(user.role)
    const can = (p: BudgetingPermission) => set.has(p)
    return {
      canView: can('finance.budget.view'),
      canCreate: can('finance.budget.create'),
      canEdit: can('finance.budget.edit'),
      canApprove: can('finance.budget.approve'),
      /** Demo UI aliases — no separate backend keys yet */
      canExport: can('finance.budget.view'),
      canSetup: can('finance.budget.edit') || can('finance.budget.approve'),
    }
  }, [user.role])
}
