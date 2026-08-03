import { useSessionStore } from '@/store/sessionStore'

/**
 * Permission engine — UI navigation helper only.
 * Backend RBAC remains the source of truth (always expect 403).
 */

const WILDCARD = 'tenant.manage'

export function can(permission: string, permissions?: string[]): boolean {
  const list = permissions ?? useSessionStore.getState().profile?.permissions ?? []
  if (list.includes(WILDCARD)) return true
  if (list.includes(permission)) return true
  // Soft parent: "crm.lead.*" style not used — exact match only
  return false
}

export function canAny(required: string[], permissions?: string[]): boolean {
  return required.some((p) => can(p, permissions))
}

export function canAll(required: string[], permissions?: string[]): boolean {
  return required.every((p) => can(p, permissions))
}

export function usePermissions() {
  const permissions = useSessionStore((s) => s.profile?.permissions ?? [])
  const roles = useSessionStore((s) => s.profile?.roles ?? [])
  return {
    permissions,
    roles,
    can: (permission: string) => can(permission, permissions),
    canAny: (required: string[]) => canAny(required, permissions),
    canAll: (required: string[]) => canAll(required, permissions),
  }
}
