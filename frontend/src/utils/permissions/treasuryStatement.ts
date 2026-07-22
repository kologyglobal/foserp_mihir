/**
 * Phase 5A2 — Treasury bank statement permissions (finance.treasury.statement.*)
 */
import { useMemo } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasBankCashPermission, type BankCashPermission } from './bankCash'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const TREASURY_STATEMENT_PERMISSIONS = [
  'finance.treasury.statement.view',
  'finance.treasury.statement.import',
  'finance.treasury.statement.manual_entry',
  'finance.treasury.statement.edit',
  'finance.treasury.statement.validate',
  'finance.treasury.statement.cancel',
  'finance.treasury.statement.mapping.view',
  'finance.treasury.statement.mapping.manage',
  'finance.treasury.statement.file.download',
] as const

export type TreasuryStatementPermission = (typeof TREASURY_STATEMENT_PERMISSIONS)[number]

const DEMO_ROLE_MAP: Partial<Record<ErpRole, TreasuryStatementPermission[]>> = {
  admin: [...TREASURY_STATEMENT_PERMISSIONS],
  ceo: [...TREASURY_STATEMENT_PERMISSIONS],
  director: [...TREASURY_STATEMENT_PERMISSIONS],
  accounts_head: [...TREASURY_STATEMENT_PERMISSIONS],
  accounts_user: [
    'finance.treasury.statement.view',
    'finance.treasury.statement.import',
    'finance.treasury.statement.manual_entry',
    'finance.treasury.statement.edit',
    'finance.treasury.statement.validate',
    'finance.treasury.statement.mapping.view',
    'finance.treasury.statement.file.download',
  ],
  accounts: [
    'finance.treasury.statement.view',
    'finance.treasury.statement.import',
    'finance.treasury.statement.manual_entry',
    'finance.treasury.statement.edit',
    'finance.treasury.statement.validate',
    'finance.treasury.statement.mapping.view',
    'finance.treasury.statement.file.download',
  ],
}

function resolveDemoPermissions(role: ErpRole): Set<TreasuryStatementPermission> {
  const pack = DEMO_ROLE_MAP[role] ?? ['finance.treasury.statement.view']
  return new Set(pack)
}

function resolveApiPermissions(): Set<TreasuryStatementPermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(perms.filter((p): p is TreasuryStatementPermission => (TREASURY_STATEMENT_PERMISSIONS as readonly string[]).includes(p)))
}

function demoFallback(permission: TreasuryStatementPermission, role: ErpRole): boolean {
  const bankCashMap: Partial<Record<TreasuryStatementPermission, BankCashPermission>> = {
    'finance.treasury.statement.view': 'accounting.bank_cash.view_statement',
    'finance.treasury.statement.import': 'accounting.bank_cash.import_statement',
    'finance.treasury.statement.manual_entry': 'accounting.bank_cash.import_statement',
    'finance.treasury.statement.edit': 'accounting.bank_cash.import_statement',
    'finance.treasury.statement.validate': 'accounting.bank_cash.import_statement',
    'finance.treasury.statement.cancel': 'accounting.bank_cash.import_statement',
    'finance.treasury.statement.mapping.view': 'accounting.bank_cash.view_statement',
    'finance.treasury.statement.mapping.manage': 'accounting.bank_cash.manage_setup',
    'finance.treasury.statement.file.download': 'accounting.bank_cash.export',
  }
  const bc = bankCashMap[permission]
  if (bc) return hasBankCashPermission(bc, role)
  return resolveDemoPermissions(role).has(permission)
}

export function hasTreasuryStatementPermission(permission: TreasuryStatementPermission, role?: ErpRole): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) return resolveApiPermissions().has(permission)
  return demoFallback(permission, role ?? getSessionUser().role)
}

export function mergeAllowedAction(uiPerm: boolean, serverAction?: boolean): boolean {
  if (serverAction === undefined) return uiPerm
  return uiPerm && serverAction
}

export function useTreasuryStatementPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set =
      isApiMode() && hasWorkspaceAdminRole()
        ? new Set<TreasuryStatementPermission>(TREASURY_STATEMENT_PERMISSIONS)
        : isApiMode()
          ? resolveApiPermissions()
          : resolveDemoPermissions(user.role)
    const can = (p: TreasuryStatementPermission) =>
      isApiMode() ? set.has(p) : demoFallback(p, user.role)
    return {
      role: user.role,
      canView: can('finance.treasury.statement.view'),
      canImport: can('finance.treasury.statement.import'),
      canManualEntry: can('finance.treasury.statement.manual_entry'),
      canEdit: can('finance.treasury.statement.edit'),
      canValidate: can('finance.treasury.statement.validate'),
      canCancel: can('finance.treasury.statement.cancel'),
      canViewMapping: can('finance.treasury.statement.mapping.view'),
      canManageMapping: can('finance.treasury.statement.mapping.manage'),
      canDownloadFile: can('finance.treasury.statement.file.download'),
      can,
    }
  }, [user.role])
}
