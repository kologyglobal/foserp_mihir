/**
 * Period Close fine-grained frontend permissions.
 *
 * API mode: maps to existing `finance.period.view|manage|close|reopen` (no parallel
 * `accounting.period_close.*` backend permissions in Phase 1).
 * Demo mode: role packs for the mock workspace.
 *
 * SECURITY: Backend enforces tenant isolation + RBAC on period close/reopen.
 */

import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { hasFinancePermission } from './finance'
import { getSessionUser, type ErpRole } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

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
  if (isApiMode()) {
    if (hasWorkspaceAdminRole()) return true
    // Map legacy FE keys onto finance.period.*
    if (permission === 'accounting.period_close.view') return hasFinancePermission('finance.period.view')
    if (permission === 'accounting.period_close.lock' || permission === 'accounting.period_close.manage_checklist') {
      return (
        hasFinancePermission('finance.period.manage') ||
        hasFinancePermission('finance.period.close') ||
        hasFinancePermission('finance.period.reopen')
      )
    }
    if (permission === 'accounting.period_close.reopen_request' || permission === 'accounting.period_close.approve_reopen') {
      return hasFinancePermission('finance.period.reopen')
    }
    return hasFinancePermission('finance.period.view')
  }
  const effective = role ?? getSessionUser().role
  return resolvePeriodClosePermissions(effective).has(permission)
}

export function usePeriodClosePermissions() {
  const role = getSessionUser().role
  const apiPermKey = isApiMode() ? (getStoredSession()?.user.permissions?.join(',') ?? '') : ''

  return useMemo(() => {
    if (isApiMode()) {
      const canView = hasFinancePermission('finance.period.view') || hasWorkspaceAdminRole()
      const canManage = hasFinancePermission('finance.period.manage') || hasWorkspaceAdminRole()
      const canClose = hasFinancePermission('finance.period.close') || hasWorkspaceAdminRole()
      const canReopen = hasFinancePermission('finance.period.reopen') || hasWorkspaceAdminRole()
      return {
        role,
        can: (p: PeriodClosePermission) => hasPeriodClosePermission(p, role),
        canView,
        canManageChecklist: canManage || canClose,
        canReconcile: canView,
        canManageAccruals: false,
        canManagePrepaid: false,
        canFxPreview: false,
        canLock: canManage || canClose,
        canClosePeriod: canClose,
        canReopenPeriod: canReopen,
        canMarkUnderReview: canManage,
        canReopenRequest: canReopen,
        canApproveReopen: canReopen,
        canYearEndPreview: canView,
        canApproveYearEnd: false,
        canExport: canView,
        canManageSetup: canManage,
        canViewAudit: canView,
        isApiMode: true as const,
      }
    }

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
      canClosePeriod: can('accounting.period_close.lock'),
      canReopenPeriod: can('accounting.period_close.approve_reopen'),
      canMarkUnderReview: can('accounting.period_close.lock'),
      canReopenRequest: can('accounting.period_close.reopen_request'),
      canApproveReopen: can('accounting.period_close.approve_reopen'),
      canYearEndPreview: can('accounting.period_close.year_end_preview'),
      canApproveYearEnd: can('accounting.period_close.approve_year_end'),
      canExport: can('accounting.period_close.export'),
      canManageSetup: can('accounting.period_close.manage_setup'),
      canViewAudit: can('accounting.period_close.view_audit'),
      isApiMode: false as const,
    }
  }, [role, apiPermKey])
}
