/**
 * Chart of Accounts fine-grained frontend permissions.
 *
 * SECURITY: All permissions must also be enforced by the future backend
 * (tenant isolation + RBAC on every CoA mutation / sensitive read).
 * UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const COA_PERMISSIONS = [
  'accounting.coa.view',
  'accounting.coa.create',
  'accounting.coa.edit',
  'accounting.coa.activate',
  'accounting.coa.deactivate',
  'accounting.coa.delete',
  'accounting.coa.import',
  'accounting.coa.export',
  'accounting.coa.view_balance',
  'accounting.coa.view_audit',
  'accounting.coa.manage_system_accounts',
] as const

export type CoaPermission = (typeof COA_PERMISSIONS)[number]

const ALL = [...COA_PERMISSIONS]

const VIEW_ONLY: CoaPermission[] = [
  'accounting.coa.view',
  'accounting.coa.view_balance',
  'accounting.coa.view_audit',
  'accounting.coa.export',
]

const ACCOUNTANT: CoaPermission[] = [
  ...VIEW_ONLY,
  'accounting.coa.create',
  'accounting.coa.edit',
  'accounting.coa.activate',
  'accounting.coa.deactivate',
  'accounting.coa.import',
]

const SENIOR_ACCOUNTANT: CoaPermission[] = [
  ...ACCOUNTANT,
  'accounting.coa.delete',
]

const FINANCE_MANAGER: CoaPermission[] = [...ALL]

const COST_ACCOUNTANT: CoaPermission[] = [
  'accounting.coa.view',
  'accounting.coa.create',
  'accounting.coa.edit',
  'accounting.coa.view_balance',
  'accounting.coa.view_audit',
  'accounting.coa.export',
]

const AP_AR_EXEC: CoaPermission[] = [
  'accounting.coa.view',
  'accounting.coa.view_balance',
  'accounting.coa.export',
]

const AUDITOR: CoaPermission[] = VIEW_ONLY

const CFO: CoaPermission[] = [...ALL]

const ADMIN: CoaPermission[] = [...ALL]

/**
 * Map ERP session roles → CoA packs.
 * Suggested personas: Accountant, Senior Accountant, Finance Manager,
 * Cost Accountant, AP/AR Executive, Auditor, CFO, Administrator.
 */
const ROLE_PACKS: Partial<Record<ErpRole, CoaPermission[]>> = {
  admin: ADMIN,
  ceo: CFO,
  director: CFO,
  accounts_head: FINANCE_MANAGER,
  accounts_user: ACCOUNTANT,
  accounts: ACCOUNTANT,
  management: CFO,
  purchase_head: AP_AR_EXEC,
  purchase_user: AP_AR_EXEC,
  purchase: AP_AR_EXEC,
  sales_manager: AP_AR_EXEC,
  sales: AP_AR_EXEC,
  planning_manager: COST_ACCOUNTANT,
  planning: COST_ACCOUNTANT,
  production_head: COST_ACCOUNTANT,
  engineering_head: AUDITOR,
  store_manager: AUDITOR,
  quality_head: AUDITOR,
  dispatch_manager: AUDITOR,
}

function resolveCoaPermissions(role: ErpRole): Set<CoaPermission> {
  const pack = ROLE_PACKS[role] ?? SENIOR_ACCOUNTANT
  return new Set(pack)
}

export function hasCoaPermission(permission: CoaPermission, role?: ErpRole): boolean {
  const effective = role ?? getSessionUser().role
  return resolveCoaPermissions(effective).has(permission)
}

export function useCoaPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolveCoaPermissions(user.role)
    const can = (p: CoaPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('accounting.coa.view'),
      canCreate: can('accounting.coa.create'),
      canEdit: can('accounting.coa.edit'),
      canActivate: can('accounting.coa.activate'),
      canDeactivate: can('accounting.coa.deactivate'),
      canDelete: can('accounting.coa.delete'),
      canImport: can('accounting.coa.import'),
      canExport: can('accounting.coa.export'),
      canViewBalance: can('accounting.coa.view_balance'),
      canViewAudit: can('accounting.coa.view_audit'),
      canManageSystem: can('accounting.coa.manage_system_accounts'),
      can,
    }
  }, [user.role])
}
