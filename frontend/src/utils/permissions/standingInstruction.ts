/** Finance Phase 5B3 — Standing instruction permissions (finance.treasury.standing_instruction.*). */
import { useMemo } from 'react'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { getSessionUser, type ErpRole } from './index'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const STANDING_INSTRUCTION_PERMISSIONS = [
  'finance.treasury.standing_instruction.view',
  'finance.treasury.standing_instruction.manage',
  'finance.treasury.standing_instruction.generate',
] as const
export type StandingInstructionPermission = (typeof STANDING_INSTRUCTION_PERMISSIONS)[number]

const FULL_ACCESS_ROLES: ErpRole[] = ['admin', 'ceo', 'director', 'accounts_head']

function resolveApiPermissions(): Set<StandingInstructionPermission> {
  const perms = getStoredSession()?.user.permissions ?? []
  return new Set(perms.filter((p): p is StandingInstructionPermission => (STANDING_INSTRUCTION_PERMISSIONS as readonly string[]).includes(p)))
}

export function useStandingInstructionPermissions() {
  const user = getSessionUser()
  return useMemo(() => {
    const apiMode = isApiMode()
    const set = apiMode && hasWorkspaceAdminRole()
      ? new Set<StandingInstructionPermission>(STANDING_INSTRUCTION_PERMISSIONS)
      : apiMode
        ? resolveApiPermissions()
        : null
    const can = (p: StandingInstructionPermission): boolean => {
      if (set) return set.has(p)
      if (p === 'finance.treasury.standing_instruction.view') return true
      return FULL_ACCESS_ROLES.includes(user.role)
    }
    return {
      role: user.role,
      canView: can('finance.treasury.standing_instruction.view'),
      canManage: can('finance.treasury.standing_instruction.manage'),
      canGenerate: can('finance.treasury.standing_instruction.generate'),
      can,
    }
  }, [user.role])
}
