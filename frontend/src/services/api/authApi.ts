import type { AuthSession } from '../api/client'
import { API_CONFIG } from '../../config/apiConfig'
import { setStoredSession, withAccessExpiry } from '../api/client'
import { mapForgotResetErrorMessage, mapLoginErrorMessage } from '../../modules/auth/authMessages'

export async function login(email: string, password: string, tenantSlug?: string): Promise<AuthSession> {
  let res: Response
  try {
    res = await fetch(`${API_CONFIG.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantSlug: tenantSlug ?? API_CONFIG.tenantSlug }),
    })
  } catch {
    throw new Error(
      'Cannot reach the API server. Start the backend on port 5000 and use the same host for frontend (localhost or 127.0.0.1).',
    )
  }
  const body = await res.json().catch(() => ({} as { success?: boolean; message?: string; data?: AuthSession & { expiresIn?: number; user: AuthSession['user'] & { tenantId: string } } }))
  if (!res.ok || !body.success) {
    throw new Error(mapLoginErrorMessage((body as { message?: string }).message ?? 'Login failed', res.status))
  }

  const data = (body as { data: {
    accessToken: string
    refreshToken: string
    expiresIn?: number
    user: AuthSession['user'] & { tenantId: string }
  } }).data

  const session = withAccessExpiry(
    {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tenantId: data.user.tenantId,
      tenantSlug: tenantSlug ?? API_CONFIG.tenantSlug,
      user: {
        id: data.user.id,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
        roles: data.user.roles,
        permissions: data.user.permissions,
      },
    },
    typeof data.expiresIn === 'number' ? data.expiresIn : undefined,
  )
  setStoredSession(session)
  return session
}

export async function logout(): Promise<void> {
  const { getStoredSession } = await import('../api/client')
  const session = getStoredSession()
  if (session) {
    await fetch(`${API_CONFIG.baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => {})
  }
  setStoredSession(null)
}

export async function fetchMe() {
  const { apiRequest } = await import('../api/client')
  return apiRequest<AuthSession['user'] & {
    mobile?: string | null
    designation?: string | null
    department?: string | null
  }>('/auth/me')
}

export async function updateProfile(input: {
  firstName: string
  lastName: string
  mobile?: string | null
  designation?: string | null
}) {
  const { apiRequest, getStoredSession, setStoredSession, withAccessExpiry } = await import('../api/client')
  const res = await apiRequest<{
    id: string
    firstName: string
    lastName: string
    email: string
    mobile?: string | null
    designation?: string | null
    roles: string[]
    permissions: string[]
  }>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  const current = getStoredSession()
  if (current) {
    const next = withAccessExpiry({
      ...current,
      user: {
        ...current.user,
        firstName: res.data.firstName,
        lastName: res.data.lastName,
        email: res.data.email,
        roles: res.data.roles ?? current.user.roles,
        permissions: res.data.permissions ?? current.user.permissions,
      },
    })
    setStoredSession(next)
  }
  return res
}

export async function changePassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  const { apiRequest } = await import('../api/client')
  await apiRequest<null>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function forgotPassword(
  email: string,
  tenantSlug?: string,
): Promise<{ message: string; resetToken?: string }> {
  let res: Response
  try {
    res = await fetch(`${API_CONFIG.baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tenantSlug: tenantSlug ?? API_CONFIG.tenantSlug }),
    })
  } catch {
    throw new Error('Cannot reach the API server. Ensure the backend is running on port 5000.')
  }
  const body = await res.json().catch(() => ({} as { success?: boolean; message?: string; data?: { resetToken?: string } }))
  if (!res.ok || !body.success) {
    throw new Error(mapForgotResetErrorMessage(body.message ?? 'Could not process password reset', res.status))
  }
  return {
    message: body.message ?? 'If the account exists, a password reset link has been sent',
    resetToken: body.data?.resetToken,
  }
}

export async function resetPassword(token: string, password: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API_CONFIG.baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
  } catch {
    throw new Error('Cannot reach the API server. Ensure the backend is running on port 5000.')
  }
  const body = await res.json().catch(() => ({} as { success?: boolean; message?: string }))
  if (!res.ok || !body.success) {
    throw new Error(mapForgotResetErrorMessage(body.message ?? 'Password reset failed', res.status))
  }
}

export async function acceptInvitation(token: string, password: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API_CONFIG.baseUrl}/auth/accept-invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
  } catch {
    throw new Error('Cannot reach the API server. Ensure the backend is running on port 5000.')
  }
  const body = await res.json()
  if (!res.ok || !body.success) {
    throw new Error(body.message ?? 'Could not accept invitation')
  }
}

export interface LoginDirectoryUser {
  id: string
  email: string
  firstName: string
  lastName: string
  designation: string | null
  department: string | null
  status: string
  roles: string[]
}

export interface LoginDirectory {
  tenantSlug: string
  tenantName: string
  users: LoginDirectoryUser[]
}

/** Dev-only: list users for a tenant on the login page (no passwords). */
export async function fetchLoginDirectory(tenantSlug: string): Promise<LoginDirectory> {
  let res: Response
  try {
    const qs = new URLSearchParams({ tenantSlug })
    res = await fetch(`${API_CONFIG.baseUrl}/auth/login-directory?${qs}`)
  } catch {
    throw new Error('Cannot reach the API server. Ensure the backend is running on port 5000.')
  }
  const body = await res.json()
  if (!res.ok || !body.success) {
    throw new Error(body.message ?? 'Could not load tenant users')
  }
  return body.data as LoginDirectory
}
