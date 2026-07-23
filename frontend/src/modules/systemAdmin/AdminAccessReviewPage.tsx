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
} from '../../components/admin'
import { Badge } from '../../components/ui/Badge'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import { fetchAdminAccessReviewApi, type AdminAccessReviewReport } from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { canAdminPermission } from '../../utils/permissions'

const REASON_LABEL: Record<string, string> = {
  NO_ROLES: 'No roles',
  SENSITIVE_UNRESTRICTED: 'Sensitive + unrestricted scope',
  INVITED_STALE: 'Stale invitation',
  BLOCKED: 'Blocked',
  NEVER_LOGIN: 'Never logged in',
  HIGH_PERMISSION_COUNT: 'High permission count',
}

export function AdminAccessReviewPage() {
  const canView = canAdminPermission('access.review') || canAdminPermission('user.view')
  const [report, setReport] = useState<AdminAccessReviewReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isApiMode()) {
        setReport({
          generatedAt: new Date().toISOString(),
          totals: { usersScanned: 0, attentionCount: 0, high: 0, medium: 0, low: 0 },
          items: [],
        })
        return
      }
      const res = await fetchAdminAccessReviewApi()
      setReport(res.data)
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

  return (
    <AdminWorkspaceShell
      title="Access Review"
      description="Live attention register over roles, sensitive permissions, and data scopes. Does not persist review campaigns yet."
      workspace="people"
      favoritePath="/admin/access-review"
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
        <AdminEmptyState title="No access" description="You need access.review to open Access Review." />
      ) : loading ? (
        <AdminSkeleton rows={5} />
      ) : error ? (
        <AdminErrorState title="Could not load access review" description={error} />
      ) : !report ? null : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Scanned" value={report.totals.usersScanned} />
            <AdminSummaryCard label="Attention" value={report.totals.attentionCount} accent="amber" />
            <AdminSummaryCard label="High" value={report.totals.high} accent="red" />
            <AdminSummaryCard label="Medium" value={report.totals.medium} />
            <AdminSummaryCard label="Low" value={report.totals.low} />
          </AdminSummaryStrip>

          {!isApiMode() ? (
            <AdminEmptyState title="API mode required" description="Access Review runs against live user/role/scope data." />
          ) : report.items.length === 0 ? (
            <AdminEmptyState title="No attention items" description="No users matched review heuristics in this scan." />
          ) : (
            <ErpCardSection title="Attention queue">
              <p className="mb-3 text-xs text-erp-muted">Generated {new Date(report.generatedAt).toLocaleString()}</p>
              <div className="divide-y divide-erp-border">
                {report.items.map((item) => (
                  <div key={item.userId} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/admin/users/${item.userId}`} className="font-medium text-erp-primary hover:underline">
                          {item.name}
                        </Link>
                        <AdminUserStatusBadge status={item.status as 'ACTIVE' | 'INVITED' | 'INACTIVE' | 'BLOCKED' | 'ARCHIVED'} />
                        <Badge color={item.severity === 'high' ? 'red' : item.severity === 'medium' ? 'yellow' : 'gray'}>
                          {item.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-erp-muted">{item.email}</p>
                      <div className="flex flex-wrap gap-1">
                        {item.reasons.map((r) => (
                          <Badge key={r} color="gray">
                            {REASON_LABEL[r] ?? r}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-erp-muted">
                        {item.roleCount} role(s) · {item.permissionCount} perm(s) · {item.sensitiveCount} sensitive ·{' '}
                        {item.unrestrictedScope ? 'unrestricted scope' : 'scoped'}
                      </p>
                    </div>
                    <Link to={`/admin/users/${item.userId}`}>
                      <ErpButton size="sm" variant="secondary" type="button">
                        Explain access
                      </ErpButton>
                    </Link>
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
