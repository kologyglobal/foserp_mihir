/**
 * Fixed Assets Management fine-grained frontend permissions.
 *
 * SECURITY: All permissions must also be enforced by the future backend
 * (tenant isolation + RBAC on every fixed assets read / write / post / export).
 * UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const FIXED_ASSETS_PERMISSIONS = [
  'accounting.fixed_assets.view',
  'accounting.fixed_assets.view_register',
  'accounting.fixed_assets.manage_assets',
  'accounting.fixed_assets.view_categories',
  'accounting.fixed_assets.manage_categories',
  'accounting.fixed_assets.acquire',
  'accounting.fixed_assets.capitalize',
  'accounting.fixed_assets.run_depreciation',
  'accounting.fixed_assets.approve_depreciation',
  'accounting.fixed_assets.transfer',
  'accounting.fixed_assets.maintain',
  'accounting.fixed_assets.revalue',
  'accounting.fixed_assets.impair',
  'accounting.fixed_assets.dispose',
  'accounting.fixed_assets.approve_disposal',
  'accounting.fixed_assets.verify',
  'accounting.fixed_assets.view_ledger',
  'accounting.fixed_assets.view_reports',
  'accounting.fixed_assets.manage_setup',
  'accounting.fixed_assets.export',
  'accounting.fixed_assets.print',
  'accounting.fixed_assets.view_audit',
] as const

export type FixedAssetsPermission = (typeof FIXED_ASSETS_PERMISSIONS)[number]

const ALL = [...FIXED_ASSETS_PERMISSIONS]

/** Plant FA custodian — view register and maintenance at plant level */
const PLANT_FA_VIEW: FixedAssetsPermission[] = [
  'accounting.fixed_assets.view',
  'accounting.fixed_assets.view_register',
  'accounting.fixed_assets.maintain',
  'accounting.fixed_assets.verify',
  'accounting.fixed_assets.print',
]

/** Accounts executive — day-to-day FA ops; no setup or depreciation approval */
const ACCOUNTS_USER: FixedAssetsPermission[] = [
  'accounting.fixed_assets.view',
  'accounting.fixed_assets.view_register',
  'accounting.fixed_assets.manage_assets',
  'accounting.fixed_assets.view_categories',
  'accounting.fixed_assets.acquire',
  'accounting.fixed_assets.capitalize',
  'accounting.fixed_assets.run_depreciation',
  'accounting.fixed_assets.transfer',
  'accounting.fixed_assets.maintain',
  'accounting.fixed_assets.dispose',
  'accounting.fixed_assets.verify',
  'accounting.fixed_assets.view_ledger',
  'accounting.fixed_assets.view_reports',
  'accounting.fixed_assets.export',
  'accounting.fixed_assets.print',
  'accounting.fixed_assets.view_audit',
]

/** Senior accountant — approvals, revaluation, impairment */
const ACCOUNTANT: FixedAssetsPermission[] = [
  ...ACCOUNTS_USER,
  'accounting.fixed_assets.approve_depreciation',
  'accounting.fixed_assets.revalue',
  'accounting.fixed_assets.impair',
  'accounting.fixed_assets.approve_disposal',
]

const ACCOUNTS_HEAD: FixedAssetsPermission[] = [...ALL]

const AUDITOR: FixedAssetsPermission[] = [
  'accounting.fixed_assets.view',
  'accounting.fixed_assets.view_register',
  'accounting.fixed_assets.view_categories',
  'accounting.fixed_assets.view_ledger',
  'accounting.fixed_assets.view_reports',
  'accounting.fixed_assets.export',
  'accounting.fixed_assets.print',
  'accounting.fixed_assets.view_audit',
]

const ROLE_PACKS: Partial<Record<ErpRole, FixedAssetsPermission[]>> = {
  admin: ALL,
  ceo: ALL,
  director: ALL,
  accounts_head: ACCOUNTS_HEAD,
  accounts_user: ACCOUNTANT,
  accounts: ACCOUNTANT,
  management: ALL,
  production_head: PLANT_FA_VIEW,
  production_supervisor: PLANT_FA_VIEW,
  production: PLANT_FA_VIEW,
  shop_floor: ['accounting.fixed_assets.view', 'accounting.fixed_assets.view_register'],
  store_manager: PLANT_FA_VIEW,
  store_user: PLANT_FA_VIEW,
  stores: PLANT_FA_VIEW,
  engineering_head: AUDITOR,
  quality_head: AUDITOR,
  purchase_head: AUDITOR,
  purchase_user: AUDITOR,
  purchase: AUDITOR,
  planning_manager: AUDITOR,
  dispatch_manager: AUDITOR,
  dispatch_user: AUDITOR,
  dispatch: AUDITOR,
}

function resolve(role: ErpRole): Set<FixedAssetsPermission> {
  return new Set(ROLE_PACKS[role] ?? ACCOUNTANT)
}

export function hasFixedAssetsPermission(permission: FixedAssetsPermission, role?: ErpRole): boolean {
  return resolve(role ?? getSessionUser().role).has(permission)
}

export function useFixedAssetsPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolve(user.role)
    const can = (p: FixedAssetsPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('accounting.fixed_assets.view'),
      canViewRegister: can('accounting.fixed_assets.view_register'),
      canManageAssets: can('accounting.fixed_assets.manage_assets'),
      canViewCategories: can('accounting.fixed_assets.view_categories'),
      canManageCategories: can('accounting.fixed_assets.manage_categories'),
      canAcquire: can('accounting.fixed_assets.acquire'),
      canCapitalize: can('accounting.fixed_assets.capitalize'),
      canRunDepreciation: can('accounting.fixed_assets.run_depreciation'),
      canApproveDepreciation: can('accounting.fixed_assets.approve_depreciation'),
      canTransfer: can('accounting.fixed_assets.transfer'),
      canMaintain: can('accounting.fixed_assets.maintain'),
      canRevalue: can('accounting.fixed_assets.revalue'),
      canImpair: can('accounting.fixed_assets.impair'),
      canDispose: can('accounting.fixed_assets.dispose'),
      canApproveDisposal: can('accounting.fixed_assets.approve_disposal'),
      canVerify: can('accounting.fixed_assets.verify'),
      canViewLedger: can('accounting.fixed_assets.view_ledger'),
      canViewReports: can('accounting.fixed_assets.view_reports'),
      canManageSetup: can('accounting.fixed_assets.manage_setup'),
      canExport: can('accounting.fixed_assets.export'),
      canPrint: can('accounting.fixed_assets.print'),
      canViewAudit: can('accounting.fixed_assets.view_audit'),
      can,
    }
  }, [user.role])
}
