/**
 * Finance Phase 5B1 — Treasury internal transfer permissions (finance.treasury.transfer.*)
 */
import { useMemo } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasBankCashPermission, type BankCashPermission } from './bankCash'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const TREASURY_TRANSFER_PERMISSIONS = [
  'finance.treasury.transfer.view',
  'finance.treasury.transfer.create',
  'finance.treasury.transfer.edit',
  'finance.treasury.transfer.submit',
  'finance.treasury.transfer.approve',
  'finance.treasury.transfer.post',
  'finance.treasury.transfer.dispatch',
  'finance.treasury.transfer.receive',
  'finance.treasury.transfer.cancel',
  'finance.treasury.transfer.reverse',
  'finance.treasury.transfer.in_transit.view',
] as const

export type TreasuryTransferPermission = (typeof TREASURY_TRANSFER_PERMISSIONS)[number]

const DEMO_ROLE_MAP: Partial<Record<ErpRole, TreasuryTransferPermission[]>> = {
  admin: [...TREASURY_TRANSFER_PERMISSIONS],
  ceo: [...TREASURY_TRANSFER_PERMISSIONS],
  director: [...TREASURY_TRANSFER_PERMISSIONS],
  accounts_head: [...TREASURY_TRANSFER_PERMISSIONS],
  accounts_user: [
    'finance.treasury.transfer.view',
    'finance.treasury.transfer.create',
    'finance.treasury.transfer.edit',
    'finance.treasury.transfer.submit',
    'finance.treasury.transfer.dispatch',
    'finance.treasury.transfer.receive',
    'finance.treasury.transfer.in_transit.view',
  ],
  accounts: [
    'finance.treasury.transfer.view',
    'finance.treasury.transfer.create',
    'finance.treasury.transfer.edit',
    'finance.treasury.transfer.submit',
    'finance.treasury.transfer.dispatch',
    'finance.treasury.transfer.receive',
    'finance.treasury.transfer.in_transit.view',
  ],
}

function resolveDemoPermissions(role: ErpRole): Set<TreasuryTransferPermission> {
  const pack = DEMO_ROLE_MAP[role] ?? ['finance.treasury.transfer.view']
  return new Set(pack)
}

function resolveApiPermissions(): Set<TreasuryTransferPermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(perms.filter((p): p is TreasuryTransferPermission => (TREASURY_TRANSFER_PERMISSIONS as readonly string[]).includes(p)))
}

/** Demo-mode fallback maps onto the existing Bank & Cash fund-transfer demo permission pack. */
function demoFallback(permission: TreasuryTransferPermission, role: ErpRole): boolean {
  const bankCashMap: Partial<Record<TreasuryTransferPermission, BankCashPermission>> = {
    'finance.treasury.transfer.view': 'accounting.bank_cash.view_fund_transfer',
    'finance.treasury.transfer.create': 'accounting.bank_cash.create_fund_transfer',
    'finance.treasury.transfer.edit': 'accounting.bank_cash.edit_fund_transfer',
    'finance.treasury.transfer.submit': 'accounting.bank_cash.submit_fund_transfer',
    'finance.treasury.transfer.approve': 'accounting.bank_cash.approve_fund_transfer',
    'finance.treasury.transfer.post': 'accounting.bank_cash.complete_fund_transfer',
    'finance.treasury.transfer.dispatch': 'accounting.bank_cash.complete_fund_transfer',
    'finance.treasury.transfer.receive': 'accounting.bank_cash.complete_fund_transfer',
    'finance.treasury.transfer.cancel': 'accounting.bank_cash.edit_fund_transfer',
    'finance.treasury.transfer.reverse': 'accounting.bank_cash.reverse_fund_transfer',
    'finance.treasury.transfer.in_transit.view': 'accounting.bank_cash.view_fund_transfer',
  }
  const bc = bankCashMap[permission]
  if (bc) return hasBankCashPermission(bc, role)
  return resolveDemoPermissions(role).has(permission)
}

export function hasTreasuryTransferPermission(permission: TreasuryTransferPermission, role?: ErpRole): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) return resolveApiPermissions().has(permission)
  return demoFallback(permission, role ?? getSessionUser().role)
}

/** Combines a UI-side permission with a server-computed `allowedActions` flag (server wins when defined). */
export function mergeAllowedAction(uiPerm: boolean, serverAction?: boolean): boolean {
  if (serverAction === undefined) return uiPerm
  return uiPerm && serverAction
}

export function useTreasuryTransferPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set =
      isApiMode() && hasWorkspaceAdminRole()
        ? new Set<TreasuryTransferPermission>(TREASURY_TRANSFER_PERMISSIONS)
        : isApiMode()
          ? resolveApiPermissions()
          : resolveDemoPermissions(user.role)
    const can = (p: TreasuryTransferPermission) => (isApiMode() ? set.has(p) : demoFallback(p, user.role))
    return {
      role: user.role,
      canView: can('finance.treasury.transfer.view'),
      canCreate: can('finance.treasury.transfer.create'),
      canEdit: can('finance.treasury.transfer.edit'),
      canSubmit: can('finance.treasury.transfer.submit'),
      canApprove: can('finance.treasury.transfer.approve'),
      canPost: can('finance.treasury.transfer.post'),
      canDispatch: can('finance.treasury.transfer.dispatch'),
      canReceive: can('finance.treasury.transfer.receive'),
      canCancel: can('finance.treasury.transfer.cancel'),
      canReverse: can('finance.treasury.transfer.reverse'),
      canViewInTransit: can('finance.treasury.transfer.in_transit.view'),
      can,
    }
  }, [user.role])
}
