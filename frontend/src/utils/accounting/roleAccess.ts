import type { AccountingMockRole } from '../../types/accounting'
import { ACCOUNTING_READONLY_ROLES, ACCOUNTING_SETUP_ROLES, ACCOUNTING_APPROVER_ROLES } from '../../types/accounting'

export function canAccessAccountingSetup(role: AccountingMockRole): boolean {
  return ACCOUNTING_SETUP_ROLES.includes(role)
}

export function canApproveVouchers(role: AccountingMockRole): boolean {
  return ACCOUNTING_APPROVER_ROLES.includes(role)
}

export function isAccountingReadOnly(role: AccountingMockRole): boolean {
  return ACCOUNTING_READONLY_ROLES.includes(role)
}
