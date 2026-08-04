import { create } from 'zustand'
import type { ModuleStatus, SecureSession, SessionUserProfile, TenantSummary, AuthUser } from '@/types/api'

export type AuthStatus = 'unknown' | 'signed_out' | 'signed_in' | 'restoring'

interface SessionState {
  status: AuthStatus
  session: SecureSession | null
  profile: SessionUserProfile | null
  authNotice: string | null
  isOnline: boolean
  setOnline: (online: boolean) => void
  setStatus: (status: AuthStatus) => void
  setSession: (session: SecureSession | null) => void
  setProfile: (profile: SessionUserProfile | null) => void
  setAuthNotice: (message: string | null) => void
  consumeAuthNotice: () => string | null
  patchUser: (user: Partial<AuthUser>) => void
  setModules: (modules: ModuleStatus[]) => void
  setTenant: (tenant: TenantSummary | null) => void
  reset: () => void
}

const empty: Pick<
  SessionState,
  'status' | 'session' | 'profile' | 'authNotice' | 'isOnline'
> = {
  status: 'unknown',
  session: null,
  profile: null,
  authNotice: null,
  isOnline: true,
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ...empty,
  setOnline: (isOnline) => set({ isOnline }),
  setStatus: (status) => set({ status }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setAuthNotice: (authNotice) => set({ authNotice }),
  consumeAuthNotice: () => {
    const msg = get().authNotice
    if (msg) set({ authNotice: null })
    return msg
  },
  patchUser: (partial) => {
    const profile = get().profile
    if (!profile) return
    set({
      profile: {
        ...profile,
        user: { ...profile.user, ...partial },
        department: partial.department ?? profile.department,
        permissions: partial.permissions ?? profile.permissions,
        roles: partial.roles ?? profile.roles,
      },
    })
  },
  setModules: (modules) => {
    const profile = get().profile
    if (!profile) return
    set({ profile: { ...profile, modules } })
  },
  setTenant: (tenant) => {
    const profile = get().profile
    if (!profile) return
    set({ profile: { ...profile, tenant } })
  },
  reset: () => set({ ...empty, status: 'signed_out', isOnline: get().isOnline }),
}))
