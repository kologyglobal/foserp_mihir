import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '@/context/AuthProvider'
import { API_CONFIG } from '@/config/apiConfig'
import { forgotPassword } from '@/services/api/authApi'
import { consumeAuthNotice } from '@/services/api/client'
import { mapLoginErrorMessage } from '@/modules/auth/authMessages'

const REMEMBER_KEY = 'fos_erp_login_remember'
const KOLOGY_LOGO = '/brand/kology-logo.webp'

type LoginView = 'signin' | 'forgot' | 'reset' | 'accept-invite'

interface RememberedLogin {
  email: string
  tenantSlug: string
}

function loadRemembered(): RememberedLogin | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RememberedLogin
    if (parsed.email && parsed.tenantSlug) return parsed
  } catch {
    /* ignore */
  }
  return null
}

function saveRemembered(data: RememberedLogin | null) {
  if (data) {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(REMEMBER_KEY)
  }
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const inviteFromUrl = searchParams.get('invite') ?? ''
  const fromRaw = (location.state as { from?: string } | null)?.from ?? '/crm'
  const from = fromRaw.startsWith('/') && !fromRaw.startsWith('//') ? fromRaw : '/crm'

  const remembered = loadRemembered()
  const [view, setView] = useState<LoginView>(inviteFromUrl ? 'accept-invite' : 'signin')
  const [email, setEmail] = useState(remembered?.email ?? '')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetToken, setResetToken] = useState(inviteFromUrl)
  const [tenantSlug, setTenantSlug] = useState(remembered?.tenantSlug ?? API_CONFIG.tenantSlug)
  const [rememberMe, setRememberMe] = useState(Boolean(remembered))
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = 'Sign in — Kology'
    const notice = consumeAuthNotice()
    if (notice) setInfo(notice)
  }, [])

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      await login(email, password, tenantSlug)
      if (rememberMe) {
        saveRemembered({ email, tenantSlug })
      } else {
        saveRemembered(null)
      }
      navigate(from, { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(mapLoginErrorMessage(message))
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const result = await forgotPassword(email, tenantSlug)
      setInfo(result.message)
      if (result.resetToken) {
        setResetToken(result.resetToken)
        setView('reset')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset link')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const { resetPassword } = await import('@/services/api/authApi')
      await resetPassword(resetToken, newPassword)
      setInfo('Password updated. Sign in with your new password.')
      setPassword('')
      setNewPassword('')
      setResetToken('')
      setView('signin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleAcceptInvitation(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const { acceptInvitation } = await import('@/services/api/authApi')
      await acceptInvitation(resetToken, newPassword)
      setInfo('Invitation accepted. Sign in with your new password.')
      setPassword('')
      setNewPassword('')
      setResetToken('')
      setView('signin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left — Kology brand panel */}
      <aside className="login-brand-panel relative hidden w-[48%] overflow-hidden px-12 py-10 text-white lg:grid xl:px-16">
        <div className="login-brand-panel__glow login-brand-panel__glow--top" aria-hidden />
        <div className="login-brand-panel__glow login-brand-panel__glow--bottom" aria-hidden />
        <div className="login-brand-panel__grid" aria-hidden />

        <header className="login-brand-panel__header relative z-10">
          <div className="login-brand-panel__brand">
            <img
              src={KOLOGY_LOGO}
              alt="Kology"
              className="login-brand-panel__logo-mark"
            />
          </div>
          <p className="login-brand-panel__tagline">Connect · Communicate · Collaborate</p>
          <div className="login-brand-panel__rule" aria-hidden />
        </header>

        <div className="login-brand-panel__copy relative z-10 flex flex-col justify-center">
          <div className="login-brand-panel__intro">
            <h1 className="login-brand-panel__headline">
              <span className="login-brand-panel__headline-lead">Welcome to</span>
              <span className="login-brand-panel__headline-brand">Kology ERP</span>
            </h1>
            <div className="login-brand-panel__powered-by">
              <span className="login-brand-panel__powered-by-accent" aria-hidden />
              <p className="login-brand-panel__powered-by-text">
                Smarter outreach. Stronger pipeline. Measurable growth.
              </p>
            </div>
          </div>

          <div className="login-brand-panel__body" aria-label="Platform overview">
            <p className="login-brand-panel__copy-text">
              Run CRM, sales, operations, and finance from one secure workspace built for
              revenue teams that connect, communicate, and collaborate.
            </p>
            <p className="login-brand-panel__copy-text login-brand-panel__copy-text--continued">
              Kology brings clarity across leads, opportunities, and delivery—so your team
              works faster together and grows with confidence.
            </p>
          </div>

          <p className="login-brand-panel__closer">
            <span className="login-brand-panel__closer-bar" aria-hidden />
            Grow revenue with proven systems.
          </p>
        </div>

        <footer className="login-brand-panel__footer relative z-10">
          <div className="login-brand-panel__footer-divider" aria-hidden />
          <p className="login-brand-panel__footer-tagline">
            <span className="login-brand-panel__footer-sanskrit">kology.co</span>
            <span className="login-brand-panel__footer-sep" aria-hidden>
              —
            </span>
            <span className="login-brand-panel__footer-english">Connect. Communicate. Collaborate.</span>
          </p>
          <p className="login-brand-panel__footer-copy">
            © {new Date().getFullYear()} Kology. All rights reserved.
          </p>
        </footer>
      </aside>

      {/* Right — sign-in panel */}
      <main className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 xl:px-20">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <img
              src={KOLOGY_LOGO}
              alt="Kology"
              className="h-12 w-auto max-w-[200px] rounded-md object-contain object-left"
            />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-erp-text">
              {view === 'signin' && 'Welcome back'}
              {view === 'forgot' && 'Reset your password'}
              {view === 'reset' && 'Choose a new password'}
              {view === 'accept-invite' && 'Accept your invitation'}
            </h2>
            <p className="mt-2 text-sm text-erp-muted">
              {view === 'signin' &&
                (fromRaw !== '/crm'
                  ? 'Sign in to continue to the page you requested.'
                  : 'Sign in to your organization workspace')}
              {view === 'forgot' &&
                'Enter your organization and work email. If an account exists, reset instructions will be provided (development may show a reset token when email delivery is not configured).'}
              {view === 'reset' && 'Enter the token from your email (or the development token) and a new password'}
              {view === 'accept-invite' && 'Set a password to activate your workspace account'}
            </p>
          </div>

          {view === 'signin' && (
            <form className="space-y-5" onSubmit={handleSignIn}>
              <Field label="Organization" htmlFor="tenantSlug" icon={Building2}>
                <input
                  id="tenantSlug"
                  className={inputClass}
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="vasant-trailers"
                  required
                  autoComplete="organization"
                />
              </Field>

              <Field label="Work email" htmlFor="email" icon={Mail}>
                <input
                  id="email"
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </Field>

              <Field label="Password" htmlFor="password" icon={Lock}>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`${inputClass} pr-11`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-erp-muted hover:text-erp-text"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-erp-text">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-erp-border text-erp-primary focus:ring-erp-primary"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="text-sm font-medium text-erp-primary hover:underline"
                  onClick={() => {
                    setError(null)
                    setInfo(null)
                    setView('forgot')
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {error && <Alert tone="error">{error}</Alert>}
              {info && <Alert tone="info">{info}</Alert>}

              <button type="submit" disabled={loading} className={primaryBtnClass}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {view === 'forgot' && (
            <form className="space-y-5" onSubmit={handleForgotPassword}>
              <Field label="Organization" htmlFor="forgot-tenant" icon={Building2}>
                <input
                  id="forgot-tenant"
                  className={inputClass}
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  required
                />
              </Field>
              <Field label="Work email" htmlFor="forgot-email" icon={Mail}>
                <input
                  id="forgot-email"
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </Field>

              {error && <Alert tone="error">{error}</Alert>}
              {info && <Alert tone="info">{info}</Alert>}

              <button type="submit" disabled={loading} className={primaryBtnClass}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <button
                type="button"
                className="w-full text-sm font-medium text-erp-primary hover:underline"
                onClick={() => {
                  setError(null)
                  setInfo(null)
                  setView('signin')
                }}
              >
                Back to sign in
              </button>
            </form>
          )}

          {view === 'reset' && (
            <form className="space-y-5" onSubmit={handleResetPassword}>
              <Field label="Reset token" htmlFor="reset-token">
                <input
                  id="reset-token"
                  className={inputClass}
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  required
                />
              </Field>
              <Field label="New password" htmlFor="new-password" icon={Lock}>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    className={`${inputClass} pr-11`}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-erp-muted hover:text-erp-text"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {error && <Alert tone="error">{error}</Alert>}
              {info && <Alert tone="info">{info}</Alert>}

              <button type="submit" disabled={loading} className={primaryBtnClass}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
              <button
                type="button"
                className="w-full text-sm font-medium text-erp-primary hover:underline"
                onClick={() => {
                  setError(null)
                  setInfo(null)
                  setView('signin')
                }}
              >
                Back to sign in
              </button>
            </form>
          )}

          {view === 'accept-invite' && (
            <form className="space-y-5" onSubmit={handleAcceptInvitation}>
              <Field label="Invitation token" htmlFor="invite-token">
                <input
                  id="invite-token"
                  className={inputClass}
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  required
                />
              </Field>
              <Field label="Choose password" htmlFor="invite-password" icon={Lock}>
                <div className="relative">
                  <input
                    id="invite-password"
                    type={showNewPassword ? 'text' : 'password'}
                    className={`${inputClass} pr-11`}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-erp-muted hover:text-erp-text"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              {error && <Alert tone="error">{error}</Alert>}
              {info && <Alert tone="info">{info}</Alert>}

              <button type="submit" disabled={loading} className={primaryBtnClass}>
                {loading ? 'Activating…' : 'Accept invitation'}
              </button>
              <button
                type="button"
                className="w-full text-sm font-medium text-erp-primary hover:underline"
                onClick={() => {
                  setError(null)
                  setInfo(null)
                  setView('signin')
                }}
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  icon: Icon,
  children,
}: {
  label: string
  htmlFor: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-erp-text" htmlFor={htmlFor}>
        {Icon && <Icon className="h-3.5 w-3.5 text-erp-muted" />}
        {label}
      </label>
      {children}
    </div>
  )
}

function Alert({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-blue-200 bg-blue-50 text-blue-800'
  return <p className={`rounded-lg border px-3 py-2.5 text-sm ${cls}`}>{children}</p>
}

const inputClass =
  'w-full rounded-lg border border-erp-border bg-white px-3.5 py-2.5 text-sm text-erp-text shadow-sm transition focus:border-erp-primary focus:outline-none focus:ring-2 focus:ring-erp-primary/20'

const primaryBtnClass =
  'w-full rounded-lg bg-erp-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60'
