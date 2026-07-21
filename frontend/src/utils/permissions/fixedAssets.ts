/**
 * Fixed Assets Management fine-grained frontend permissions.
 *
 * API mode: maps to `finance.fa.view|create|edit|capitalize|depreciate|dispose`.
 * Demo mode: role packs for the mock workspace.
 *
 * SECURITY: Backend enforces tenant isolation + RBAC on every fixed assets read / write / post.
 */

import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

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

export const FIXED_ASSETS_API_PERMISSIONS = [
  'finance.fa.view',
  'finance.fa.create',
  'finance.fa.edit',
  'finance.fa.capitalize',
  'finance.fa.depreciate',
  'finance.fa.dispose',
  'finance.fa.transfer',
] as const

export type FixedAssetsApiPermission = (typeof FIXED_ASSETS_API_PERMISSIONS)[number]

const ALL = [...FIXED_ASSETS_PERMISSIONS]

const PLANT_FA_VIEW: FixedAssetsPermission[] = [
  'accounting.fixed_assets.view',
  'accounting.fixed_assets.view_register',
  'accounting.fixed_assets.maintain',
  'accounting.fixed_assets.verify',
  'accounting.fixed_assets.print',
]

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

function resolveApiPermissions(): Set<FixedAssetsApiPermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(
    perms.filter((p): p is FixedAssetsApiPermission =>
      (FIXED_ASSETS_API_PERMISSIONS as readonly string[]).includes(p),
    ),
  )
}

function hasApiFaPermission(permission: FixedAssetsApiPermission): boolean {
  return hasWorkspaceAdminRole() || resolveApiPermissions().has(permission)
}

export function hasFixedAssetsPermission(permission: FixedAssetsPermission, role?: ErpRole): boolean {
  if (isApiMode()) {
    if (hasWorkspaceAdminRole()) return true
    switch (permission) {
      case 'accounting.fixed_assets.view':
      case 'accounting.fixed_assets.view_register':
      case 'accounting.fixed_assets.view_categories':
      case 'accounting.fixed_assets.view_ledger':
      case 'accounting.fixed_assets.view_reports':
      case 'accounting.fixed_assets.view_audit':
      case 'accounting.fixed_assets.export':
      case 'accounting.fixed_assets.print':
        return hasApiFaPermission('finance.fa.view')
      case 'accounting.fixed_assets.manage_assets':
      case 'accounting.fixed_assets.manage_categories':
        return hasApiFaPermission('finance.fa.create') && hasApiFaPermission('finance.fa.edit')
      case 'accounting.fixed_assets.capitalize':
        return hasApiFaPermission('finance.fa.capitalize')
      case 'accounting.fixed_assets.run_depreciation':
      case 'accounting.fixed_assets.approve_depreciation':
        return hasApiFaPermission('finance.fa.depreciate')
      case 'accounting.fixed_assets.dispose':
      case 'accounting.fixed_assets.approve_disposal':
        return hasApiFaPermission('finance.fa.dispose')
      case 'accounting.fixed_assets.transfer':
        return hasApiFaPermission('finance.fa.transfer')
      default:
        return false
    }
  }
  return resolve(role ?? getSessionUser().role).has(permission)
}

export function useFixedAssetsPermissions() {
  const user = getSessionUser()
  const apiPermKey = isApiMode() ? (getStoredSession()?.user.permissions?.join(',') ?? '') : ''

  return useMemo(() => {
    if (isApiMode()) {
      const canView = hasApiFaPermission('finance.fa.view')
      const canManageAssets =
        hasApiFaPermission('finance.fa.create') && hasApiFaPermission('finance.fa.edit')
      return {
        role: user.role,
        can: (p: FixedAssetsPermission) => hasFixedAssetsPermission(p, user.role),
        canView,
        canViewRegister: canView,
        canManageAssets,
        canViewCategories: canView,
        canManageCategories: canManageAssets,
        canAcquire: false,
        canCapitalize: hasApiFaPermission('finance.fa.capitalize'),
        canRunDepreciation: hasApiFaPermission('finance.fa.depreciate'),
        canApproveDepreciation: hasApiFaPermission('finance.fa.depreciate'),
        canTransfer: hasApiFaPermission('finance.fa.transfer'),
        canMaintain: false,
        canRevalue: false,
        canImpair: false,
        canDispose: hasApiFaPermission('finance.fa.dispose'),
        canApproveDisposal: false,
        canVerify: false,
        canViewLedger: canView,
        canViewReports: canView,
        canManageSetup: false,
        canExport: canView,
        canPrint: canView,
        canViewAudit: canView,
        isApiMode: true as const,
      }
    }

    const set = resolve(user.role)
    const can = (p: FixedAssetsPermission) => set.has(p)
    return {
      role: user.role,
      can,
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
      isApiMode: false as const,
    }
  }, [user.role, apiPermKey])
}
