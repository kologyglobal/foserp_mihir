/**
 * Ledger Entries fine-grained frontend permissions.
 *
 * SECURITY: All permissions must also be enforced by the future backend
 * (tenant isolation + RBAC on every ledger read / export). UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const LEDGER_PERMISSIONS = [
  'accounting.ledger.view',
  'accounting.ledger.view_account',
  'accounting.ledger.view_party',
  'accounting.ledger.view_voucher',
  'accounting.ledger.view_cost_centre',
  'accounting.ledger.view_project',
  'accounting.ledger.view_manufacturing',
  'accounting.ledger.view_audit',
  'accounting.ledger.export',
  'accounting.ledger.print',
  'accounting.ledger.save_view',
  'accounting.ledger.view_sensitive_balance',
] as const

export type LedgerPermission = (typeof LEDGER_PERMISSIONS)[number]

const ALL = [...LEDGER_PERMISSIONS]

const AUDITOR: LedgerPermission[] = [
  'accounting.ledger.view',
  'accounting.ledger.view_account',
  'accounting.ledger.view_party',
  'accounting.ledger.view_voucher',
  'accounting.ledger.view_cost_centre',
  'accounting.ledger.view_project',
  'accounting.ledger.view_manufacturing',
  'accounting.ledger.view_audit',
  'accounting.ledger.export',
  'accounting.ledger.print',
  'accounting.ledger.view_sensitive_balance',
]

const ACCOUNTS_EXEC: LedgerPermission[] = [
  'accounting.ledger.view',
  'accounting.ledger.view_account',
  'accounting.ledger.view_party',
  'accounting.ledger.view_voucher',
  'accounting.ledger.export',
  'accounting.ledger.print',
  'accounting.ledger.save_view',
  'accounting.ledger.view_sensitive_balance',
]

const ACCOUNTANT: LedgerPermission[] = [
  ...ACCOUNTS_EXEC,
  'accounting.ledger.view_cost_centre',
  'accounting.ledger.view_audit',
]

const SENIOR: LedgerPermission[] = [...ACCOUNTANT, 'accounting.ledger.view_project']

const COST_ACCOUNTANT: LedgerPermission[] = [
  'accounting.ledger.view',
  'accounting.ledger.view_account',
  'accounting.ledger.view_cost_centre',
  'accounting.ledger.view_project',
  'accounting.ledger.view_manufacturing',
  'accounting.ledger.view_audit',
  'accounting.ledger.export',
  'accounting.ledger.print',
  'accounting.ledger.save_view',
  'accounting.ledger.view_sensitive_balance',
]

const PLANT_ACCOUNTANT: LedgerPermission[] = [
  ...COST_ACCOUNTANT,
  'accounting.ledger.view_voucher',
]

const FINANCE_MANAGER: LedgerPermission[] = [...ALL]
const CFO: LedgerPermission[] = [...ALL]
const ADMIN: LedgerPermission[] = [...ALL]

const ROLE_PACKS: Partial<Record<ErpRole, LedgerPermission[]>> = {
  admin: ADMIN,
  ceo: CFO,
  director: CFO,
  accounts_head: FINANCE_MANAGER,
  accounts_user: ACCOUNTANT,
  accounts: ACCOUNTANT,
  management: CFO,
  planning_manager: COST_ACCOUNTANT,
  planning: COST_ACCOUNTANT,
  production_head: PLANT_ACCOUNTANT,
  production_supervisor: PLANT_ACCOUNTANT,
  production: PLANT_ACCOUNTANT,
  purchase_head: ACCOUNTS_EXEC,
  purchase_user: ACCOUNTS_EXEC,
  purchase: ACCOUNTS_EXEC,
  sales_manager: ACCOUNTS_EXEC,
  sales: ACCOUNTS_EXEC,
  engineering_head: AUDITOR,
  quality_head: AUDITOR,
  store_manager: COST_ACCOUNTANT,
  dispatch_manager: AUDITOR,
}

function resolve(role: ErpRole): Set<LedgerPermission> {
  return new Set(ROLE_PACKS[role] ?? SENIOR)
}

export function hasLedgerPermission(permission: LedgerPermission, role?: ErpRole): boolean {
  return resolve(role ?? getSessionUser().role).has(permission)
}

export function useLedgerPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolve(user.role)
    const can = (p: LedgerPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('accounting.ledger.view'),
      canViewAccount: can('accounting.ledger.view_account'),
      canViewParty: can('accounting.ledger.view_party'),
      canViewVoucher: can('accounting.ledger.view_voucher'),
      canViewCostCentre: can('accounting.ledger.view_cost_centre'),
      canViewProject: can('accounting.ledger.view_project'),
      canViewManufacturing: can('accounting.ledger.view_manufacturing'),
      canViewAudit: can('accounting.ledger.view_audit'),
      canExport: can('accounting.ledger.export'),
      canPrint: can('accounting.ledger.print'),
      canSaveView: can('accounting.ledger.save_view'),
      canViewBalance: can('accounting.ledger.view_sensitive_balance'),
      can,
    }
  }, [user.role])
}
