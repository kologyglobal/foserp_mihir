/**
 * Bank & Cash Management fine-grained frontend permissions.
 *
 * SECURITY: All permissions must also be enforced by the future backend
 * (tenant isolation + RBAC on every bank/cash read / write / reconcile / export).
 * UI gating alone is not security.
 */

import { useMemo } from 'react'
import { getSessionUser, type ErpRole } from './index'

export const BANK_CASH_PERMISSIONS = [
  'accounting.bank_cash.view',
  'accounting.bank_cash.view_dashboard',
  'accounting.bank_cash.view_bank_account',
  'accounting.bank_cash.manage_bank_account',
  'accounting.bank_cash.view_cash_account',
  'accounting.bank_cash.manage_cash_account',
  'accounting.bank_cash.view_transactions',
  'accounting.bank_cash.view_fund_transfer',
  'accounting.bank_cash.create_fund_transfer',
  'accounting.bank_cash.edit_fund_transfer',
  'accounting.bank_cash.submit_fund_transfer',
  'accounting.bank_cash.approve_fund_transfer',
  'accounting.bank_cash.complete_fund_transfer',
  'accounting.bank_cash.reverse_fund_transfer',
  'accounting.bank_cash.view_statement',
  'accounting.bank_cash.import_statement',
  'accounting.bank_cash.view_reconciliation',
  'accounting.bank_cash.manage_reconciliation',
  'accounting.bank_cash.complete_reconciliation',
  'accounting.bank_cash.reopen_reconciliation',
  'accounting.bank_cash.view_cheques',
  'accounting.bank_cash.manage_cheques',
  'accounting.bank_cash.view_deposits',
  'accounting.bank_cash.create_deposit',
  'accounting.bank_cash.view_cash_book',
  'accounting.bank_cash.view_cash_count',
  'accounting.bank_cash.manage_cash_count',
  'accounting.bank_cash.approve_cash_variance',
  'accounting.bank_cash.post_cash_adjustment',
  'accounting.bank_cash.view_reports',
  'accounting.bank_cash.manage_setup',
  'accounting.bank_cash.export',
  'accounting.bank_cash.print',
  'accounting.bank_cash.view_audit',
] as const

export type BankCashPermission = (typeof BANK_CASH_PERMISSIONS)[number]

const ALL = [...BANK_CASH_PERMISSIONS]

/** Plant accountant — cash operations at plant/site; limited bank access */
const PLANT_ACCOUNTANT: BankCashPermission[] = [
  'accounting.bank_cash.view',
  'accounting.bank_cash.view_dashboard',
  'accounting.bank_cash.view_cash_account',
  'accounting.bank_cash.view_transactions',
  'accounting.bank_cash.view_cash_book',
  'accounting.bank_cash.view_cash_count',
  'accounting.bank_cash.manage_cash_count',
  'accounting.bank_cash.create_deposit',
  'accounting.bank_cash.view_deposits',
  'accounting.bank_cash.view_cheques',
  'accounting.bank_cash.print',
]

/** Accounts executive — day-to-day bank/cash ops; no setup or reversal */
const ACCOUNTS_USER: BankCashPermission[] = [
  'accounting.bank_cash.view',
  'accounting.bank_cash.view_dashboard',
  'accounting.bank_cash.view_bank_account',
  'accounting.bank_cash.view_cash_account',
  'accounting.bank_cash.view_transactions',
  'accounting.bank_cash.view_fund_transfer',
  'accounting.bank_cash.create_fund_transfer',
  'accounting.bank_cash.edit_fund_transfer',
  'accounting.bank_cash.submit_fund_transfer',
  'accounting.bank_cash.view_statement',
  'accounting.bank_cash.import_statement',
  'accounting.bank_cash.view_reconciliation',
  'accounting.bank_cash.manage_reconciliation',
  'accounting.bank_cash.view_cheques',
  'accounting.bank_cash.manage_cheques',
  'accounting.bank_cash.view_deposits',
  'accounting.bank_cash.create_deposit',
  'accounting.bank_cash.view_cash_book',
  'accounting.bank_cash.view_cash_count',
  'accounting.bank_cash.manage_cash_count',
  'accounting.bank_cash.view_reports',
  'accounting.bank_cash.export',
  'accounting.bank_cash.print',
  'accounting.bank_cash.view_audit',
]

/** Senior accountant — approvals, reconciliation completion, cash variance posting */
const ACCOUNTANT: BankCashPermission[] = [
  ...ACCOUNTS_USER,
  'accounting.bank_cash.approve_fund_transfer',
  'accounting.bank_cash.complete_fund_transfer',
  'accounting.bank_cash.complete_reconciliation',
  'accounting.bank_cash.approve_cash_variance',
  'accounting.bank_cash.post_cash_adjustment',
]

const ACCOUNTS_HEAD: BankCashPermission[] = [...ALL]

