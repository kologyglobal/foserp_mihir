import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isApiMode } from '../config/apiConfig'
import {
  getStoredSession,
  setStoredSession,
  subscribeAuthSession,
  withAccessExpiry,
  type AuthSession,
} from '../services/api/client'
import * as authApi from '../services/api/authApi'
import { syncSessionUserFromAuth } from '../utils/permissions'
import { useTenantProfileStore, type TenantCompanyProfile } from '../store/tenantProfileStore'

interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function applyTenantFromMe(me: {
  tenant?: {
    name?: string
    slug?: string
    businessType?: 'MANUFACTURING' | 'SERVICES'
    displayTerminology?: Record<string, string>
    companyProfile?: TenantCompanyProfile | null
  }
}): void {
  if (!me.tenant) return
  useTenantProfileStore.getState().setProfile({
    tenantName: me.tenant.name?.trim() || null,
    businessType: me.tenant.businessType,
    displayTerminology: me.tenant.displayTerminology,
    companyProfile: me.tenant.companyProfile ?? undefined,
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => {
    if (!isApiMode()) return null
    const stored = getStoredSession()
    if (stored) {
      syncSessionUserFromAuth(stored)
      if (stored.tenantName) {
        useTenantProfileStore.getState().setProfile({ tenantName: stored.tenantName })
      }
    }
    return stored
  })
  const [isLoading, setIsLoading] = useState(isApiMode())

  useEffect(() => {
    return subscribeAuthSession((next) => {
      setSession(next)
      syncSessionUserFromAuth(next)
      if (next?.tenantName) {
        useTenantProfileStore.getState().setProfile({ tenantName: next.tenantName })
      }
    })
  }, [])

  useEffect(() => {
    if (!isApiMode()) {
      setIsLoading(false)
      return
    }
    const stored = getStoredSession()
    if (stored) {
      syncSessionUserFromAuth(stored)
      authApi
        .fetchMe()
        .then((res) => {
          const current = getStoredSession() ?? stored
          const tenantName = res.data.tenant?.name?.trim() || current.tenantName
          const next = withAccessExpiry({
            ...current,
            tenantSlug: res.data.tenant?.slug?.trim() || current.tenantSlug,
            tenantName,
            user: { ...current.user, ...res.data },
          })
          setStoredSession(next)
          setSession(next)
          syncSessionUserFromAuth(next)
          applyTenantFromMe(res.data)
        })
        .catch(() => {
          setStoredSession(null)
          setSession(null)
          syncSessionUserFromAuth(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      syncSessionUserFromAuth(null)
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string, tenantSlug?: string) => {
    const s = await authApi.login(email, password, tenantSlug)
    syncSessionUserFromAuth(s)
    setSession(s)
    // Warm tenant name for document titles; AppShell hydrate still loads full profile.
    try {
      const me = await authApi.fetchMe()
      const tenantName = me.data.tenant?.name?.trim()
      if (tenantName) {
        const next = withAccessExpiry({
          ...s,
          tenantName,
          tenantSlug: me.data.tenant?.slug ?? s.tenantSlug,
        })
        setStoredSession(next)
        setSession(next)
        applyTenantFromMe(me.data)
      }
    } catch {
      /* ignored — hydrate will retry */
    }
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    syncSessionUserFromAuth(null)
    setSession(null)
    useTenantProfileStore.getState().setProfile({ tenantName: null, companyProfile: null })
  }, [])

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      isLoading,
      login,
      logout,
    }),
    [session, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}
