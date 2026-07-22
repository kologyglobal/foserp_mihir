/**
 * Finance Phase 5B3 — Treasury adjustment / posting rule / standing instruction / book permissions
 * (`finance.treasury.adjustment.*`, `finance.treasury.posting_rule.*`,
 * `finance.treasury.standing_instruction.*`, `finance.treasury.book.view`).
 */
import { useMemo } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasBankCashPermission, type BankCashPermission } from './bankCash'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const TREASURY_ADJUSTMENT_PERMISSIONS = [
  'finance.treasury.adjustment.view',
  'finance.treasury.adjustment.create',
  'finance.treasury.adjustment.edit',
  'finance.treasury.adjustment.submit',
  'finance.treasury.adjustment.approve',
  'finance.treasury.adjustment.post',
  'finance.treasury.adjustment.cancel',
  'finance.treasury.adjustment.reverse',
  'finance.treasury.posting_rule.view',
  'finance.treasury.posting_rule.manage',
  'finance.treasury.standing_instruction.view',
  'finance.treasury.standing_instruction.manage',
  'finance.treasury.standing_instruction.generate',
  'finance.treasury.book.view',
  'finance.treasury.liquidity.view',
  'finance.treasury.closing.view',
  'finance.treasury.closing.manage',
] as const

export type TreasuryAdjustmentPermission = (typeof TREASURY_ADJUSTMENT_PERMISSIONS)[number]

const DEMO_ROLE_MAP: Partial<Record<ErpRole, TreasuryAdjustmentPermission[]>> = {
  admin: [...TREASURY_ADJUSTMENT_PERMISSIONS],
  ceo: [...TREASURY_ADJUSTMENT_PERMISSIONS],
  director: [...TREASURY_ADJUSTMENT_PERMISSIONS],
  accounts_head: [...TREASURY_ADJUSTMENT_PERMISSIONS],
  accounts_user: [
    'finance.treasury.adjustment.view',
    'finance.treasury.adjustment.create',
    'finance.treasury.adjustment.edit',
    'finance.treasury.adjustment.submit',
    'finance.treasury.posting_rule.view',
    'finance.treasury.standing_instruction.view',
    'finance.treasury.standing_instruction.generate',
    'finance.treasury.book.view',
  ],
  accounts: [
    'finance.treasury.adjustment.view',
    'finance.treasury.adjustment.create',
    'finance.treasury.adjustment.edit',
    'finance.treasury.adjustment.submit',
    'finance.treasury.posting_rule.view',
    'finance.treasury.standing_instruction.view',
    'finance.treasury.standing_instruction.generate',
    'finance.treasury.book.view',
  ],
}

function resolveDemoPermissions(role: ErpRole): Set<TreasuryAdjustmentPermission> {
  const pack = DEMO_ROLE_MAP[role] ?? ['finance.treasury.adjustment.view', 'finance.treasury.book.view']
  return new Set(pack)
}

function resolveApiPermissions(): Set<TreasuryAdjustmentPermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(perms.filter((p): p is TreasuryAdjustmentPermission => (TREASURY_ADJUSTMENT_PERMISSIONS as readonly string[]).includes(p)))
}

/** Demo-mode fallback maps onto the existing Bank & Cash reconciliation/cash-book demo permission pack. */
function demoFallback(permission: TreasuryAdjustmentPermission, role: ErpRole): boolean {
  const bankCashMap: Partial<Record<TreasuryAdjustmentPermission, BankCashPermission>> = {
    'finance.treasury.adjustment.view': 'accounting.bank_cash.view_transactions',
    'finance.treasury.adjustment.create': 'accounting.bank_cash.manage_reconciliation',
    'finance.treasury.adjustment.edit': 'accounting.bank_cash.manage_reconciliation',
    'finance.treasury.adjustment.submit': 'accounting.bank_cash.manage_reconciliation',
    'finance.treasury.adjustment.approve': 'accounting.bank_cash.complete_reconciliation',
    'finance.treasury.adjustment.post': 'accounting.bank_cash.post_cash_adjustment',
    'finance.treasury.adjustment.cancel': 'accounting.bank_cash.manage_reconciliation',
    'finance.treasury.adjustment.reverse': 'accounting.bank_cash.reverse_fund_transfer',
    'finance.treasury.posting_rule.view': 'accounting.bank_cash.view_reconciliation',
    'finance.treasury.posting_rule.manage': 'accounting.bank_cash.manage_setup',
    'finance.treasury.standing_instruction.view': 'accounting.bank_cash.view_reconciliation',
    'finance.treasury.standing_instruction.manage': 'accounting.bank_cash.manage_reconciliation',
    'finance.treasury.standing_instruction.generate': 'accounting.bank_cash.manage_reconciliation',
    'finance.treasury.book.view': 'accounting.bank_cash.view_cash_book',
    'finance.treasury.liquidity.view': 'accounting.bank_cash.view_cash_book',
    'finance.treasury.closing.view': 'accounting.bank_cash.view_reconciliation',
    'finance.treasury.closing.manage': 'accounting.bank_cash.complete_reconciliation',
  }
  const bc = bankCashMap[permission]
  if (bc) return hasBankCashPermission(bc, role)
  return resolveDemoPermissions(role).has(permission)
}

export function hasTreasuryAdjustmentPermission(permission: TreasuryAdjustmentPermission, role?: ErpRole): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) return resolveApiPermissions().has(permission)
  return demoFallback(permission, role ?? getSessionUser().role)
}

/** Combines a UI-side permission with a server-computed `allowedActions` flag (server wins when defined). */
export function mergeAllowedAction(uiPerm: boolean, serverAction?: boolean): boolean {
  if (serverAction === undefined) return uiPerm
  return uiPerm && serverAction
}

export function useTreasuryAdjustmentPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set =
      isApiMode() && hasWorkspaceAdminRole()
        ? new Set<TreasuryAdjustmentPermission>(TREASURY_ADJUSTMENT_PERMISSIONS)
        : isApiMode()
          ? resolveApiPermissions()
          : resolveDemoPermissions(user.role)
    const can = (p: TreasuryAdjustmentPermission) => (isApiMode() ? set.has(p) : demoFallback(p, user.role))
    return {
      role: user.role,
      canView: can('finance.treasury.adjustment.view'),
      canCreate: can('finance.treasury.adjustment.create'),
      canEdit: can('finance.treasury.adjustment.edit'),
      canSubmit: can('finance.treasury.adjustment.submit'),
      canApprove: can('finance.treasury.adjustment.approve'),
      canPost: can('finance.treasury.adjustment.post'),
      canCancel: can('finance.treasury.adjustment.cancel'),
      canReverse: can('finance.treasury.adjustment.reverse'),
      canViewPostingRules: can('finance.treasury.posting_rule.view'),
      canManagePostingRules: can('finance.treasury.posting_rule.manage'),
      canViewStandingInstructions: can('finance.treasury.standing_instruction.view'),
      canManageStandingInstructions: can('finance.treasury.standing_instruction.manage'),
      canGenerateStandingInstructions: can('finance.treasury.standing_instruction.generate'),
      canViewBooks: can('finance.treasury.book.view'),
      canViewLiquidity: can('finance.treasury.liquidity.view'),
      canViewClosing: can('finance.treasury.closing.view'),
      canManageClosing: can('finance.treasury.closing.manage'),
      can,
    }
  }, [user.role])
}
