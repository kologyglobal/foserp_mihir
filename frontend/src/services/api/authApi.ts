import type { AuthSession } from '../api/client'
import { API_CONFIG } from '../../config/apiConfig'
import { setStoredSession, withAccessExpiry } from '../api/client'

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
  const body = await res.json()
  if (!res.ok || !body.success) {
    throw new Error(body.message ?? 'Login failed')
  }

  const session = withAccessExpiry(
    {
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
      tenantId: body.data.user.tenantId,
      tenantSlug: tenantSlug ?? API_CONFIG.tenantSlug,
      user: {
        id: body.data.user.id,
        firstName: body.data.user.firstName,
        lastName: body.data.user.lastName,
        email: body.data.user.email,
        roles: body.data.user.roles,
        permissions: body.data.user.permissions,
      },
    },
    typeof body.data.expiresIn === 'number' ? body.data.expiresIn : undefined,
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
  return apiRequest<AuthSession['user']>('/auth/me')
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
  const body = await res.json()
  if (!res.ok || !body.success) {
    throw new Error(body.message ?? 'Could not process password reset')
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
  const body = await res.json()
  if (!res.ok || !body.success) {
    throw new Error(body.message ?? 'Password reset failed')
  }
}
