/**
 * Manufacturing Accounting & Costing fine-grained frontend permissions.
 *
 * SECURITY: All permissions must also be enforced by the future backend
 * (tenant isolation + RBAC on every manufacturing costing read / write / export).
 * UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const MANUFACTURING_ACCOUNTING_PERMISSIONS = [
  'accounting.mfg_costing.view',
  'accounting.mfg_costing.view_dashboard',
  'accounting.mfg_costing.view_consumption',
  'accounting.mfg_costing.view_wip',
  'accounting.mfg_costing.view_fg',
  'accounting.mfg_costing.run_costing',
  'accounting.mfg_costing.view_variances',
  'accounting.mfg_costing.view_subcontract',
  'accounting.mfg_costing.view_scrap',
  'accounting.mfg_costing.allocate_overhead',
  'accounting.mfg_costing.view_cost_centres',
  'accounting.mfg_costing.view_cost_sheet',
  'accounting.mfg_costing.manage_cost_sheet',
  'accounting.mfg_costing.view_ledger',
  'accounting.mfg_costing.view_reports',
  'accounting.mfg_costing.manage_setup',
  'accounting.mfg_costing.export',
  'accounting.mfg_costing.print',
] as const

export type ManufacturingAccountingPermission = (typeof MANUFACTURING_ACCOUNTING_PERMISSIONS)[number]

const ALL = [...MANUFACTURING_ACCOUNTING_PERMISSIONS]

/** Production supervisor — view WIP, consumption, variances at plant level */
const PRODUCTION_VIEW: ManufacturingAccountingPermission[] = [
  'accounting.mfg_costing.view',
  'accounting.mfg_costing.view_dashboard',
  'accounting.mfg_costing.view_consumption',
  'accounting.mfg_costing.view_wip',
  'accounting.mfg_costing.view_fg',
  'accounting.mfg_costing.view_variances',
  'accounting.mfg_costing.view_scrap',
  'accounting.mfg_costing.view_cost_centres',
  'accounting.mfg_costing.view_cost_sheet',
  'accounting.mfg_costing.print',
]

/** Accounts executive — day-to-day costing ops; no setup or cost sheet management */
const ACCOUNTS_USER: ManufacturingAccountingPermission[] = [
  'accounting.mfg_costing.view',
  'accounting.mfg_costing.view_dashboard',
  'accounting.mfg_costing.view_consumption',
  'accounting.mfg_costing.view_wip',
  'accounting.mfg_costing.view_fg',
  'accounting.mfg_costing.run_costing',
  'accounting.mfg_costing.view_variances',
  'accounting.mfg_costing.view_subcontract',
  'accounting.mfg_costing.view_scrap',
  'accounting.mfg_costing.allocate_overhead',
  'accounting.mfg_costing.view_cost_centres',
  'accounting.mfg_costing.view_cost_sheet',
  'accounting.mfg_costing.view_ledger',
  'accounting.mfg_costing.view_reports',
  'accounting.mfg_costing.export',
  'accounting.mfg_costing.print',
]

/** Senior accountant — cost sheet management and full costing access */
const ACCOUNTANT: ManufacturingAccountingPermission[] = [
  ...ACCOUNTS_USER,
  'accounting.mfg_costing.manage_cost_sheet',
]

const ACCOUNTS_HEAD: ManufacturingAccountingPermission[] = [...ALL]

const AUDITOR: ManufacturingAccountingPermission[] = [
  'accounting.mfg_costing.view',
  'accounting.mfg_costing.view_dashboard',
  'accounting.mfg_costing.view_consumption',
  'accounting.mfg_costing.view_wip',
  'accounting.mfg_costing.view_fg',
  'accounting.mfg_costing.view_variances',
  'accounting.mfg_costing.view_subcontract',
  'accounting.mfg_costing.view_scrap',
  'accounting.mfg_costing.view_cost_centres',
  'accounting.mfg_costing.view_cost_sheet',
  'accounting.mfg_costing.view_ledger',
  'accounting.mfg_costing.view_reports',
  'accounting.mfg_costing.export',
  'accounting.mfg_costing.print',
]

