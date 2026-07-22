/**
 * Money In (AR) fine-grained frontend permissions — backend keys: finance.ar.*
 */

import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const MONEY_IN_PERMISSIONS = [
  'finance.ar.view',
  'finance.ar.invoice.view',
  'finance.ar.invoice.create',
  'finance.ar.invoice.edit',
  'finance.ar.invoice.post',
  'finance.ar.invoice.cancel',
  'finance.ar.invoice.reverse',
  'finance.ar.reconcile.view',
  'finance.ar.credit_note.view',
  'finance.ar.credit_note.create',
  'finance.ar.credit_note.edit',
  'finance.ar.credit_note.submit',
  'finance.ar.credit_note.approve',
  'finance.ar.credit_note.cancel',
  'finance.ar.credit_note.post',
  'finance.ar.credit_note.mark_ready',
  'finance.ar.allocation.view',
  'finance.ar.allocation.create',
  'finance.ar.allocation.reverse',
  'finance.ar.receipt.view',
  'finance.ar.receipt.create',
  'finance.ar.receipt.edit',
  'finance.ar.receipt.post',
  'finance.ar.receipt.cancel',
  'finance.ar.receipt.reverse',
  'finance.ar.credit_note.reverse',
] as const

export type MoneyInPermission = (typeof MONEY_IN_PERMISSIONS)[number]

const VIEWER: MoneyInPermission[] = [
  'finance.ar.view',
  'finance.ar.invoice.view',
  'finance.ar.credit_note.view',
  'finance.ar.receipt.view',
]

const EXEC: MoneyInPermission[] = [
  ...VIEWER,
  'finance.ar.invoice.create',
  'finance.ar.invoice.edit',
  'finance.ar.invoice.cancel',
  'finance.ar.credit_note.create',
  'finance.ar.credit_note.edit',
  'finance.ar.credit_note.submit',
  'finance.ar.credit_note.cancel',
  'finance.ar.credit_note.mark_ready',
  'finance.ar.allocation.create',
  'finance.ar.receipt.create',
  'finance.ar.receipt.edit',
  'finance.ar.receipt.cancel',
]

const MANAGER: MoneyInPermission[] = [
  ...EXEC,
  'finance.ar.invoice.post',
  'finance.ar.invoice.reverse',
  'finance.ar.reconcile.view',
  'finance.ar.credit_note.approve',
  'finance.ar.credit_note.post',
  'finance.ar.credit_note.reverse',
  'finance.ar.allocation.view',
  'finance.ar.allocation.reverse',
  'finance.ar.receipt.post',
  'finance.ar.receipt.reverse',
]

const ROLE_PACKS: Partial<Record<ErpRole, MoneyInPermission[]>> = {
  admin: [...MANAGER],
  ceo: [...MANAGER],
  director: [...MANAGER],
  accounts_head: [...MANAGER],
  accounts_user: [...EXEC],
  accounts: [...EXEC],
  management: [...VIEWER],
}

function resolveDemoPermissions(role: ErpRole): Set<MoneyInPermission> {
  return new Set(ROLE_PACKS[role] ?? VIEWER)
}

function resolveApiPermissions(): Set<MoneyInPermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(perms.filter((p): p is MoneyInPermission => (MONEY_IN_PERMISSIONS as readonly string[]).includes(p)))
}

export function hasMoneyInPermission(permission: MoneyInPermission, role?: ErpRole): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) return resolveApiPermissions().has(permission)
  return resolveDemoPermissions(role ?? getSessionUser().role).has(permission)
}

/** AND UI permission with server allowedActions when present. */
export function mergeAllowedAction(uiPerm: boolean, serverAction?: boolean): boolean {
  if (serverAction === undefined) return uiPerm
  return uiPerm && serverAction
}

export function useMoneyInPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set =
      isApiMode() && hasWorkspaceAdminRole()
        ? new Set<MoneyInPermission>(MONEY_IN_PERMISSIONS)
        : isApiMode()
          ? resolveApiPermissions()
          : resolveDemoPermissions(user.role)
    const can = (p: MoneyInPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('finance.ar.view') || can('finance.ar.invoice.view'),
      canViewInvoice: can('finance.ar.invoice.view') || can('finance.ar.view'),
      canCreateInvoice: can('finance.ar.invoice.create'),
      canEditInvoice: can('finance.ar.invoice.edit'),
      canPostInvoice: can('finance.ar.invoice.post'),
      canCancelInvoice: can('finance.ar.invoice.cancel'),
      canReverseInvoice: can('finance.ar.invoice.reverse'),
      canReconcile: can('finance.ar.reconcile.view'),
      canViewCreditNote: can('finance.ar.credit_note.view') || can('finance.ar.view'),
      canCreateCreditNote: can('finance.ar.credit_note.create'),
      canEditCreditNote: can('finance.ar.credit_note.edit'),
      canSubmitCreditNote: can('finance.ar.credit_note.submit'),
      canApproveCreditNote: can('finance.ar.credit_note.approve'),
      canCancelCreditNote: can('finance.ar.credit_note.cancel'),
      canPostCreditNote: can('finance.ar.credit_note.post'),
      canMarkReadyCreditNote: can('finance.ar.credit_note.mark_ready'),
      canAllocate: can('finance.ar.allocation.create'),
      canViewAllocations: can('finance.ar.allocation.view') || can('finance.ar.allocation.create'),
      canReverseAllocation: can('finance.ar.allocation.reverse'),
      canViewReceipt: can('finance.ar.receipt.view') || can('finance.ar.view'),
      canCreateReceipt: can('finance.ar.receipt.create'),
      canEditReceipt: can('finance.ar.receipt.edit'),
      canPostReceipt: can('finance.ar.receipt.post'),
      canCancelReceipt: can('finance.ar.receipt.cancel'),
      canReverseReceipt: can('finance.ar.receipt.reverse'),
      canReverseCreditNote: can('finance.ar.credit_note.reverse'),
      can,
    }
  }, [user.role])
}
