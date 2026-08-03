import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

const KB_SHELL_PERMS = [
  'kb.document.view',
  'kb.search.view',
  'kb.chat.use',
  'kb.copilot.use',
  'kb.insights.view',
  'kb.admin.manage',
] as const

/** Knowledge / OpenKB permission check (API mode JWT; demo open for shell UX). */
export function canKbPermission(permission: string): boolean {
  if (!isApiMode()) {
    return true
  }
  if (hasWorkspaceAdminRole()) return true
  const perms = getStoredSession()?.user.permissions ?? []
  // Platform Super Admin wildcard (same as CRM admin helper).
  if (perms.includes('tenant.manage')) return true
  return perms.includes(permission)
}

export function canAccessKnowledgeShell(): boolean {
  if (!isApiMode()) return true
  if (hasWorkspaceAdminRole()) return true
  const perms = getStoredSession()?.user.permissions ?? []
  if (perms.includes('tenant.manage')) return true
  return KB_SHELL_PERMS.some((p) => perms.includes(p))
}

export function canUseCopilot(): boolean {
  return canKbPermission('kb.copilot.use')
}
