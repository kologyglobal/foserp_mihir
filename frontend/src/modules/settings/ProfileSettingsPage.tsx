import { useEffect, useState } from 'react'
import { KeyRound, UserRound } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCardSection } from '@/components/erp/card-form'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { useAuth, useOptionalAuth } from '@/context/AuthProvider'
import { isApiMode } from '@/config/apiConfig'
import * as authApi from '@/services/api/authApi'
import { getSessionUser } from '@/utils/permissions'
import { notify } from '@/store/toastStore'
import { ApiError } from '@/services/api/apiErrors'

export function ProfileSettingsPage() {
  const auth = useOptionalAuth()
  const { logout } = useAuth()

  const sessionUser = auth?.session?.user
  const localUser = getSessionUser()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [designation, setDesignation] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingProfile(true)
      try {
        if (isApiMode()) {
          const res = await authApi.fetchMe()
          if (cancelled) return
          setFirstName(res.data.firstName ?? '')
          setLastName(res.data.lastName ?? '')
          setEmail(res.data.email ?? '')
          setMobile(res.data.mobile ?? '')
          setDesignation(res.data.designation ?? '')
        } else {
          const parts = (localUser.name || 'User').split(/\s+/)
          setFirstName(parts[0] ?? '')
          setLastName(parts.slice(1).join(' ') || '')
          setEmail('')
          setMobile('')
          setDesignation(localUser.role ?? '')
        }
      } catch (err) {
        if (!cancelled) {
          notify.error(err instanceof Error ? err.message : 'Could not load profile')
          if (sessionUser) {
            setFirstName(sessionUser.firstName)
            setLastName(sessionUser.lastName)
            setEmail(sessionUser.email)
          }
        }
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [localUser.name, localUser.role, sessionUser])

  const onSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      notify.error('First and last name are required')
      return
    }
    if (!isApiMode()) {
      notify.info('Profile edit is available when API mode is enabled')
      return
    }
    setSavingProfile(true)
    try {
      await authApi.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile: mobile.trim() || null,
        designation: designation.trim() || null,
      })
      notify.success('Profile updated')
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Update failed'
      notify.error(message)
    } finally {
      setSavingProfile(false)
    }
  }

  const onChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      notify.error('Enter current and new password')
      return
    }
    if (newPassword.length < 8) {
      notify.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      notify.error('New password and confirmation do not match')
      return
    }
    if (!isApiMode()) {
      notify.info('Password change is available when API mode is enabled')
      return
    }
    setSavingPassword(true)
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      notify.success('Password changed — please sign in again')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      await logout()
      window.location.assign('/login')
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Password change failed'
      notify.error(message)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Settings"
      title="My Profile"
      description="Update your name, contact details, and password"
      breadcrumbs={[
        { label: 'Settings', to: '/settings' },
        { label: 'My Profile' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/settings/profile"
    >
      <div className="mx-auto max-w-3xl space-y-3">
        <ErpCardSection
          title="Profile"
          subtitle="Visible across the ERP header and audit trail"
          icon={UserRound}
          accent="blue"
          dense
          columns={1}
        >
          {loadingProfile ? (
            <p className="text-[13px] text-erp-muted">Loading profile…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="First name" required>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </FormField>
              <FormField label="Last name" required>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </FormField>
              <FormField label="Email" hint="Contact an administrator to change email">
                <Input value={email} disabled readOnly autoComplete="email" />
              </FormField>
              <FormField label="Mobile">
                <Input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </FormField>
              <FormField label="Designation" className="sm:col-span-2">
                <Input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  autoComplete="organization-title"
                />
              </FormField>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                <ErpButton
                  onClick={() => void onSaveProfile()}
                  disabled={savingProfile || loadingProfile}
                >
                  {savingProfile ? 'Saving…' : 'Save profile'}
                </ErpButton>
              </div>
            </div>
          )}
        </ErpCardSection>

        <ErpCardSection
          title="Change password"
          subtitle="Requires your current password"
          icon={KeyRound}
          accent="amber"
          dense
          columns={1}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Current password" required className="sm:col-span-2">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </FormField>
            <FormField label="New password" required hint="At least 8 characters">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Confirm new password" required>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
              <ErpButton
                variant="secondary"
                onClick={() => void onChangePassword()}
                disabled={savingPassword}
              >
                {savingPassword ? 'Updating…' : 'Update password'}
              </ErpButton>
            </div>
          </div>
        </ErpCardSection>
      </div>
    </OperationalPageShell>
  )
}
