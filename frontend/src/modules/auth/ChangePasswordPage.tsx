import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpButton } from '@/components/erp/ErpButton'
import { isApiMode } from '@/config/apiConfig'
import { useAuth } from '@/context/AuthProvider'
import { changePassword } from '@/services/api/authApi'
import { setAuthNotice } from '@/services/api/client'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const { logout, isAuthenticated } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!isApiMode() || !isAuthenticated) {
      setError('Change password requires API mode with an active signed-in session.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }

    setLoading(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setAuthNotice('Password changed. Please sign in with your new password.')
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Account"
      title="Change password"
      description="Update your sign-in password. Other sessions will be signed out."
      breadcrumbs={[
        { label: 'Home', to: '/home' },
        { label: 'Change password' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/account/change-password"
    >
      <div className="mx-auto max-w-lg">
        {!isApiMode() ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            Demo mode does not use server passwords. Enable <code className="font-mono">VITE_USE_API=true</code> and
            sign in to change your password.
          </p>
        ) : (
          <form
            className="space-y-5 rounded-lg border border-erp-border bg-erp-surface p-5 shadow-erp"
            onSubmit={handleSubmit}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-erp-primary-soft text-erp-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <p className="text-sm text-erp-muted">
                After a successful change you will be signed out so you can sign in with the new password.
              </p>
            </div>

            <PasswordField
              id="current-password"
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggleShow={() => setShowCurrent((v) => !v)}
              autoComplete="current-password"
            />
            <PasswordField
              id="new-password"
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
              autoComplete="new-password"
              minLength={8}
            />
            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
              autoComplete="new-password"
              minLength={8}
            />

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
            ) : null}
            {info ? (
              <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">{info}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <ErpButton type="submit" disabled={loading}>
                {loading ? 'Updating…' : 'Update password'}
              </ErpButton>
              <ErpButton type="button" variant="secondary" disabled={loading} onClick={() => navigate(-1)}>
                Cancel
              </ErpButton>
            </div>
          </form>
        )}
      </div>
    </OperationalPageShell>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  minLength,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  autoComplete: string
  minLength?: number
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-erp-text" htmlFor={id}>
        <Lock className="h-3.5 w-3.5 text-erp-muted" />
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="w-full rounded-lg border border-erp-border bg-white px-3.5 py-2.5 pr-11 text-sm text-erp-text shadow-sm transition focus:border-erp-primary focus:outline-none focus:ring-2 focus:ring-erp-primary/20"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-erp-muted hover:text-erp-text"
          onClick={onToggleShow}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
