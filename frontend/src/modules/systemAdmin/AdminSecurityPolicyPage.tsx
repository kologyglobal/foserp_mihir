import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Save } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
  adminBreadcrumbs,
} from '../../components/admin'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { Select } from '../../components/forms/Inputs'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import {
  fetchAdminSecurityPolicyApi,
  updateAdminSecurityPolicyApi,
  type AdminSecurityPolicy,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'

export function AdminSecurityPolicyPage() {
  const canView = canAdminPermission('security.view')
  const canManage = canAdminPermission('security.manage')
  const [policy, setPolicy] = useState<AdminSecurityPolicy | null>(null)
  const [passwordMinLength, setPasswordMinLength] = useState(8)
  const [maxFailedLogins, setMaxFailedLogins] = useState(5)
  const [requireComplexity, setRequireComplexity] = useState(false)
  const [mfaMode, setMfaMode] = useState<'off' | 'optional' | 'required'>('off')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isApiMode()) {
        setPolicy(null)
        return
      }
      const res = await fetchAdminSecurityPolicyApi()
      setPolicy(res.data)
      setPasswordMinLength(res.data.passwordMinLength)
      setMaxFailedLogins(res.data.maxFailedLogins)
      setRequireComplexity(Boolean(res.data.requireComplexity))
      setMfaMode((res.data.mfaMode as 'off' | 'optional' | 'required') || 'off')
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  async function save() {
    if (!canManage) return
    setSaving(true)
    try {
      const res = await updateAdminSecurityPolicyApi({
        passwordMinLength,
        maxFailedLogins,
        requireComplexity,
        mfaMode: mfaMode === 'required' ? 'optional' : mfaMode,
      })
      setPolicy(res.data)
      notify.success('Security policy saved')
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminWorkspaceShell
      title="Security Policy"
      description="Editable password, lockout, and MFA mode for this tenant."
      workspace="security"
      favoritePath="/admin/security/policy"
      breadcrumbs={adminBreadcrumbs({ label: 'Security' }, { label: 'Policy' })}
      pageGuide={{
        purpose: 'Configure password length, complexity, failed-login lockout, and MFA mode.',
        nextStep: 'MFA enrollment is not shipped yet — required mode stays unavailable.',
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'save',
            label: saving ? 'Saving…' : 'Save',
            icon: Save,
            onClick: () => void save(),
            disabled: !canManage || loading || saving || !isApiMode(),
          }}
          secondaryActions={[
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void load(),
              disabled: !canView || loading,
            },
          ]}
        />
      }
    >
      {!canView ? (
        <AdminEmptyState title="No access" description="You need security.view to open security policy." />
      ) : loading ? (
        <AdminSkeleton rows={4} />
      ) : error ? (
        <AdminErrorState title="Could not load policy" description={error} />
      ) : !isApiMode() ? (
        <AdminEmptyState title="API mode required" description="Security policy is stored per tenant on the API." />
      ) : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Min password length" value={passwordMinLength} />
            <AdminSummaryCard label="Max failed logins" value={maxFailedLogins} />
            <AdminSummaryCard label="MFA mode" value={mfaMode} />
          </AdminSummaryStrip>

          <ErpCardSection title="Password">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-erp-muted">Minimum length</span>
                <input
                  type="number"
                  min={8}
                  max={128}
                  className="w-full rounded border border-erp-border bg-erp-surface px-3 py-2"
                  value={passwordMinLength}
                  disabled={!canManage}
                  onChange={(e) => setPasswordMinLength(Number(e.target.value) || 8)}
                />
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input
                  type="checkbox"
                  checked={requireComplexity}
                  disabled={!canManage}
                  onChange={(e) => setRequireComplexity(e.target.checked)}
                />
                Require upper, lower, and digit
              </label>
            </div>
          </ErpCardSection>

          <ErpCardSection title="Lockout">
            <label className="block max-w-xs text-sm">
              <span className="mb-1 block text-erp-muted">Max consecutive failed logins</span>
              <input
                type="number"
                min={3}
                max={50}
                className="w-full rounded border border-erp-border bg-erp-surface px-3 py-2"
                value={maxFailedLogins}
                disabled={!canManage}
                onChange={(e) => setMaxFailedLogins(Number(e.target.value) || 5)}
              />
            </label>
            <p className="mt-2 text-xs text-erp-muted">
              After this many failures the account is BLOCKED. Manage unlocks under{' '}
              <Link to="/admin/security/locked-accounts" className="text-erp-primary hover:underline">
                Locked Accounts
              </Link>
              .
            </p>
          </ErpCardSection>

          <ErpCardSection title="MFA">
            <label className="block max-w-sm text-sm">
              <span className="mb-1 block text-erp-muted">Mode</span>
              <Select
                value={mfaMode === 'required' ? 'optional' : mfaMode}
                disabled={!canManage}
                onChange={(e) => setMfaMode(e.target.value as 'off' | 'optional')}
              >
                <option value="off">Off (not configured)</option>
                <option value="optional">Optional (planned)</option>
              </Select>
            </label>
            <p className="mt-2 text-xs text-erp-muted">
              User MFA enrollment is not available yet. <strong>Required</strong> cannot be enabled.
              {policy?.mfaEnrollmentAvailable === false
                ? ' Enrollment availability flag is false until TOTP ships.'
                : null}
            </p>
          </ErpCardSection>
        </div>
      )}
    </AdminWorkspaceShell>
  )
}
