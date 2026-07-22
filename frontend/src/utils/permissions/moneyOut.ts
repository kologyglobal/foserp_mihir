/**
 * Money Out (AP) fine-grained frontend permissions — backend keys: finance.ap.*
 */
import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const MONEY_OUT_PERMISSIONS = [
  'finance.ap.view',
  'finance.ap.vendor_invoice.view',
  'finance.ap.vendor_invoice.create',
  'finance.ap.vendor_invoice.edit',
  'finance.ap.vendor_invoice.submit',
  'finance.ap.vendor_invoice.approve',
  'finance.ap.vendor_invoice.post',
  'finance.ap.vendor_invoice.cancel',
  'finance.ap.vendor_invoice.mark_ready',
  'finance.ap.vendor_invoice.reverse',
  'finance.ap.open_item.view',
  // Vendor payments / advances (Phase 4B5)
  'finance.ap.payment.view',
  'finance.ap.payment.create',
  'finance.ap.payment.edit',
  'finance.ap.payment.submit',
  'finance.ap.payment.approve',
  'finance.ap.payment.post',
  'finance.ap.payment.cancel',
  'finance.ap.payment.mark_ready',
  'finance.ap.payment.reverse',
  // Payable allocations (subledger only)
  'finance.ap.allocation.view',
  'finance.ap.allocation.create',
  'finance.ap.allocation.reverse',
  // Vendor advances read
  'finance.ap.advance.view',
  // Vendor adjustments + corrections (Phase 4C2)
  'finance.ap.adjustment.view',
  'finance.ap.adjustment.create',
  'finance.ap.adjustment.edit',
  'finance.ap.adjustment.submit',
  'finance.ap.adjustment.approve',
  'finance.ap.adjustment.post',
  'finance.ap.adjustment.cancel',
  'finance.ap.adjustment.mark_ready',
  'finance.ap.adjustment.reverse',
  'finance.ap.corrections.view',
  // AP reconciliation + close gate (Phase 4D2)
  'finance.ap.reconciliation.view',
  'finance.ap.reconciliation.run',
  'finance.ap.reconciliation.export',
  'finance.ap.reconciliation.exception.view',
  'finance.ap.reconciliation.exception.acknowledge',
  'finance.ap.close_gate.view',
  'finance.ap.close_gate.run',
  'finance.ap.close_gate.export',
] as const

export type MoneyOutPermission = (typeof MONEY_OUT_PERMISSIONS)[number]

const VIEWER: MoneyOutPermission[] = [
  'finance.ap.view',
  'finance.ap.vendor_invoice.view',
  'finance.ap.open_item.view',
  'finance.ap.payment.view',
  'finance.ap.allocation.view',
  'finance.ap.advance.view',
  'finance.ap.adjustment.view',
  'finance.ap.corrections.view',
]

const EXEC: MoneyOutPermission[] = [
  ...VIEWER,
  'finance.ap.vendor_invoice.create',
  'finance.ap.vendor_invoice.edit',
  'finance.ap.vendor_invoice.submit',
  'finance.ap.vendor_invoice.cancel',
  'finance.ap.vendor_invoice.mark_ready',
  'finance.ap.payment.view',
  'finance.ap.payment.create',
  'finance.ap.payment.edit',
  'finance.ap.payment.submit',
  'finance.ap.payment.cancel',
  'finance.ap.payment.mark_ready',
  'finance.ap.allocation.view',
  'finance.ap.allocation.create',
  'finance.ap.advance.view',
  'finance.ap.adjustment.create',
  'finance.ap.adjustment.edit',
  'finance.ap.adjustment.submit',
  'finance.ap.adjustment.cancel',
  'finance.ap.adjustment.mark_ready',
]

const MANAGER: MoneyOutPermission[] = [
  ...EXEC,
  'finance.ap.vendor_invoice.approve',
  'finance.ap.vendor_invoice.post',
  'finance.ap.vendor_invoice.reverse',
  'finance.ap.payment.approve',
  'finance.ap.payment.post',
  'finance.ap.payment.reverse',
  'finance.ap.allocation.reverse',
  'finance.ap.adjustment.approve',
  'finance.ap.adjustment.post',
  'finance.ap.adjustment.reverse',
  'finance.ap.reconciliation.view',
  'finance.ap.reconciliation.run',
  'finance.ap.reconciliation.export',
  'finance.ap.reconciliation.exception.view',
  'finance.ap.reconciliation.exception.acknowledge',
  'finance.ap.close_gate.view',
  'finance.ap.close_gate.run',
  'finance.ap.close_gate.export',
]

const ROLE_PACKS: Partial<Record<ErpRole, MoneyOutPermission[]>> = {
  admin: [...MANAGER],
  ceo: [...MANAGER],
  director: [...MANAGER],
  accounts_head: [...MANAGER],
  accounts_user: [...EXEC],
  accounts: [...EXEC],
  management: [...VIEWER],
}

