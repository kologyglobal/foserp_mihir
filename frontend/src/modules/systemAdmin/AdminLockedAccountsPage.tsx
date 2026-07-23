import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
  AdminUserStatusBadge,
  adminBreadcrumbs,
} from '../../components/admin'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import {
  fetchAdminLockedAccountsApi,
  unlockAdminUserApi,
  type AdminLockedAccount,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import { appConfirm } from '../../store/confirmDialogStore'

export function AdminLockedAccountsPage() {
  const canView = canAdminPermission('security.view') || canAdminPermission('user.view')
  const canManage = canAdminPermission('security.manage')
  const [rows, setRows] = useState<AdminLockedAccount[]>([])
  const [maxFailed, setMaxFailed] = useState(5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isApiMode()) {
        setRows([])
        return
      }
      const res = await fetchAdminLockedAccountsApi()
      setRows(res.data.items)
      setMaxFailed(res.data.policy.maxFailedLogins)
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

  async function unlock(row: AdminLockedAccount) {
    if (!canManage) return
    const ok = await appConfirm({
      title: 'Unlock account?',
      description: `${row.firstName} ${row.lastName} will be set ACTIVE and failed-login counter cleared.`,
    })
    if (!ok) return
    setBusyId(row.id)
    try {
      await unlockAdminUserApi(row.id)
      notify.success('Account unlocked')
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminWorkspaceShell
      title="Locked Accounts"
      description={`Users with status BLOCKED (admin lock or ${maxFailed}+ failed logins). Unlock restores ACTIVE.`}
      workspace="security"
      favoritePath="/admin/security/locked-accounts"
      breadcrumbs={adminBreadcrumbs({ label: 'Security' }, { label: 'Locked Accounts' })}
      pageGuide={{
        purpose: 'Blocked users from admin lock or failed-login lockout.',
        nextStep: 'Unlock to restore ACTIVE and clear the failure counter. Policy defaults are read-only.',
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'refresh',
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => void load(),
            disabled: !canView || loading,
          }}
        />
      }
    >
      {!canView ? (
        <AdminEmptyState title="No access" description="You need security.view to list locked accounts." />
      ) : loading ? (
        <AdminSkeleton rows={4} />
      ) : error ? (
        <AdminErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Locked" value={rows.length} accent="red" />
            <AdminSummaryCard label="Max failed logins" value={maxFailed} />
          </AdminSummaryStrip>

          <ErpCardSection title="Security policy (read-only)">
            <ul className="space-y-1 text-sm text-erp-muted">
              <li>Auto-lock after {maxFailed} consecutive failed sign-ins.</li>
              <li>Password minimum length: 8 characters (code default).</li>
              <li>MFA: not configured.</li>
            </ul>
            <p className="mt-2 text-xs text-erp-muted">
              Editable password policy / MFA settings are deferred. See{' '}
              <Link to="/admin/security/audit" className="text-erp-primary hover:underline">
                Admin Audit
              </Link>{' '}
              for IAM change history.
            </p>
          </ErpCardSection>

          {!isApiMode() ? (
            <AdminEmptyState title="API mode required" description="Locked accounts come from User.status = BLOCKED." />
          ) : rows.length === 0 ? (
            <AdminEmptyState title="No locked accounts" description="Nobody is currently BLOCKED." />
          ) : (
            <ErpCardSection title="Blocked users">
              <div className="divide-y divide-erp-border">
                {rows.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/admin/users/${row.id}`} className="font-medium text-erp-primary hover:underline">
                          {row.firstName} {row.lastName}
                        </Link>
                        <AdminUserStatusBadge status="BLOCKED" />
                      </div>
                      <p className="text-xs text-erp-muted">{row.email}</p>
                      <p className="text-xs text-erp-muted">
                        Failed attempts: {row.failedLoginCount} · locked{' '}
                        {row.lockedAt ? new Date(row.lockedAt).toLocaleString() : '—'}
                      </p>
                    </div>
                    {canManage ? (
                      <ErpButton
                        size="sm"
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => void unlock(row)}
                      >
                        Unlock
                      </ErpButton>
                    ) : null}
                  </div>
                ))}
              </div>
            </ErpCardSection>
          )}
        </div>
      )}
    </AdminWorkspaceShell>
  )
}
