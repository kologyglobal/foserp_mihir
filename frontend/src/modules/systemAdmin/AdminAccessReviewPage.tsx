import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Select } from '../../components/forms/Inputs'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import { fetchAdminAccessReviewApi, type AdminAccessReviewReport } from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { canAdminPermission } from '../../utils/permissions'
import { useAdminStore } from '../../store/adminStore'

const REASON_LABEL: Record<string, string> = {
  NO_ROLES: 'No roles',
  SENSITIVE_UNRESTRICTED: 'Sensitive + unrestricted scope',
  SENSITIVE_ACCESS: 'Sensitive access',
  INVITED_STALE: 'Stale invitation',
  BLOCKED: 'Blocked',
  NEVER_LOGIN: 'Never logged in',
  INACTIVE_WITH_SESSIONS: 'Inactive with sessions',
  HIGH_PERMISSION_COUNT: 'High permission count',
  MANY_OVERRIDES: 'Many overrides',
  SELF_APPROVAL_RISK: 'Self-approval risk',
}

const BUCKET_LABEL: Record<string, string> = {
  no_roles: 'No roles',
  excessive_perms: 'Excessive permissions',
  sensitive_access: 'Sensitive access',
  inactive_sessions: 'Inactive + sessions',
  unused_roles: 'Unused roles',
  many_overrides: 'Many overrides',
  self_approval: 'Self-approval risks',
}

export function AdminAccessReviewPage() {
  const canView = canAdminPermission('access.review') || canAdminPermission('user.view')
  const users = useAdminStore((s) => s.users)
  const roles = useAdminStore((s) => s.roles)
  const [report, setReport] = useState<AdminAccessReviewReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bucketFilter, setBucketFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isApiMode()) {
        // Demo: lightweight heuristics from local admin store
        const noRoles = users.filter((u) => u.roles.length === 0 && u.status !== 'ARCHIVED')
        const items = noRoles.map((u) => ({
          userId: u.id,
          email: u.email,
          name: `${u.firstName} ${u.lastName}`,
          status: u.status,
          reasons: ['NO_ROLES'],
          severity: 'high' as const,
          roleCount: 0,
          permissionCount: 0,
          sensitiveCount: 0,
          unrestrictedScope: true,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
          buckets: ['no_roles'],
          sodWarnings: [] as string[],
        }))
        setReport({
          generatedAt: new Date().toISOString(),
          totals: {
            usersScanned: users.length,
            attentionCount: items.length,
            high: items.length,
            medium: 0,
            low: 0,
          },
          buckets: {
            no_roles: items.length,
            excessive_perms: 0,
            sensitive_access: 0,
            inactive_sessions: 0,
            unused_roles: roles.filter((r) => !r.isSystem).length,
            many_overrides: 0,
            self_approval: 0,
          },
          unusedRoles: roles
            .filter((r) => !r.isSystem)
            .slice(0, 10)
            .map((r) => ({
              roleId: r.id,
              name: r.name,
              userCount: 0,
              permissionCount: r.permissionCount,
            })),
          items,
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
  }, [users, roles])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  const filteredItems = useMemo(() => {
    if (!report) return []
    if (bucketFilter === 'all') return report.items
    return report.items.filter((i) => i.buckets?.includes(bucketFilter) || i.reasons.some((r) => {
      if (bucketFilter === 'no_roles') return r === 'NO_ROLES'
      if (bucketFilter === 'excessive_perms') return r === 'HIGH_PERMISSION_COUNT'
      if (bucketFilter === 'sensitive_access') return r === 'SENSITIVE_ACCESS' || r === 'SENSITIVE_UNRESTRICTED'
      if (bucketFilter === 'inactive_sessions') return r === 'INACTIVE_WITH_SESSIONS' || r === 'NEVER_LOGIN'
      if (bucketFilter === 'many_overrides') return r === 'MANY_OVERRIDES'
      if (bucketFilter === 'self_approval') return r === 'SELF_APPROVAL_RISK'
      return false
    }))
  }, [report, bucketFilter])

  return (
    <AdminWorkspaceShell
      title="Access Review"
      description="Live attention register over roles, sensitive permissions, scopes, overrides, and soft SoD risks. Does not persist review campaigns yet."
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

          {report.buckets ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.buckets).map(([key, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBucketFilter(bucketFilter === key ? 'all' : key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    bucketFilter === key
                      ? 'bg-erp-primary text-white ring-erp-primary'
                      : 'bg-white text-erp-text ring-erp-border'
                  }`}
                >
                  {BUCKET_LABEL[key] ?? key}: {count}
                </button>
              ))}
              {bucketFilter !== 'all' ? (
                <button type="button" className="text-xs text-erp-primary underline" onClick={() => setBucketFilter('all')}>
                  Clear bucket
                </button>
              ) : null}
            </div>
          ) : null}

          {!isApiMode() ? (
            <p className="text-xs text-erp-muted">Demo mode: partial heuristics from local users (no-role primarily). API mode runs full live scan.</p>
          ) : null}

          {report.unusedRoles && report.unusedRoles.length > 0 ? (
            <ErpCardSection title="Unused roles (0 assignees)">
              <ul className="flex flex-wrap gap-2">
                {report.unusedRoles.map((r) => (
                  <li key={r.roleId}>
                    <Link to={`/admin/roles/${r.roleId}`} className="text-sm text-erp-primary hover:underline">
                      {r.name}
                    </Link>
                    <span className="text-xs text-erp-muted"> · {r.permissionCount} perms</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-erp-muted">Soft recommendation: deactivate or delete custom roles with no users after reviewing SoD.</p>
            </ErpCardSection>
          ) : null}

          {report.items.length === 0 ? (
            <AdminEmptyState title="No attention items" description="No users matched review heuristics in this scan." />
          ) : (
            <ErpCardSection title="Attention queue">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="text-xs text-erp-muted">Generated {new Date(report.generatedAt).toLocaleString()}</p>
                <Select value={bucketFilter} onChange={(e) => setBucketFilter(e.target.value)} className="text-xs">
                  <option value="all">All buckets</option>
                  {Object.keys(BUCKET_LABEL).map((k) => (
                    <option key={k} value={k}>
                      {BUCKET_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="divide-y divide-erp-border">
                {filteredItems.map((item) => (
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
                      {item.sodWarnings?.length ? (
                        <p className="text-xs text-amber-800">{item.sodWarnings.join(' · ')}</p>
                      ) : null}
                      <p className="text-xs text-erp-muted">
                        {item.roleCount} role(s) · {item.permissionCount} perm(s) · {item.sensitiveCount} sensitive ·{' '}
                        {item.overrideCount != null ? `${item.overrideCount} overrides · ` : ''}
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