const AUDITOR: BankCashPermission[] = [
  'accounting.bank_cash.view',
  'accounting.bank_cash.view_dashboard',
  'accounting.bank_cash.view_bank_account',
  'accounting.bank_cash.view_cash_account',
  'accounting.bank_cash.view_transactions',
  'accounting.bank_cash.view_fund_transfer',
  'accounting.bank_cash.view_statement',
  'accounting.bank_cash.view_reconciliation',
  'accounting.bank_cash.view_cheques',
  'accounting.bank_cash.view_deposits',
  'accounting.bank_cash.view_cash_book',
  'accounting.bank_cash.view_cash_count',
  'accounting.bank_cash.view_reports',
  'accounting.bank_cash.export',
  'accounting.bank_cash.print',
  'accounting.bank_cash.view_audit',
]

const DISPATCH_COORD: BankCashPermission[] = [
  'accounting.bank_cash.view',
  'accounting.bank_cash.view_dashboard',
  'accounting.bank_cash.view_cheques',
  'accounting.bank_cash.print',
]

const ROLE_PACKS: Partial<Record<ErpRole, BankCashPermission[]>> = {
  admin: ALL,
  ceo: ALL,
  director: ALL,
  accounts_head: ACCOUNTS_HEAD,
  accounts_user: ACCOUNTANT,
  accounts: ACCOUNTANT,
  management: ALL,
  production_head: PLANT_ACCOUNTANT,
  production_supervisor: PLANT_ACCOUNTANT,
  production: PLANT_ACCOUNTANT,
  shop_floor: ['accounting.bank_cash.view', 'accounting.bank_cash.view_cash_book'],
  store_manager: PLANT_ACCOUNTANT,
  store_user: PLANT_ACCOUNTANT,
  stores: PLANT_ACCOUNTANT,
  dispatch_manager: DISPATCH_COORD,
  dispatch_user: DISPATCH_COORD,
  dispatch: DISPATCH_COORD,
  sales_manager: DISPATCH_COORD,
  sales: DISPATCH_COORD,
  purchase_head: AUDITOR,
  purchase_user: AUDITOR,
  purchase: AUDITOR,
  engineering_head: AUDITOR,
  quality_head: AUDITOR,
  planning_manager: AUDITOR,
}

function resolve(role: ErpRole): Set<BankCashPermission> {
  return new Set(ROLE_PACKS[role] ?? ACCOUNTANT)
}

export function hasBankCashPermission(permission: BankCashPermission, role?: ErpRole): boolean {
  return resolve(role ?? getSessionUser().role).has(permission)
}

export function useBankCashPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set = resolve(user.role)
    const can = (p: BankCashPermission) => set.has(p)
    return {
      role: user.role,
      canView: can('accounting.bank_cash.view'),
      canViewDashboard: can('accounting.bank_cash.view_dashboard'),
      canViewBankAccount: can('accounting.bank_cash.view_bank_account'),
      canManageBankAccount: can('accounting.bank_cash.manage_bank_account'),
      canViewCashAccount: can('accounting.bank_cash.view_cash_account'),
      canManageCashAccount: can('accounting.bank_cash.manage_cash_account'),
      canViewTransactions: can('accounting.bank_cash.view_transactions'),
      canViewFundTransfer: can('accounting.bank_cash.view_fund_transfer'),
      canCreateFundTransfer: can('accounting.bank_cash.create_fund_transfer'),
      canEditFundTransfer: can('accounting.bank_cash.edit_fund_transfer'),
      canSubmitFundTransfer: can('accounting.bank_cash.submit_fund_transfer'),
      canApproveFundTransfer: can('accounting.bank_cash.approve_fund_transfer'),
      canCompleteFundTransfer: can('accounting.bank_cash.complete_fund_transfer'),
      canReverseFundTransfer: can('accounting.bank_cash.reverse_fund_transfer'),
      canViewStatement: can('accounting.bank_cash.view_statement'),
      canImportStatement: can('accounting.bank_cash.import_statement'),
      canViewReconciliation: can('accounting.bank_cash.view_reconciliation'),
      canManageReconciliation: can('accounting.bank_cash.manage_reconciliation'),
      canCompleteReconciliation: can('accounting.bank_cash.complete_reconciliation'),
      canReopenReconciliation: can('accounting.bank_cash.reopen_reconciliation'),
      canViewCheques: can('accounting.bank_cash.view_cheques'),
      canManageCheques: can('accounting.bank_cash.manage_cheques'),
      canViewDeposits: can('accounting.bank_cash.view_deposits'),
      canCreateDeposit: can('accounting.bank_cash.create_deposit'),
      canViewCashBook: can('accounting.bank_cash.view_cash_book'),
      canViewCashCount: can('accounting.bank_cash.view_cash_count'),
      canManageCashCount: can('accounting.bank_cash.manage_cash_count'),
      canApproveCashVariance: can('accounting.bank_cash.approve_cash_variance'),
      canPostCashAdjustment: can('accounting.bank_cash.post_cash_adjustment'),
      canViewReports: can('accounting.bank_cash.view_reports'),
      canManageSetup: can('accounting.bank_cash.manage_setup'),
      canExport: can('accounting.bank_cash.export'),
      canPrint: can('accounting.bank_cash.print'),
      canViewAudit: can('accounting.bank_cash.view_audit'),
      can,
    }
  }, [user.role])
}
