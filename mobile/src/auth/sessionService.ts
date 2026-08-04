import { fetchMe, fetchModuleFlags } from '@/api/authApi'
import {
  apiClient,
  bindSessionAccessor,
  loginRequest,
  logoutRequest,
  tenantPath,
} from '@/api/client'
import { ApiError } from '@/api/errors'
import {
  clearAllSecureKeys,
  clearRememberPrefs,
  clearSecureSession,
  loadRememberPrefs,
  loadSecureSession,
  saveRememberPrefs,
  saveSecureSession,
} from '@/auth/secureStorage'
import { useSessionStore } from '@/store/sessionStore'
import type { AuthMe, ModuleStatus, SecureSession, SessionUserProfile } from '@/types/api'
import { clearAllOfflineDrafts } from '@/features/crm/offlineDrafts'

function buildProfile(me: AuthMe, modules: ModuleStatus[]): SessionUserProfile {
  return {
    user: me,
    tenant: me.tenant,
    permissions: me.permissions ?? [],
    roles: me.roles ?? [],
    modules,
    branchName: null,
    legalEntityName: null,
    department: me.department ?? null,
    employeeCode: me.id.slice(0, 8).toUpperCase(),
    photoUrl: null,
  }
}

function mapModules(raw: ModuleStatus[]): ModuleStatus[] {
  return raw.map((m) => ({
    key: m.key,
    name: m.name,
    description: m.description,
    enabled: m.enabled !== false,
    alwaysOn: m.alwaysOn,
    dependsOn: m.dependsOn,
  }))
}

export function initApiSessionBridge(): void {
  bindSessionAccessor({
    getSession: () => useSessionStore.getState().session,
    setSession: async (session) => {
      useSessionStore.getState().setSession(session)
      if (session?.accessToken && session.refreshToken) {
        await saveSecureSession(session)
      } else if (!session) {
        await clearSecureSession()
      }
    },
    onSessionExpired: (message) => {
      useSessionStore.getState().setAuthNotice(message)
      useSessionStore.getState().reset()
    },
  })
}

async function hydrateUserContext(tenantSlug: string): Promise<SessionUserProfile> {
  const me = await fetchMe()
  let modules: ModuleStatus[] = []
  try {
    modules = mapModules(await fetchModuleFlags(tenantSlug))
  } catch {
    modules = []
  }
  return buildProfile(me, modules)
}

export async function restoreSession(): Promise<void> {
  const store = useSessionStore.getState()
  store.setStatus('restoring')
  try {
    const saved = await loadSecureSession()
    if (!saved) {
      store.reset()
      return
    }
    store.setSession(saved)
    const profile = await hydrateUserContext(saved.tenantSlug)
    if (profile.user.status && profile.user.status !== 'ACTIVE') {
      await clearAllSecureKeys({ keepRemember: true })
      store.setAuthNotice('This account is inactive. Contact your administrator.')
      store.reset()
      return
    }
    store.setProfile(profile)
    store.setStatus('signed_in')
  } catch (error) {
    await clearSecureSession()
    const message =
      error instanceof ApiError && (error.kind === 'session_expired' || error.status === 401)
        ? error.message
        : 'Session expired. Please sign in again.'
    store.setAuthNotice(message)
    store.reset()
  }
}

export async function login(input: {
  tenantSlug: string
  email: string
  password: string
  rememberLogin: boolean
}): Promise<void> {
  const data = await loginRequest({
    tenantSlug: input.tenantSlug.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
  })

  if (data.user.status && data.user.status !== 'ACTIVE') {
    throw new ApiError('This account is inactive. Contact your administrator.', {
      status: 403,
      kind: 'account_disabled',
    })
  }

  const session: SecureSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessTokenExpiresAt: Date.now() + (data.expiresIn || 15 * 60 * 1000),
    tenantId: data.user.tenantId,
    tenantSlug: input.tenantSlug.trim(),
    rememberLogin: input.rememberLogin,
    rememberedEmail: input.rememberLogin ? input.email.trim().toLowerCase() : undefined,
  }

  await saveSecureSession(session)
  if (!input.rememberLogin) {
    await clearRememberPrefs()
  }

  useSessionStore.getState().setSession(session)

  try {
    const profile = await hydrateUserContext(session.tenantSlug)
    useSessionStore.getState().setProfile(profile)
    useSessionStore.getState().setStatus('signed_in')
    useSessionStore.getState().setAuthNotice(null)
  } catch (error) {
    await clearSecureSession()
    useSessionStore.getState().reset()
    throw error
  }
}

export async function logout(): Promise<void> {
  const session = useSessionStore.getState().session
  if (session?.refreshToken) {
    await logoutRequest(session.refreshToken)
  } else {
    await logoutRequest()
  }

  const keepRemember = Boolean(session?.rememberLogin)
  if (keepRemember && session) {
    await saveRememberPrefs({
      tenantSlug: session.tenantSlug,
      email: session.rememberedEmail,
      rememberLogin: true,
    })
  }

  // Security: never keep offline CRM drafts after logout / tenant leave
  try {
    await clearAllOfflineDrafts()
  } catch {
    // ignore
  }

  await clearAllSecureKeys({ keepRemember })
  useSessionStore.getState().reset()
}

/**
 * Multi-tenant switch in M1: end session and prompt re-login with optional prefilled slug.
 */
export async function prepareTenantSwitch(nextTenantSlug?: string): Promise<void> {
  const session = useSessionStore.getState().session
  if (session?.refreshToken) {
    await logoutRequest(session.refreshToken)
  }
  try {
    await clearAllOfflineDrafts()
  } catch {
    // ignore
  }
  await clearSecureSession()
  if (nextTenantSlug) {
    await saveRememberPrefs({
      tenantSlug: nextTenantSlug,
      rememberLogin: true,
    })
    useSessionStore.getState().setAuthNotice(`Sign in to organisation “${nextTenantSlug}”.`)
  }
  useSessionStore.getState().reset()
}

export async function getLoginPrefill(): Promise<{
  tenantSlug?: string
  email?: string
  rememberLogin: boolean
}> {
  const remember = await loadRememberPrefs()
  if (remember) {
    return {
      tenantSlug: remember.tenantSlug,
      email: remember.email,
      rememberLogin: remember.rememberLogin,
    }
  }
  return { rememberLogin: true }
}

export async function reloadCurrentUser(): Promise<void> {
  const session = useSessionStore.getState().session
  if (!session?.tenantSlug) return
  const profile = await hydrateUserContext(session.tenantSlug)
  useSessionStore.getState().setProfile(profile)
}

export { apiClient, tenantPath }
