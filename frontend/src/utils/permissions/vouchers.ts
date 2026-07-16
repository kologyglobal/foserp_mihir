/**
 * Accounting Vouchers fine-grained frontend permissions.
 *
 * SECURITY: All permissions must also be enforced by the future backend
 * (tenant isolation + RBAC on every voucher mutation / sensitive read).
 * UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const VOUCHER_PERMISSIONS = [
  'accounting.voucher.view',
  'accounting.voucher.create',
  'accounting.voucher.edit',
  'accounting.voucher.delete',
  'accounting.voucher.submit',
  'accounting.voucher.approve',
  'accounting.voucher.reject',
  'accounting.voucher.send_back',
  'accounting.voucher.post',
  'accounting.voucher.reverse',
  'accounting.voucher.cancel',
  'accounting.voucher.import',
  'accounting.voucher.export',
  'accounting.voucher.view_audit',
] as const

export type VoucherPermission = (typeof VOUCHER_PERMISSIONS)[number]

const ALL = [...VOUCHER_PERMISSIONS]

const VIEW_ONLY: VoucherPermission[] = [
  'accounting.voucher.view',
  'accounting.voucher.export',
  'accounting.voucher.view_audit',
]

const ACCOUNTANT: VoucherPermission[] = [
  ...VIEW_ONLY,
  'accounting.voucher.create',
  'accounting.voucher.edit',
  'accounting.voucher.delete',
  'accounting.voucher.submit',
  'accounting.voucher.cancel',
  'accounting.voucher.import',
]

const SENIOR_ACCOUNTANT: VoucherPermission[] = [
  ...ACCOUNTANT,
  'accounting.voucher.approve',
  'accounting.voucher.reject',
  'accounting.voucher.send_back',
  'accounting.voucher.post',
]

const FINANCE_MANAGER: VoucherPermission[] = [...ALL]

const AP_AR_EXEC: VoucherPermission[] = [
  'accounting.voucher.view',
  'accounting.voucher.create',
  'accounting.voucher.edit',
  'accounting.voucher.submit',
  'accounting.voucher.export',
]

const AUDITOR: VoucherPermission[] = VIEW_ONLY

const CFO: VoucherPermission[] = [...ALL]
const ADMIN: VoucherPermission[] = [...ALL]

const ROLE_PACKS: Partial<Record<ErpRole, VoucherPermission[]>> = {
  admin: ADMIN,
  ceo: CFO,
  director: CFO,
  accounts_head: FINANCE_MANAGER,
  accounts_user: ACCOUNTANT,
  accounts: ACCOUNTANT,
  management: CFO,
  purchase_head: AP_AR_EXEC,
  purchase_user: AP_AR_EXEC,
  purchase: AP_AR_EXEC,
  sales_manager: AP_AR_EXEC,
  sales: AP_AR_EXEC,
  planning_manager: AUDITOR,
  planning: AUDITOR,
  production_head: AUDITOR,
  engineering_head: AUDITOR,
  store_manager: AUDITOR,
  quality_head: AUDITOR,
  dispatch_manager: AUDITOR,
}

function resolveVoucherPermissions(role: ErpRole): Set<VoucherPermission> {
  const pack = ROLE_PACKS[role] ?? SENIOR_ACCOUNTANT
  return new Set(pack)
}

export function hasVoucherPermission(permission: VoucherPermission, role?: ErpRole): boolean {
  const effective = role ?? getSessionUser().role
  return resolveVoucherPermissions(effective).has(permission)
}

export function useVoucherPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolveVoucherPermissions(user.role)
    const can = (p: VoucherPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('accounting.voucher.view'),
      canCreate: can('accounting.voucher.create'),
      canEdit: can('accounting.voucher.edit'),
      canDelete: can('accounting.voucher.delete'),
      canSubmit: can('accounting.voucher.submit'),
      canApprove: can('accounting.voucher.approve'),
      canReject: can('accounting.voucher.reject'),
      canSendBack: can('accounting.voucher.send_back'),
      canPost: can('accounting.voucher.post'),
      canReverse: can('accounting.voucher.reverse'),
      canCancel: can('accounting.voucher.cancel'),
      canImport: can('accounting.voucher.import'),
      canExport: can('accounting.voucher.export'),
      canViewAudit: can('accounting.voucher.view_audit'),
      can,
    }
  }, [user.role])
}