const ROLE_PACKS: Partial<Record<ErpRole, ManufacturingAccountingPermission[]>> = {
  admin: ALL,
  ceo: ALL,
  director: ALL,
  accounts_head: ACCOUNTS_HEAD,
  accounts_user: ACCOUNTANT,
  accounts: ACCOUNTANT,
  management: ALL,
  production_head: [...PRODUCTION_VIEW, 'accounting.mfg_costing.view_subcontract', 'accounting.mfg_costing.view_reports'],
  production_supervisor: PRODUCTION_VIEW,
  production: PRODUCTION_VIEW,
  shop_floor: ['accounting.mfg_costing.view', 'accounting.mfg_costing.view_wip'],
  planning_manager: [...PRODUCTION_VIEW, 'accounting.mfg_costing.view_reports', 'accounting.mfg_costing.view_cost_sheet'],
  planning: [...PRODUCTION_VIEW, 'accounting.mfg_costing.view_reports'],
  store_manager: ['accounting.mfg_costing.view', 'accounting.mfg_costing.view_consumption', 'accounting.mfg_costing.view_fg'],
  store_user: ['accounting.mfg_costing.view', 'accounting.mfg_costing.view_consumption'],
  stores: ['accounting.mfg_costing.view', 'accounting.mfg_costing.view_consumption'],
  quality_head: AUDITOR,
  quality_inspector: ['accounting.mfg_costing.view', 'accounting.mfg_costing.view_scrap', 'accounting.mfg_costing.view_variances'],
  purchase_head: AUDITOR,
  purchase_user: ['accounting.mfg_costing.view', 'accounting.mfg_costing.view_subcontract'],
  purchase: ['accounting.mfg_costing.view', 'accounting.mfg_costing.view_subcontract'],
  engineering_head: [...PRODUCTION_VIEW, 'accounting.mfg_costing.manage_cost_sheet'],
}

function resolve(role: ErpRole): Set<ManufacturingAccountingPermission> {
  return new Set(ROLE_PACKS[role] ?? ACCOUNTANT)
}

export function hasManufacturingAccountingPermission(
  permission: ManufacturingAccountingPermission,
  role?: ErpRole,
): boolean {
  return resolve(role ?? getSessionUser().role).has(permission)
}

export function useManufacturingAccountingPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolve(user.role)
    const can = (p: ManufacturingAccountingPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('accounting.mfg_costing.view'),
      canViewDashboard: can('accounting.mfg_costing.view_dashboard'),
      canViewConsumption: can('accounting.mfg_costing.view_consumption'),
      canViewWip: can('accounting.mfg_costing.view_wip'),
      canViewFg: can('accounting.mfg_costing.view_fg'),
      canRunCosting: can('accounting.mfg_costing.run_costing'),
      canViewVariances: can('accounting.mfg_costing.view_variances'),
      canViewSubcontract: can('accounting.mfg_costing.view_subcontract'),
      canViewScrap: can('accounting.mfg_costing.view_scrap'),
      canAllocateOverhead: can('accounting.mfg_costing.allocate_overhead'),
      canViewCostCentres: can('accounting.mfg_costing.view_cost_centres'),
      canViewCostSheet: can('accounting.mfg_costing.view_cost_sheet'),
      canManageCostSheet: can('accounting.mfg_costing.manage_cost_sheet'),
      canViewLedger: can('accounting.mfg_costing.view_ledger'),
      canViewReports: can('accounting.mfg_costing.view_reports'),
      canManageSetup: can('accounting.mfg_costing.manage_setup'),
      canExport: can('accounting.mfg_costing.export'),
      canPrint: can('accounting.mfg_costing.print'),
      can,
    }
  }, [user.role])
}
