/**
 * Accounts Receivable fine-grained frontend permissions.
 *
 * SECURITY: All permissions must also be enforced by the future backend
 * (tenant isolation + RBAC on every receivables read / write / post / export).
 * UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const RECEIVABLES_PERMISSIONS = [
  'accounting.receivables.view',
  'accounting.receivables.view_customer',
  'accounting.receivables.view_invoice',
  'accounting.receivables.view_ageing',
  'accounting.receivables.view_collection',
  'accounting.receivables.create_receipt',
  'accounting.receivables.edit_receipt',
  'accounting.receivables.submit_receipt',
  'accounting.receivables.approve_receipt',
  'accounting.receivables.post_receipt',
  'accounting.receivables.reverse_receipt',
  'accounting.receivables.allocate_receipt',
  'accounting.receivables.reallocate_receipt',
  'accounting.receivables.manage_credit_note',
  'accounting.receivables.manage_dispute',
  'accounting.receivables.manage_collection',
  'accounting.receivables.manage_payment_promise',
  'accounting.receivables.preview_reminder',
  'accounting.receivables.manage_credit_hold',
  'accounting.receivables.view_statement',
  'accounting.receivables.export',
  'accounting.receivables.print',
  'accounting.receivables.view_audit',
  'accounting.receivables.save_view',
] as const

export type ReceivablesPermission = (typeof RECEIVABLES_PERMISSIONS)[number]

const ALL = [...RECEIVABLES_PERMISSIONS]

/** Collection executive — follow-ups, promises, reminders; no posting */
const COLLECTION_EXEC: ReceivablesPermission[] = [
  'accounting.receivables.view',
  'accounting.receivables.view_customer',
  'accounting.receivables.view_invoice',
  'accounting.receivables.view_ageing',
  'accounting.receivables.view_collection',
  'accounting.receivables.manage_collection',
  'accounting.receivables.manage_payment_promise',
  'accounting.receivables.preview_reminder',
  'accounting.receivables.view_statement',
  'accounting.receivables.export',
  'accounting.receivables.print',
  'accounting.receivables.save_view',
]

/** AR executive — receipts draft + allocate; no post/reverse/hold */
const AR_EXEC: ReceivablesPermission[] = [
  ...COLLECTION_EXEC,
  'accounting.receivables.create_receipt',
  'accounting.receivables.edit_receipt',
  'accounting.receivables.submit_receipt',
  'accounting.receivables.allocate_receipt',
  'accounting.receivables.manage_dispute',
]

const ACCOUNTANT: ReceivablesPermission[] = [
  ...AR_EXEC,
  'accounting.receivables.approve_receipt',
  'accounting.receivables.post_receipt',
  'accounting.receivables.manage_credit_note',
  'accounting.receivables.view_audit',
]

const SENIOR: ReceivablesPermission[] = [
  ...ACCOUNTANT,
  'accounting.receivables.reverse_receipt',
  'accounting.receivables.reallocate_receipt',
  'accounting.receivables.manage_credit_hold',
]

const SALES_COORD: ReceivablesPermission[] = [
  'accounting.receivables.view',
  'accounting.receivables.view_customer',
  'accounting.receivables.view_invoice',
  'accounting.receivables.view_collection',
  'accounting.receivables.preview_reminder',
  'accounting.receivables.view_statement',
  'accounting.receivables.print',
]

const AUDITOR: ReceivablesPermission[] = [
  'accounting.receivables.view',
  'accounting.receivables.view_customer',
  'accounting.receivables.view_invoice',
  'accounting.receivables.view_ageing',
  'accounting.receivables.view_collection',
  'accounting.receivables.view_statement',
  'accounting.receivables.view_audit',
  'accounting.receivables.export',
  'accounting.receivables.print',
]

const FINANCE_MANAGER: ReceivablesPermission[] = [...ALL]
const CFO: ReceivablesPermission[] = [...ALL]
const ADMIN: ReceivablesPermission[] = [...ALL]

const ROLE_PACKS: Partial<Record<ErpRole, ReceivablesPermission[]>> = {
  admin: ADMIN,
  ceo: CFO,
  director: CFO,
  accounts_head: FINANCE_MANAGER,
  accounts_user: ACCOUNTANT,
  accounts: ACCOUNTANT,
  management: CFO,
  sales_manager: [...SALES_COORD, 'accounting.receivables.view_ageing', 'accounting.receivables.export'],
  sales: SALES_COORD,
  purchase_head: AUDITOR,
  purchase_user: AUDITOR,
  purchase: AUDITOR,
  engineering_head: AUDITOR,
  quality_head: AUDITOR,
  dispatch_manager: SALES_COORD,
  planning_manager: AUDITOR,
}

function resolve(role: ErpRole): Set<ReceivablesPermission> {
  return new Set(ROLE_PACKS[role] ?? SENIOR)
}

export function hasReceivablesPermission(permission: ReceivablesPermission, role?: ErpRole): boolean {
  return resolve(role ?? getSessionUser().role).has(permission)
}

export function useReceivablesPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolve(user.role)
    const can = (p: ReceivablesPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('accounting.receivables.view'),
      canViewCustomer: can('accounting.receivables.view_customer'),
      canViewInvoice: can('accounting.receivables.view_invoice'),
      canViewAgeing: can('accounting.receivables.view_ageing'),
      canViewCollection: can('accounting.receivables.view_collection'),
      canCreateReceipt: can('accounting.receivables.create_receipt'),
      canEditReceipt: can('accounting.receivables.edit_receipt'),
      canSubmitReceipt: can('accounting.receivables.submit_receipt'),
      canApproveReceipt: can('accounting.receivables.approve_receipt'),
      canPostReceipt: can('accounting.receivables.post_receipt'),
      canReverseReceipt: can('accounting.receivables.reverse_receipt'),
      canAllocate: can('accounting.receivables.allocate_receipt'),
      canReallocate: can('accounting.receivables.reallocate_receipt'),
      canManageCreditNote: can('accounting.receivables.manage_credit_note'),
      canManageDispute: can('accounting.receivables.manage_dispute'),
      canManageCollection: can('accounting.receivables.manage_collection'),
      canManagePromise: can('accounting.receivables.manage_payment_promise'),
      canPreviewReminder: can('accounting.receivables.preview_reminder'),
      canManageCreditHold: can('accounting.receivables.manage_credit_hold'),
      canViewStatement: can('accounting.receivables.view_statement'),
      canExport: can('accounting.receivables.export'),
      canPrint: can('accounting.receivables.print'),
      canViewAudit: can('accounting.receivables.view_audit'),
      canSaveView: can('accounting.receivables.save_view'),
      can,
    }
  }, [user.role])
}
