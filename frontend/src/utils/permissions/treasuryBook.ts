/** Finance Phase 5B3 — Read-only bankbook/cashbook permission (finance.treasury.book.view). */
import { useMemo } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { getSessionUser } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

const PERMISSION = 'finance.treasury.book.view'

export function useTreasuryBookPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const apiMode = isApiMode()
    if (apiMode && hasWorkspaceAdminRole()) return { role: user.role, canView: true }
    if (apiMode) {
      const perms = getStoredSession()?.user.permissions ?? []
      return { role: user.role, canView: perms.includes(PERMISSION) }
    }
    return { role: user.role, canView: true }
  }, [user.role])
}
