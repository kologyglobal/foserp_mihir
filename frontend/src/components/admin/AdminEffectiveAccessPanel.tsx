import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminSensitivePermissionBadge } from './AdminStatusBadge'
import { AdminSkeleton } from './AdminStates'
import { adminModuleLabel } from './AdminPermissionMatrix'
import { Badge } from '../ui/Badge'
import { isApiMode } from '../../config/apiConfig'
import { fetchAdminEffectiveAccessApi, type AdminEffectiveAccessReport } from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { canAdminPermission } from '../../utils/permissions'

export function AdminEffectiveAccessPanel({ userId, userName }: { userId: string; userName?: string }) {
  const canView = canAdminPermission('access.view') || canAdminPermission('user.view')
  const [report, setReport] = useState<AdminEffectiveAccessReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllPerms, setShowAllPerms] = useState(false)

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (!isApiMode()) {
        setReport(null)
        setError(null)
        return
      }
      const res = await fetchAdminEffectiveAccessApi(userId)
      setReport(res.data)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [userId, canView])

  useEffect(() => {
    void load()
  }, [load])

  if (!canView) {
    return <p className="text-sm text-erp-muted">You need access.view to explain effective access.</p>
  }

  if (loading) return <AdminSkeleton rows={3} />

  if (!isApiMode()) {
    return (
      <div className="rounded-xl border border-dashed border-erp-border bg-erp-surface-alt/50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-erp-text">
          Effective access{userName ? ` for ${userName}` : ''}
        </p>
        <p className="mt-1 text-xs text-erp-muted">
          Explain Access (roles → permissions + scopes + responsibilities) requires API mode.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
        <button type="button" className="ml-2 underline" onClick={() => void load()}>
          Retry
        </button>
      </div>
    )
  }

  if (!report) return null

  const visiblePerms = showAllPerms ? report.permissions : report.permissions.filter((p) => p.sensitive).slice(0, 40)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-erp-border bg-erp-surface px-4 py-3">
        <p className="text-sm font-medium text-erp-text">{report.explain.summary}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-erp-muted">
          {report.explain.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-erp-muted">Generated {new Date(report.generatedAt).toLocaleString()}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {report.roles.length === 0 ? <Badge color="gray">No roles</Badge> : null}
        {report.roles.map((r) => (
          <Link key={r.id} to={`/admin/roles/${r.id}`} className="inline-flex">
            <Badge color={r.isSystem ? 'blue' : 'gray'}>
              {r.name} ({r.permissionCount})
            </Badge>
          </Link>
        ))}
        {report.scopes.unrestricted ? (
          <Badge color="gray">Unrestricted scope</Badge>
        ) : (
          <Badge color="blue">
            Scoped · {report.scopes.legalEntities.length} LE / {report.scopes.branches.length} branch /{' '}
            {report.scopes.warehouses.length} WH
          </Badge>
        )}
        {report.sensitivePermissions.length > 0 ? <AdminSensitivePermissionBadge /> : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-erp-muted">Modules</p>
        <div className="flex flex-wrap gap-1.5">
          {report.modules.map((m) => (
            <span key={m.module} className="rounded-md border border-erp-border px-2 py-1 text-xs text-erp-text">
              {adminModuleLabel(m.module)} · {m.count}
              {m.sensitiveCount > 0 ? ` · ${m.sensitiveCount} sensitive` : ''}
            </span>
          ))}
        </div>
      </div>

      {report.responsibilities.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-erp-muted">Responsibilities</p>
          <div className="flex flex-wrap gap-1.5">
            {report.responsibilities.map((a) => (
              <Badge key={a.id} color="blue">
                {a.responsibility.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">
            {showAllPerms ? 'All permissions' : 'Sensitive permissions'} ({showAllPerms ? report.permissionCount : report.sensitivePermissions.length})
          </p>
          <button
            type="button"
            className="text-xs font-medium text-erp-primary hover:underline"
            onClick={() => setShowAllPerms((v) => !v)}
          >
            {showAllPerms ? 'Show sensitive only' : 'Show all'}
          </button>
        </div>
        {visiblePerms.length === 0 ? (
          <p className="text-sm text-erp-muted">No permissions in this view.</p>
        ) : (
          <ul className="max-h-56 divide-y divide-erp-border overflow-auto rounded-lg border border-erp-border">
            {visiblePerms.map((p) => (
              <li key={p.name} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-1.5 font-medium text-erp-text">
                  {p.name}
                  {p.sensitive ? <AdminSensitivePermissionBadge /> : null}
                </div>
                <p className="text-xs text-erp-muted">via {p.sources.join(', ')}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
