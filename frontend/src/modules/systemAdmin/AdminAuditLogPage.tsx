import { useCallback, useEffect, useState } from 'react'
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
import {
  fetchAdminAuditLogsApi,
  type AdminAuditLogRow,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { canAdminPermission } from '../../utils/permissions'

const MODULE_OPTIONS = [
  { value: 'user', label: 'user' },
  { value: 'role', label: 'role' },
  { value: 'module', label: 'module' },
  { value: 'security', label: 'security' },
  { value: 'department', label: 'department' },
  { value: 'responsibility', label: 'responsibility' },
  { value: 'tenant', label: 'tenant' },
  { value: 'invitation', label: 'invitation' },
  { value: 'scope', label: 'scope' },
]

export function AdminAuditLogPage() {
  const canView = canAdminPermission('security.view')
  const [rows, setRows] = useState<AdminAuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [moduleFilter, setModuleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isApiMode()) {
        setRows([])
        setTotal(0)
        return
      }
      const res = await fetchAdminAuditLogsApi({
        module: moduleFilter || undefined,
        limit: 50,
      })
      setRows(res.data)
      setTotal(res.meta?.total ?? res.data.length)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [moduleFilter])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  return (
    <AdminWorkspaceShell
      title="Admin Audit"
      description="Tenant audit trail for IAM and security actions (AuditLog). Domain journals keep their own audit views."
      workspace="security"
      favoritePath="/admin/security/audit"
      breadcrumbs={adminBreadcrumbs({ label: 'Security' }, { label: 'Audit' })}
      pageGuide={{
        purpose: 'Filter AuditLog rows written by Admin IAM flows (users, roles, modules, security).',
        nextStep: 'Open a related register (Users, Roles, Module Access) if you need to act on an event.',
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
        <AdminEmptyState title="No access" description="You need security.view to open Admin Audit." />
      ) : loading ? (
        <AdminSkeleton rows={5} />
      ) : error ? (
        <AdminErrorState title="Could not load audit log" description={error} />
      ) : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Rows (page)" value={rows.length} />
            <AdminSummaryCard label="Total matching" value={total} accent="blue" />
          </AdminSummaryStrip>

          <ErpCardSection title="Filters">
            <div className="max-w-xs">
              <label className="mb-1 block text-xs font-medium text-erp-muted">Module</label>
              <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
                <option value="">All admin modules</option>
                {MODULE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-erp-muted">
                Empty uses the default Admin module allow-list.
              </p>
            </div>
          </ErpCardSection>

          {!isApiMode() ? (
            <AdminEmptyState title="API mode required" description="Audit logs are stored on the server." />
          ) : rows.length === 0 ? (
            <AdminEmptyState title="No audit events" description="IAM actions will appear here after users, roles, or modules change." />
          ) : (
            <ErpCardSection title="Events">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-erp-border text-xs uppercase tracking-wide text-erp-muted">
                      <th className="px-2 py-2 font-semibold">When</th>
                      <th className="px-2 py-2 font-semibold">Module</th>
                      <th className="px-2 py-2 font-semibold">Action</th>
                      <th className="px-2 py-2 font-semibold">Entity</th>
                      <th className="px-2 py-2 font-semibold">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-erp-border">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-2 py-2 whitespace-nowrap text-erp-muted">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="px-2 py-2">
                          <Badge color="gray">{row.module}</Badge>
                        </td>
                        <td className="px-2 py-2 font-medium text-erp-text">{row.action}</td>
                        <td className="px-2 py-2 text-erp-muted">
                          {row.entity}
                          {row.entityId ? (
                            <span className="ml-1 font-mono text-[11px]">{row.entityId.slice(0, 8)}…</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-erp-muted">{row.user?.name ?? row.user?.email ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ErpCardSection>
          )}
        </div>
      )}
    </AdminWorkspaceShell>
  )
}
