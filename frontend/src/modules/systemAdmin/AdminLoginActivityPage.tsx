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
import { Badge } from '../../components/ui/Badge'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { Select } from '../../components/forms/Inputs'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import { fetchAdminLoginActivityApi, type AdminLoginActivity } from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { canAdminPermission } from '../../utils/permissions'

export function AdminLoginActivityPage() {
  const canView = canAdminPermission('security.view') || canAdminPermission('user.view')
  const [rows, setRows] = useState<AdminLoginActivity[]>([])
  const [maxFailed, setMaxFailed] = useState(5)
  const [successFilter, setSuccessFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isApiMode()) {
        setRows([])
        return
      }
      const res = await fetchAdminLoginActivityApi({ success: successFilter, limit: 100 })
      setRows(res.data.items)
      setMaxFailed(res.data.policy.maxFailedLogins)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [successFilter])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  const ok = rows.filter((r) => r.success).length
  const fail = rows.filter((r) => !r.success).length

  return (
    <AdminWorkspaceShell
      title="Login Activity"
      description={`Successful and failed sign-ins. Auto-lock after ${maxFailed} consecutive failures.`}
      workspace="security"
      favoritePath="/admin/security/login-activity"
      breadcrumbs={adminBreadcrumbs({ label: 'Security' }, { label: 'Login Activity' })}
      pageGuide={{
        purpose: 'Review successful and failed sign-ins for this tenant.',
        nextStep: 'Investigate failures; unlock accounts under Locked Accounts if auto-locked.',
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
        <AdminEmptyState title="No access" description="You need security.view to open Login Activity." />
      ) : loading ? (
        <AdminSkeleton rows={5} />
      ) : error ? (
        <AdminErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Shown" value={rows.length} />
            <AdminSummaryCard label="Success" value={ok} accent="green" />
            <AdminSummaryCard label="Failed" value={fail} accent="red" />
          </AdminSummaryStrip>

          <div className="w-48">
            <Select value={successFilter} onChange={(e) => setSuccessFilter(e.target.value)}>
              <option value="all">All outcomes</option>
              <option value="true">Success only</option>
              <option value="false">Failures only</option>
            </Select>
          </div>

          {!isApiMode() ? (
            <AdminEmptyState title="API mode required" description="Login activity is recorded by the auth service." />
          ) : rows.length === 0 ? (
            <AdminEmptyState title="No activity yet" description="Sign-in attempts will appear here." />
          ) : (
            <ErpCardSection title="Recent attempts">
              <div className="divide-y divide-erp-border">
                {rows.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-erp-text">{row.email}</span>
                        <Badge color={row.success ? 'green' : 'red'}>{row.success ? 'Success' : 'Failed'}</Badge>
                        <Badge color="gray">{row.reason}</Badge>
                      </div>
                      <p className="text-xs text-erp-muted">
                        {new Date(row.createdAt).toLocaleString()} · {row.ipAddress ?? '—'} · {row.userAgent ?? '—'}
                      </p>
                      {row.user ? (
                        <Link to={`/admin/users/${row.user.id}`} className="text-xs text-erp-primary hover:underline">
                          {row.user.name}
                        </Link>
                      ) : null}
                    </div>
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
