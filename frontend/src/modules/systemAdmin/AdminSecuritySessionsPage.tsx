import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
  adminBreadcrumbs,
} from '../../components/admin'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import {
  fetchAdminSecuritySessionsApi,
  revokeAdminSecuritySessionApi,
  type AdminSecuritySession,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import { appConfirm } from '../../store/confirmDialogStore'

export function AdminSecuritySessionsPage() {
  const canView = canAdminPermission('security.view') || canAdminPermission('user.view')
  const canManage = canAdminPermission('security.manage') || canAdminPermission('user.update')
  const [rows, setRows] = useState<AdminSecuritySession[]>([])
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
      const res = await fetchAdminSecuritySessionsApi({ limit: 100 })
      setRows(res.data)
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

  async function revoke(session: AdminSecuritySession) {
    if (!canManage) return
    const ok = await appConfirm({
      title: 'Revoke session?',
      description: `Signs out ${session.user.name} on that device.`,
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(session.id)
    try {
      await revokeAdminSecuritySessionApi(session.id)
      notify.success('Session revoked')
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminWorkspaceShell
      title="Active Sessions"
      description="Refresh-token sessions across the tenant. Revoking forces re-login on that device."
      workspace="security"
      favoritePath="/admin/security/sessions"
      breadcrumbs={adminBreadcrumbs({ label: 'Security' }, { label: 'Active Sessions' })}
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
        <AdminEmptyState title="No access" description="You need security.view to list sessions." />
      ) : loading ? (
        <AdminSkeleton rows={5} />
      ) : error ? (
        <AdminErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Active sessions" value={rows.length} accent="blue" />
          </AdminSummaryStrip>

          {!isApiMode() ? (
            <AdminEmptyState title="API mode required" description="Sessions are backed by refresh tokens in the API." />
          ) : rows.length === 0 ? (
            <AdminEmptyState title="No active sessions" description="No non-revoked, unexpired refresh tokens." />
          ) : (
            <ErpCardSection title="Sessions">
              <div className="divide-y divide-erp-border">
                {rows.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div>
                      <Link to={`/admin/users/${row.userId}`} className="font-medium text-erp-primary hover:underline">
                        {row.user.name}
                      </Link>
                      <p className="text-xs text-erp-muted">{row.user.email}</p>
                      <p className="text-xs text-erp-muted">
                        {row.ipAddress ?? '—'} · {row.userAgent ?? 'Unknown device'}
                      </p>
                      <p className="text-xs text-erp-muted">
                        Started {new Date(row.createdAt).toLocaleString()} · expires {new Date(row.expiresAt).toLocaleString()}
                      </p>
                    </div>
                    {canManage ? (
                      <ErpButton
                        size="sm"
                        variant="secondary"
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => void revoke(row)}
                      >
                        Revoke
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
