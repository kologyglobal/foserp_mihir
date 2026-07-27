import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Home, LogOut, RefreshCw } from 'lucide-react'
import { Button } from '../ui/Button'
import { useAuth } from '../../context/AuthProvider'

/**
 * Full-screen recovery when CRM/master/admin API hydration fails in AppShell.
 * Must offer Retry, Home, and Sign out — otherwise users are trapped without chrome.
 */
export function ApiHydrationErrorScreen({
  detail,
  looksLikeOffline,
  onContinueHome,
}: {
  detail: string
  looksLikeOffline: boolean
  /** Soft-continue into the shell at home when the user chooses to proceed anyway. */
  onContinueHome: () => void
}) {
  const navigate = useNavigate()
  const { logout, session } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  const email = session?.user?.email

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-erp">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-8 w-8 shrink-0 text-red-600" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold text-erp-text">Could not load application data</h1>
            <p className="mt-1 text-sm text-erp-muted">
              There was an error loading your workspace. You can retry, go back to the home page, or
              sign out and try again later.
            </p>
          </div>
        </div>

        <dl className="mb-5 space-y-2 rounded-lg border border-red-100 bg-red-50/40 p-4 text-sm">
          {email ? (
            <div>
              <dt className="font-medium text-erp-muted">Signed in as</dt>
              <dd className="text-erp-text">{email}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium text-erp-muted">Error</dt>
            <dd className="break-words text-red-800">{detail || 'Unknown error'}</dd>
          </div>
        </dl>

        {looksLikeOffline ? (
          <p className="mb-4 text-left text-xs text-erp-muted">
            API mode needs the backend. Locally run{' '}
            <code className="rounded bg-slate-100 px-1">npm run dev</code> in{' '}
            <code className="rounded bg-slate-100 px-1">backend/</code> (port 5000). On production,
            confirm <code className="rounded bg-slate-100 px-1">/api/v1/health</code> returns JSON,
            not the SPA HTML.
          </p>
        ) : (
          <p className="mb-4 text-left text-xs text-erp-muted">
            If this keeps happening, the database or API may be unavailable. Sign out and contact
            your administrator if the problem continues.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onContinueHome()
              navigate('/', { replace: true })
            }}
          >
            <Home className="h-4 w-4" /> Go to home page
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4" /> {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Slim banner when the user continues into the shell after a hydration failure. */
export function ApiHydrationErrorBanner({
  detail,
  onRetry,
  onDismiss,
}: {
  detail: string
  onRetry: () => void
  onDismiss: () => void
}) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950"
      role="alert"
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Workspace data did not load fully.</span>{' '}
        <span className="text-amber-900/80">{detail}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={signingOut}
          onClick={() => void handleSignOut()}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