function resolveDemoPermissions(role: ErpRole): Set<MoneyOutPermission> {
  return new Set(ROLE_PACKS[role] ?? VIEWER)
}

function resolveApiPermissions(): Set<MoneyOutPermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(perms.filter((p): p is MoneyOutPermission => (MONEY_OUT_PERMISSIONS as readonly string[]).includes(p)))
}

export function hasMoneyOutPermission(permission: MoneyOutPermission, role?: ErpRole): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) return resolveApiPermissions().has(permission)
  return resolveDemoPermissions(role ?? getSessionUser().role).has(permission)
}

/** AND UI permission with server allowedActions when present. */
export function mergeAllowedAction(uiPerm: boolean, serverAction?: boolean): boolean {
  if (serverAction === undefined) return uiPerm
  return uiPerm && serverAction
}

export function useMoneyOutPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set =
      isApiMode() && hasWorkspaceAdminRole()
        ? new Set<MoneyOutPermission>(MONEY_OUT_PERMISSIONS)
        : isApiMode()
          ? resolveApiPermissions()
          : resolveDemoPermissions(user.role)
    const can = (p: MoneyOutPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('finance.ap.view') || can('finance.ap.vendor_invoice.view'),
      canViewInvoice: can('finance.ap.vendor_invoice.view') || can('finance.ap.view'),
      canCreateInvoice: can('finance.ap.vendor_invoice.create'),
      canEditInvoice: can('finance.ap.vendor_invoice.edit'),
      canSubmitInvoice: can('finance.ap.vendor_invoice.submit'),
      canApproveInvoice: can('finance.ap.vendor_invoice.approve'),
      canPostInvoice: can('finance.ap.vendor_invoice.post'),
      canCancelInvoice: can('finance.ap.vendor_invoice.cancel'),
      canMarkReady: can('finance.ap.vendor_invoice.mark_ready'),
      canReverseInvoice: can('finance.ap.vendor_invoice.reverse'),
      canViewOpenItem: can('finance.ap.open_item.view') || can('finance.ap.view'),
      // Vendor payments / advances (Phase 4B5)
      canViewPayment: can('finance.ap.payment.view') || can('finance.ap.view'),
      canCreatePayment: can('finance.ap.payment.create'),
      canEditPayment: can('finance.ap.payment.edit'),
      canSubmitPayment: can('finance.ap.payment.submit'),
      canApprovePayment: can('finance.ap.payment.approve'),
      canPostPayment: can('finance.ap.payment.post'),
      canCancelPayment: can('finance.ap.payment.cancel'),
      canMarkReadyPayment: can('finance.ap.payment.mark_ready'),
      canReversePayment: can('finance.ap.payment.reverse'),
      canViewAdvance: can('finance.ap.advance.view') || can('finance.ap.payment.view') || can('finance.ap.view'),
      // Payable allocations (subledger only)
      canViewAllocation: can('finance.ap.allocation.view') || can('finance.ap.view'),
      canCreateAllocation: can('finance.ap.allocation.create'),
      canReverseAllocation: can('finance.ap.allocation.reverse'),
      // Vendor adjustments + corrections (Phase 4C2)
      canViewAdjustment: can('finance.ap.adjustment.view') || can('finance.ap.view'),
      canCreateAdjustment: can('finance.ap.adjustment.create'),
      canEditAdjustment: can('finance.ap.adjustment.edit'),
      canSubmitAdjustment: can('finance.ap.adjustment.submit'),
      canApproveAdjustment: can('finance.ap.adjustment.approve'),
      canPostAdjustment: can('finance.ap.adjustment.post'),
      canCancelAdjustment: can('finance.ap.adjustment.cancel'),
      canMarkReadyAdjustment: can('finance.ap.adjustment.mark_ready'),
      canReverseAdjustment: can('finance.ap.adjustment.reverse'),
      canViewCorrections: can('finance.ap.corrections.view') || can('finance.ap.view'),
      canReconcileView: can('finance.ap.reconciliation.view') || can('finance.ap.view'),
      canReconcileRun: can('finance.ap.reconciliation.run'),
      canReconcileExport: can('finance.ap.reconciliation.export'),
      canReconcileExceptionView: can('finance.ap.reconciliation.exception.view') || can('finance.ap.reconciliation.view'),
      canReconcileExceptionAcknowledge: can('finance.ap.reconciliation.exception.acknowledge'),
      canCloseGateView: can('finance.ap.close_gate.view') || can('finance.ap.view'),
      canCloseGateRun: can('finance.ap.close_gate.run'),
      canCloseGateExport: can('finance.ap.close_gate.export'),
      can,
    }
  }, [user.role])
}
