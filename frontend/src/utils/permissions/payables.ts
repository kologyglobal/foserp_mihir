/**
 * Accounts Payable fine-grained frontend permissions.
 *
 * SECURITY: All permissions must also be enforced by the future backend
 * (tenant isolation + RBAC on every payables read / write / post / export).
 * UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const PAYABLES_PERMISSIONS = [
  'accounting.payables.view',
  'accounting.payables.view_vendor',
  'accounting.payables.view_invoice',
  'accounting.payables.view_ageing',
  'accounting.payables.view_payment_planning',
  'accounting.payables.create_payment_proposal',
  'accounting.payables.submit_payment_proposal',
  'accounting.payables.approve_payment_proposal',
  'accounting.payables.create_payment',
  'accounting.payables.edit_payment',
  'accounting.payables.submit_payment',
  'accounting.payables.approve_payment',
  'accounting.payables.post_payment',
  'accounting.payables.reverse_payment',
  'accounting.payables.allocate_payment',
  'accounting.payables.reallocate_payment',
  'accounting.payables.apply_advance',
  'accounting.payables.apply_debit_note',
  'accounting.payables.manage_dispute',
  'accounting.payables.manage_payment_hold',
  'accounting.payables.view_bank_details',
  'accounting.payables.verify_bank_details',
  'accounting.payables.view_tds',
  'accounting.payables.view_statement',
  'accounting.payables.view_reports',
  'accounting.payables.manage_setup',
  'accounting.payables.export',
  'accounting.payables.print',
  'accounting.payables.view_audit',
] as const

export type PayablesPermission = (typeof PAYABLES_PERMISSIONS)[number]

const ALL = [...PAYABLES_PERMISSIONS]

/** AP clerk — payments, proposals, allocations; no reverse or proposal approval */
const ACCOUNTS_USER: PayablesPermission[] = [
  'accounting.payables.view',
  'accounting.payables.view_vendor',
  'accounting.payables.view_invoice',
  'accounting.payables.view_ageing',
  'accounting.payables.view_payment_planning',
  'accounting.payables.create_payment_proposal',
  'accounting.payables.submit_payment_proposal',
  'accounting.payables.create_payment',
  'accounting.payables.edit_payment',
  'accounting.payables.submit_payment',
  'accounting.payables.approve_payment',
  'accounting.payables.post_payment',
  'accounting.payables.allocate_payment',
  'accounting.payables.apply_advance',
  'accounting.payables.apply_debit_note',
  'accounting.payables.manage_dispute',
  'accounting.payables.manage_payment_hold',
  'accounting.payables.view_bank_details',
  'accounting.payables.view_tds',
  'accounting.payables.view_statement',
  'accounting.payables.view_reports',
  'accounting.payables.export',
  'accounting.payables.print',
  'accounting.payables.view_audit',
]

const ACCOUNTS_HEAD: PayablesPermission[] = [...ALL]

const AUDITOR: PayablesPermission[] = [
  'accounting.payables.view',
  'accounting.payables.view_vendor',
  'accounting.payables.view_invoice',
  'accounting.payables.view_ageing',
  'accounting.payables.view_payment_planning',
  'accounting.payables.view_bank_details',
  'accounting.payables.view_tds',
  'accounting.payables.view_statement',
  'accounting.payables.view_reports',
  'accounting.payables.export',
  'accounting.payables.print',
  'accounting.payables.view_audit',
]

const PURCHASE_COORD: PayablesPermission[] = [
  'accounting.payables.view',
  'accounting.payables.view_vendor',
  'accounting.payables.view_invoice',
  'accounting.payables.manage_dispute',
  'accounting.payables.print',
]

const ROLE_PACKS: Partial<Record<ErpRole, PayablesPermission[]>> = {
  admin: ACCOUNTS_HEAD,
  ceo: ACCOUNTS_HEAD,
  director: ACCOUNTS_HEAD,
  accounts_head: ACCOUNTS_HEAD,
  accounts_user: ACCOUNTS_USER,
  accounts: ACCOUNTS_USER,
  management: ACCOUNTS_HEAD,
  purchase_head: [...PURCHASE_COORD, 'accounting.payables.view_ageing', 'accounting.payables.export', 'accounting.payables.view_reports'],
  purchase_user: PURCHASE_COORD,
  purchase: PURCHASE_COORD,
  engineering_head: AUDITOR,
  quality_head: [...PURCHASE_COORD, 'accounting.payables.view_audit', 'accounting.payables.manage_dispute'],
  dispatch_manager: AUDITOR,
  planning_manager: AUDITOR,
}

function resolve(role: ErpRole): Set<PayablesPermission> {
  return new Set(ROLE_PACKS[role] ?? ACCOUNTS_USER)
}

export function hasPayablesPermission(permission: PayablesPermission, role?: ErpRole): boolean {
  return resolve(role ?? getSessionUser().role).has(permission)
}

export function usePayablesPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolve(user.role)
    const can = (p: PayablesPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('accounting.payables.view'),
      canViewVendor: can('accounting.payables.view_vendor'),
      canViewInvoice: can('accounting.payables.view_invoice'),
      canViewAgeing: can('accounting.payables.view_ageing'),
      canViewPaymentPlanning: can('accounting.payables.view_payment_planning'),
      canCreatePaymentProposal: can('accounting.payables.create_payment_proposal'),
      canSubmitPaymentProposal: can('accounting.payables.submit_payment_proposal'),
      canApprovePaymentProposal: can('accounting.payables.approve_payment_proposal'),
      canCreatePayment: can('accounting.payables.create_payment'),
      canEditPayment: can('accounting.payables.edit_payment'),
      canSubmitPayment: can('accounting.payables.submit_payment'),
      canApprovePayment: can('accounting.payables.approve_payment'),
      canPostPayment: can('accounting.payables.post_payment'),
      canReversePayment: can('accounting.payables.reverse_payment'),
      canAllocatePayment: can('accounting.payables.allocate_payment'),
      canReallocatePayment: can('accounting.payables.reallocate_payment'),
      canApplyAdvance: can('accounting.payables.apply_advance'),
      canApplyDebitNote: can('accounting.payables.apply_debit_note'),
      canManageDispute: can('accounting.payables.manage_dispute'),
      canManagePaymentHold: can('accounting.payables.manage_payment_hold'),
      canViewBankDetails: can('accounting.payables.view_bank_details'),
      canVerifyBankDetails: can('accounting.payables.verify_bank_details'),
      canViewTds: can('accounting.payables.view_tds'),
      canViewStatement: can('accounting.payables.view_statement'),
      canViewReports: can('accounting.payables.view_reports'),
      canManageSetup: can('accounting.payables.manage_setup'),
      canExport: can('accounting.payables.export'),
      canPrint: can('accounting.payables.print'),
      canViewAudit: can('accounting.payables.view_audit'),
      /** @deprecated use canViewPaymentPlanning */
      canViewPlanning: can('accounting.payables.view_payment_planning'),
      /** @deprecated use canCreatePaymentProposal */
      canManageProposal: can('accounting.payables.create_payment_proposal'),
      /** @deprecated use canApprovePaymentProposal */
      canApproveProposal: can('accounting.payables.approve_payment_proposal'),
      /** @deprecated use canApplyAdvance */
      canManageAdvance: can('accounting.payables.apply_advance'),
      /** @deprecated use canApplyDebitNote */
      canManageDebitNote: can('accounting.payables.apply_debit_note'),
      can,
    }
  }, [user.role])
}
