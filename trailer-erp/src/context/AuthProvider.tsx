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

interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => {
    if (!isApiMode()) return null
    const stored = getStoredSession()
    if (stored) syncSessionUserFromAuth(stored)
    return stored
  })
  const [isLoading, setIsLoading] = useState(isApiMode())

  useEffect(() => {
    return subscribeAuthSession((next) => {
      setSession(next)
      syncSessionUserFromAuth(next)
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
          const next = withAccessExpiry({
            ...current,
            user: { ...current.user, ...res.data },
          })
          setStoredSession(next)
          setSession(next)
          syncSessionUserFromAuth(next)
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
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    syncSessionUserFromAuth(null)
    setSession(null)
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
