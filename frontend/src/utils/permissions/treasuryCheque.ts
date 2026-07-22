/**
 * Finance Phase 5B2 — Treasury cheque permissions (finance.treasury.cheque.*)
 */
import { useMemo } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasBankCashPermission, type BankCashPermission } from './bankCash'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const TREASURY_CHEQUE_PERMISSIONS = [
  'finance.treasury.cheque.view',
  'finance.treasury.cheque.create',
  'finance.treasury.cheque.edit',
  'finance.treasury.cheque.submit',
  'finance.treasury.cheque.approve',
  'finance.treasury.cheque.issue',
  'finance.treasury.cheque.deposit',
  'finance.treasury.cheque.clear',
  'finance.treasury.cheque.bounce',
  'finance.treasury.cheque.stop',
  'finance.treasury.cheque.cancel',
  'finance.treasury.cheque.reverse',
] as const

export type TreasuryChequePermission = (typeof TREASURY_CHEQUE_PERMISSIONS)[number]

const DEMO_ROLE_MAP: Partial<Record<ErpRole, TreasuryChequePermission[]>> = {
  admin: [...TREASURY_CHEQUE_PERMISSIONS],
  ceo: [...TREASURY_CHEQUE_PERMISSIONS],
  director: [...TREASURY_CHEQUE_PERMISSIONS],
  accounts_head: [...TREASURY_CHEQUE_PERMISSIONS],
  accounts_user: [
    'finance.treasury.cheque.view',
    'finance.treasury.cheque.create',
    'finance.treasury.cheque.edit',
    'finance.treasury.cheque.submit',
    'finance.treasury.cheque.issue',
    'finance.treasury.cheque.deposit',
  ],
  accounts: [
    'finance.treasury.cheque.view',
    'finance.treasury.cheque.create',
    'finance.treasury.cheque.edit',
    'finance.treasury.cheque.submit',
    'finance.treasury.cheque.issue',
    'finance.treasury.cheque.deposit',
  ],
}

function resolveDemoPermissions(role: ErpRole): Set<TreasuryChequePermission> {
  const pack = DEMO_ROLE_MAP[role] ?? ['finance.treasury.cheque.view']
  return new Set(pack)
}

function resolveApiPermissions(): Set<TreasuryChequePermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(perms.filter((p): p is TreasuryChequePermission => (TREASURY_CHEQUE_PERMISSIONS as readonly string[]).includes(p)))
}

/** Demo-mode fallback maps onto the existing Bank & Cash cheque demo permission pack. */
function demoFallback(permission: TreasuryChequePermission, role: ErpRole): boolean {
  const bankCashMap: Partial<Record<TreasuryChequePermission, BankCashPermission>> = {
    'finance.treasury.cheque.view': 'accounting.bank_cash.view_cheques',
    'finance.treasury.cheque.create': 'accounting.bank_cash.manage_cheques',
    'finance.treasury.cheque.edit': 'accounting.bank_cash.manage_cheques',
    'finance.treasury.cheque.submit': 'accounting.bank_cash.manage_cheques',
    'finance.treasury.cheque.approve': 'accounting.bank_cash.manage_cheques',
    'finance.treasury.cheque.issue': 'accounting.bank_cash.manage_cheques',
    'finance.treasury.cheque.deposit': 'accounting.bank_cash.manage_cheques',
    'finance.treasury.cheque.clear': 'accounting.bank_cash.manage_cheques',
    'finance.treasury.cheque.bounce': 'accounting.bank_cash.manage_cheques',
    'finance.treasury.cheque.stop': 'accounting.bank_cash.manage_cheques',
    'finance.treasury.cheque.cancel': 'accounting.bank_cash.manage_cheques',
    'finance.treasury.cheque.reverse': 'accounting.bank_cash.manage_cheques',
  }
  const bc = bankCashMap[permission]
  if (bc) return hasBankCashPermission(bc, role)
  return resolveDemoPermissions(role).has(permission)
}

export function hasTreasuryChequePermission(permission: TreasuryChequePermission, role?: ErpRole): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) return resolveApiPermissions().has(permission)
  return demoFallback(permission, role ?? getSessionUser().role)
}

/** Combines a UI-side permission with a server-computed `allowedActions` flag (server wins when defined). */
export function mergeAllowedAction(uiPerm: boolean, serverAction?: boolean): boolean {
  if (serverAction === undefined) return uiPerm
  return uiPerm && serverAction
}

export function useTreasuryChequePermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set =
      isApiMode() && hasWorkspaceAdminRole()
        ? new Set<TreasuryChequePermission>(TREASURY_CHEQUE_PERMISSIONS)
        : isApiMode()
          ? resolveApiPermissions()
          : resolveDemoPermissions(user.role)
    const can = (p: TreasuryChequePermission) => (isApiMode() ? set.has(p) : demoFallback(p, user.role))
    return {
      role: user.role,
      canView: can('finance.treasury.cheque.view'),
      canCreate: can('finance.treasury.cheque.create'),
      canEdit: can('finance.treasury.cheque.edit'),
      canSubmit: can('finance.treasury.cheque.submit'),
      canApprove: can('finance.treasury.cheque.approve'),
      canIssue: can('finance.treasury.cheque.issue'),
      canDeposit: can('finance.treasury.cheque.deposit'),
      canClear: can('finance.treasury.cheque.clear'),
      canBounce: can('finance.treasury.cheque.bounce'),
      canStop: can('finance.treasury.cheque.stop'),
      canCancel: can('finance.treasury.cheque.cancel'),
      canReverse: can('finance.treasury.cheque.reverse'),
      can,
    }
  }, [user.role])
}
