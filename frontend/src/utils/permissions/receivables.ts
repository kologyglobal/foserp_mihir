/**
 * Accounts Receivable fine-grained frontend permissions.
 *
 * SECURITY: All permissions must also be enforced by the future backend
 * (tenant isolation + RBAC on every receivables read / write / post / export).
 * UI gating alone is not security.
 */

import { useMemo } from 'react'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

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

/**
 * Phase 8C Wave 1 (8B-R-011): in API mode, resolve the legacy `accounting.receivables.*`
 * capability surface from the authoritative JWT `finance.ar.*` grants. Capabilities whose
 * live backend lands in a later wave (dispute → W5, collection/promise/reminder/credit hold
 * → W6) resolve to false until that wave ships. Never falls back to demo role packs.
 */
function resolveApiReceivablesPermissions(): Set<ReceivablesPermission> {
  if (hasWorkspaceAdminRole()) return new Set(RECEIVABLES_PERMISSIONS)
  const jwt = new Set(getStoredSession()?.user.permissions ?? [])
  const ar = (key: string) => jwt.has(key)
  const canView = ar('finance.ar.view') || ar('finance.ar.invoice.view')
  const granted: ReceivablesPermission[] = []
  const grant = (perm: ReceivablesPermission, ok: boolean) => {
    if (ok) granted.push(perm)
  }
  grant('accounting.receivables.view', canView)
  grant('accounting.receivables.view_customer', canView)
  grant('accounting.receivables.view_invoice', ar('finance.ar.invoice.view') || canView)
  grant('accounting.receivables.view_ageing', canView)
  grant('accounting.receivables.view_collection', canView)
  grant('accounting.receivables.view_statement', canView)
  grant('accounting.receivables.export', canView)
  grant('accounting.receivables.print', canView)
  grant('accounting.receivables.view_audit', canView)
  grant('accounting.receivables.save_view', canView)
  grant('accounting.receivables.create_receipt', ar('finance.ar.receipt.create'))
  grant('accounting.receivables.edit_receipt', ar('finance.ar.receipt.edit'))
  grant('accounting.receivables.submit_receipt', ar('finance.ar.receipt.edit'))
  grant('accounting.receivables.approve_receipt', ar('finance.ar.receipt.post'))
  grant('accounting.receivables.post_receipt', ar('finance.ar.receipt.post'))
  grant('accounting.receivables.reverse_receipt', ar('finance.ar.receipt.reverse'))
  grant('accounting.receivables.allocate_receipt', ar('finance.ar.allocation.create'))
  grant('accounting.receivables.reallocate_receipt', ar('finance.ar.allocation.reverse'))
  grant(
    'accounting.receivables.manage_credit_note',
    ar('finance.ar.credit_note.create') || ar('finance.ar.credit_note.edit') || ar('finance.ar.credit_note.post'),
  )
  grant(
    'accounting.receivables.manage_dispute',
    ar('finance.ar.dispute.create') || ar('finance.ar.dispute.edit') || ar('finance.ar.dispute.view'),
  )
  // Not yet live in API mode (future waves): collection / promise / reminder / credit hold.
  return new Set(granted)
}

function resolvePermissions(role: ErpRole): Set<ReceivablesPermission> {
  return isApiMode() ? resolveApiReceivablesPermissions() : resolve(role)
}

export function hasReceivablesPermission(permission: ReceivablesPermission, role?: ErpRole): boolean {
  return resolvePermissions(role ?? getSessionUser().role).has(permission)
}

export function useReceivablesPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolvePermissions(user.role)
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
