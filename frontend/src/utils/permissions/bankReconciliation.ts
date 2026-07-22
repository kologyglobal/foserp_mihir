/**
 * Phase 5A3 — Treasury bank reconciliation permissions (finance.bank.reconciliation.*)
 */
import { useMemo } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasBankCashPermission, type BankCashPermission } from './bankCash'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const BANK_RECONCILIATION_PERMISSIONS = [
  'finance.bank.reconciliation.view',
  'finance.bank.reconciliation.run_auto_match',
  'finance.bank.reconciliation.match',
  'finance.bank.reconciliation.group_match',
  'finance.bank.reconciliation.partial_match',
  'finance.bank.reconciliation.unmatch',
  'finance.bank.reconciliation.finalize',
  'finance.bank.reconciliation.finalize_with_exceptions',
  'finance.bank.reconciliation.reopen',
  'finance.bank.reconciliation.exception_manage',
  'finance.bank.reconciliation.clearing_post',
  'finance.bank.reconciliation.adjustment_draft_create',
] as const

export type BankReconciliationPermission = (typeof BANK_RECONCILIATION_PERMISSIONS)[number]

const DEMO_ROLE_MAP: Partial<Record<ErpRole, BankReconciliationPermission[]>> = {
  admin: [...BANK_RECONCILIATION_PERMISSIONS],
  ceo: [...BANK_RECONCILIATION_PERMISSIONS],
  director: [...BANK_RECONCILIATION_PERMISSIONS],
  accounts_head: [...BANK_RECONCILIATION_PERMISSIONS],
  accounts_user: [
    'finance.bank.reconciliation.view',
    'finance.bank.reconciliation.run_auto_match',
    'finance.bank.reconciliation.match',
    'finance.bank.reconciliation.group_match',
    'finance.bank.reconciliation.partial_match',
    'finance.bank.reconciliation.unmatch',
    'finance.bank.reconciliation.exception_manage',
    'finance.bank.reconciliation.adjustment_draft_create',
  ],
  accounts: [
    'finance.bank.reconciliation.view',
    'finance.bank.reconciliation.run_auto_match',
    'finance.bank.reconciliation.match',
    'finance.bank.reconciliation.group_match',
    'finance.bank.reconciliation.partial_match',
    'finance.bank.reconciliation.unmatch',
    'finance.bank.reconciliation.exception_manage',
    'finance.bank.reconciliation.adjustment_draft_create',
  ],
}

function resolveDemoPermissions(role: ErpRole): Set<BankReconciliationPermission> {
  const pack = DEMO_ROLE_MAP[role] ?? ['finance.bank.reconciliation.view']
  return new Set(pack)
}

function resolveApiPermissions(): Set<BankReconciliationPermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(
    perms.filter((p): p is BankReconciliationPermission => (BANK_RECONCILIATION_PERMISSIONS as readonly string[]).includes(p)),
  )
}

/** Demo-mode fallback maps onto the existing Bank & Cash demo permission pack. */
function demoFallback(permission: BankReconciliationPermission, role: ErpRole): boolean {
  const bankCashMap: Partial<Record<BankReconciliationPermission, BankCashPermission>> = {
    'finance.bank.reconciliation.view': 'accounting.bank_cash.view_reconciliation',
    'finance.bank.reconciliation.run_auto_match': 'accounting.bank_cash.manage_reconciliation',
    'finance.bank.reconciliation.match': 'accounting.bank_cash.manage_reconciliation',
    'finance.bank.reconciliation.group_match': 'accounting.bank_cash.manage_reconciliation',
    'finance.bank.reconciliation.partial_match': 'accounting.bank_cash.manage_reconciliation',
    'finance.bank.reconciliation.unmatch': 'accounting.bank_cash.manage_reconciliation',
    'finance.bank.reconciliation.finalize': 'accounting.bank_cash.complete_reconciliation',
    'finance.bank.reconciliation.finalize_with_exceptions': 'accounting.bank_cash.complete_reconciliation',
    'finance.bank.reconciliation.reopen': 'accounting.bank_cash.reopen_reconciliation',
    'finance.bank.reconciliation.exception_manage': 'accounting.bank_cash.manage_reconciliation',
    'finance.bank.reconciliation.clearing_post': 'accounting.bank_cash.manage_reconciliation',
    'finance.bank.reconciliation.adjustment_draft_create': 'accounting.bank_cash.manage_reconciliation',
  }
  const bc = bankCashMap[permission]
  if (bc) return hasBankCashPermission(bc, role)
  return resolveDemoPermissions(role).has(permission)
}

export function hasBankReconciliationPermission(permission: BankReconciliationPermission, role?: ErpRole): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) return resolveApiPermissions().has(permission)
  return demoFallback(permission, role ?? getSessionUser().role)
}

/** Combines a UI-side permission with a server-computed `allowedActions` flag (server wins when defined). */
export function mergeAllowedAction(uiPerm: boolean, serverAction?: boolean): boolean {
  if (serverAction === undefined) return uiPerm
  return uiPerm && serverAction
}

export function useBankReconciliationPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set =
      isApiMode() && hasWorkspaceAdminRole()
        ? new Set<BankReconciliationPermission>(BANK_RECONCILIATION_PERMISSIONS)
        : isApiMode()
          ? resolveApiPermissions()
          : resolveDemoPermissions(user.role)
    const can = (p: BankReconciliationPermission) => (isApiMode() ? set.has(p) : demoFallback(p, user.role))
    return {
      role: user.role,
      canView: can('finance.bank.reconciliation.view'),
      canRunAutoMatch: can('finance.bank.reconciliation.run_auto_match'),
      canMatch: can('finance.bank.reconciliation.match'),
      canGroupMatch: can('finance.bank.reconciliation.group_match'),
      canPartialMatch: can('finance.bank.reconciliation.partial_match'),
      canUnmatch: can('finance.bank.reconciliation.unmatch'),
      canFinalize: can('finance.bank.reconciliation.finalize'),
      canFinalizeWithExceptions: can('finance.bank.reconciliation.finalize_with_exceptions'),
      canReopen: can('finance.bank.reconciliation.reopen'),
      canManageExceptions: can('finance.bank.reconciliation.exception_manage'),
      canClearingPost: can('finance.bank.reconciliation.clearing_post'),
      canCreateAdjustmentDraft: can('finance.bank.reconciliation.adjustment_draft_create'),
      can,
    }
  }, [user.role])
}
