/**
 * Finance setup fine-grained frontend permissions (backend keys: finance.*).
 */

import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const FINANCE_PERMISSIONS = [
  'finance.view',
  'finance.settings.view',
  'finance.settings.manage',
  'finance.legal_entity.view',
  'finance.legal_entity.manage',
  'finance.branch.view',
  'finance.branch.manage',
  'finance.financial_year.view',
  'finance.financial_year.manage',
  'finance.period.view',
  'finance.period.manage',
  'finance.period.close',
  'finance.period.reopen',
  'finance.coa.view',
  'finance.coa.manage',
  'finance.default_mapping.view',
  'finance.default_mapping.manage',
  'finance.number_series.view',
  'finance.number_series.manage',
  'finance.cost_centre.view',
  'finance.cost_centre.manage',
  'finance.approval_rule.view',
  'finance.approval_rule.manage',
  'finance.activate',
  'finance.audit.view',
  'finance.voucher.view',
  'finance.voucher.create',
  'finance.voucher.edit',
  'finance.voucher.submit',
  'finance.voucher.cancel',
  'finance.voucher.approve',
  'finance.voucher.post',
  'finance.voucher.reverse',
  'finance.gl.view',
  'finance.tax.view',
  'finance.tax.extract',
  'finance.tax.einvoice.manage',
  'finance.tax.eway.manage',
] as const

export type FinancePermission = (typeof FINANCE_PERMISSIONS)[number]

const ALL: FinancePermission[] = [...FINANCE_PERMISSIONS]

const VIEWER: FinancePermission[] = [
  'finance.view',
  'finance.settings.view',
  'finance.legal_entity.view',
  'finance.branch.view',
  'finance.financial_year.view',
  'finance.period.view',
  'finance.coa.view',
  'finance.default_mapping.view',
  'finance.number_series.view',
  'finance.cost_centre.view',
  'finance.approval_rule.view',
  'finance.audit.view',
  'finance.voucher.view',
  'finance.tax.view',
]

const MANAGER: FinancePermission[] = [
  ...VIEWER,
  'finance.settings.manage',
  'finance.legal_entity.manage',
  'finance.branch.manage',
  'finance.financial_year.manage',
  'finance.period.manage',
  'finance.period.close',
  'finance.period.reopen',
  'finance.coa.manage',
  'finance.default_mapping.manage',
  'finance.number_series.manage',
  'finance.cost_centre.manage',
  'finance.approval_rule.manage',
  'finance.activate',
  'finance.voucher.create',
  'finance.voucher.edit',
  'finance.voucher.submit',
  'finance.voucher.cancel',
  'finance.voucher.approve',
  'finance.voucher.post',
  'finance.voucher.reverse',
  'finance.gl.view',
  'finance.tax.extract',
  'finance.tax.einvoice.manage',
  'finance.tax.eway.manage',
]

const ROLE_PACKS: Partial<Record<ErpRole, FinancePermission[]>> = {
  admin: ALL,
  ceo: MANAGER,
  director: MANAGER,
  accounts_head: MANAGER,
  accounts_user: VIEWER,
  accounts: VIEWER,
  management: VIEWER,
}

function resolveDemoPermissions(role: ErpRole): Set<FinancePermission> {
  return new Set(ROLE_PACKS[role] ?? VIEWER)
}

function resolveApiPermissions(): Set<FinancePermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(perms.filter((p): p is FinancePermission => (FINANCE_PERMISSIONS as readonly string[]).includes(p)))
}

export function hasFinancePermission(permission: FinancePermission, role?: ErpRole): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) return resolveApiPermissions().has(permission)
  const effective = role ?? getSessionUser().role
  return resolveDemoPermissions(effective).has(permission)
}

export function useFinancePermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set =
      isApiMode() && hasWorkspaceAdminRole()
        ? new Set<FinancePermission>(FINANCE_PERMISSIONS)
        : isApiMode()
          ? resolveApiPermissions()
          : resolveDemoPermissions(user.role)
    const can = (p: FinancePermission) => set.has(p)
    return {
      role: user.role,
      canView: can('finance.settings.view') || can('finance.view'),
      canManage: can('finance.settings.manage'),
      canManageLegalEntity: can('finance.legal_entity.manage'),
      canManageBranch: can('finance.branch.manage'),
      canManageFinancialYear: can('finance.financial_year.manage'),
      canManagePeriod: can('finance.period.manage'),
      canClosePeriod: can('finance.period.close'),
      canReopenPeriod: can('finance.period.reopen'),
      canManageCoa: can('finance.coa.manage'),
      canViewCoa: can('finance.coa.view'),
      canManageMappings: can('finance.default_mapping.manage'),
      canManageNumberSeries: can('finance.number_series.manage'),
      canManageCostCentres: can('finance.cost_centre.manage'),
      canManageApprovalRules: can('finance.approval_rule.manage'),
      canActivate: can('finance.activate'),
      canViewVouchers: can('finance.voucher.view'),
      canCreateVoucher: can('finance.voucher.create'),
      canEditVoucher: can('finance.voucher.edit'),
      canSubmitVoucher: can('finance.voucher.submit'),
      canCancelVoucher: can('finance.voucher.cancel'),
      canApproveVoucher: can('finance.voucher.approve'),
      canPostVoucher: can('finance.voucher.post'),
      canReverseVoucher: can('finance.voucher.reverse'),
      canViewGl: can('finance.gl.view'),
      can,
    }
  }, [user.role])
}
