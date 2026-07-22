/**
 * Finance Phase 5D1 — bank connector permissions (`finance.bank_connector.*`).
 */
import { useMemo } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasBankCashPermission, type BankCashPermission } from './bankCash'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const TREASURY_CONNECTOR_PERMISSIONS = [
  'finance.bank_connector.view',
  'finance.bank_connector.manage',
  'finance.bank_connector.sync',
] as const

export type TreasuryConnectorPermission = (typeof TREASURY_CONNECTOR_PERMISSIONS)[number]

const DEMO_ROLE_MAP: Partial<Record<ErpRole, TreasuryConnectorPermission[]>> = {
  admin: [...TREASURY_CONNECTOR_PERMISSIONS],
  ceo: [...TREASURY_CONNECTOR_PERMISSIONS],
  director: [...TREASURY_CONNECTOR_PERMISSIONS],
  accounts_head: [...TREASURY_CONNECTOR_PERMISSIONS],
  accounts_user: ['finance.bank_connector.view'],
  accounts: ['finance.bank_connector.view'],
}

function resolveApiPermissions(): Set<TreasuryConnectorPermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(
    perms.filter((p): p is TreasuryConnectorPermission =>
      (TREASURY_CONNECTOR_PERMISSIONS as readonly string[]).includes(p),
    ),
  )
}

function demoFallback(permission: TreasuryConnectorPermission, role: ErpRole): boolean {
  const bankCashMap: Partial<Record<TreasuryConnectorPermission, BankCashPermission>> = {
    'finance.bank_connector.view': 'accounting.bank_cash.view',
    'finance.bank_connector.manage': 'accounting.bank_cash.manage_setup',
    'finance.bank_connector.sync': 'accounting.bank_cash.manage_setup',
  }
  const mapped = DEMO_ROLE_MAP[role]
  if (mapped?.includes(permission)) return true
  const bc = bankCashMap[permission]
  if (bc) return hasBankCashPermission(bc, role)
  return false
}

export function useTreasuryConnectorPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const set =
      isApiMode() && hasWorkspaceAdminRole()
        ? new Set(TREASURY_CONNECTOR_PERMISSIONS)
        : isApiMode()
          ? resolveApiPermissions()
          : new Set<TreasuryConnectorPermission>()
    const can = (p: TreasuryConnectorPermission) => (isApiMode() ? set.has(p) : demoFallback(p, user.role))
    return {
      canView: can('finance.bank_connector.view'),
      canManage: can('finance.bank_connector.manage'),
      canSync: can('finance.bank_connector.sync'),
      can,
    }
  }, [user.role])
}
