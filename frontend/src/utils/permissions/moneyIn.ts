/**
 * Money In (AR) fine-grained frontend permissions — backend keys: finance.ar.*
 */

import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { getSessionUser, type ErpRole } from './index'

export const MONEY_IN_PERMISSIONS = [
  'finance.ar.view',
  'finance.ar.invoice.view',
  'finance.ar.invoice.create',
  'finance.ar.invoice.edit',
  'finance.ar.invoice.post',
  'finance.ar.invoice.cancel',
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
] as const

export type MoneyInPermission = (typeof MONEY_IN_PERMISSIONS)[number]

const VIEWER: MoneyInPermission[] = [
  'finance.ar.view',
  'finance.ar.invoice.view',
  'finance.ar.credit_note.view',
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
]

const MANAGER: MoneyInPermission[] = [
  ...EXEC,
  'finance.ar.invoice.post',
  'finance.ar.reconcile.view',
  'finance.ar.credit_note.approve',
  'finance.ar.credit_note.post',
  'finance.ar.allocation.view',
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
    const set = isApiMode() ? resolveApiPermissions() : resolveDemoPermissions(user.role)
    const can = (p: MoneyInPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('finance.ar.view') || can('finance.ar.invoice.view'),
      canViewInvoice: can('finance.ar.invoice.view') || can('finance.ar.view'),
      canCreateInvoice: can('finance.ar.invoice.create'),
      canEditInvoice: can('finance.ar.invoice.edit'),
      canPostInvoice: can('finance.ar.invoice.post'),
      canCancelInvoice: can('finance.ar.invoice.cancel'),
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
      can,
    }
  }, [user.role])
}
