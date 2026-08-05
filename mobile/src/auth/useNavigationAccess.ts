import { useMemo } from 'react'
import { useSessionStore } from '@/store/sessionStore'
import {
  authContextFromProfile,
  listAccessibleNavigation,
  listApprovalsNavigation,
  listHomeNavigation,
  listMoreNavigation,
  listWorkNavigation,
  type MobileNavigationEntry,
  type NavigationAuthContext,
  canAccessNavigationEntry,
} from '@/auth/navigationCatalog'

export function useNavigationAuthContext(): NavigationAuthContext {
  const profile = useSessionStore((s) => s.profile)
  return useMemo(() => authContextFromProfile(profile), [profile])
}

export function useNavigationAccess() {
  const ctx = useNavigationAuthContext()
  return useMemo(
    () => ({
      ctx,
      canAccess: (entry: MobileNavigationEntry) => canAccessNavigationEntry(entry, ctx),
      home: listHomeNavigation(ctx),
      work: listWorkNavigation(ctx),
      more: listMoreNavigation(ctx),
      approvals: listApprovalsNavigation(ctx),
      allAccessible: listAccessibleNavigation(undefined, ctx),
    }),
    [ctx],
  )
}
