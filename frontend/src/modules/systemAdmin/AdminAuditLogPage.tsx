import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Filter, RefreshCw, Search } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
  adminBreadcrumbs,
} from '../../components/admin'
import { Badge } from '../../components/ui/Badge'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { Input, Select } from '../../components/forms/Inputs'
import { EnterprisePagination } from '../../design-system/list-page/EnterprisePagination'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import {
  fetchAdminAuditLogsApi,
  type AdminAuditLogRow,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { canAdminPermission } from '../../utils/permissions'

const MODULE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'role', label: 'Role' },
  { value: 'module', label: 'Module' },
  { value: 'security', label: 'Security' },
  { value: 'department', label: 'Department' },
  { value: 'responsibility', label: 'Responsibility' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'invitation', label: 'Invitation' },
  { value: 'scope', label: 'Scope' },
] as const

const ACTION_OPTIONS = [
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LOCK', label: 'Lock' },
  { value: 'UNLOCK', label: 'Unlock' },
  { value: 'REVOKE', label: 'Revoke' },
  { value: 'ASSIGN', label: 'Assign' },
  { value: 'ENABLE', label: 'Enable' },
  { value: 'DISABLE', label: 'Disable' },
] as const

function actionBadgeColor(
  action: string,
): 'green' | 'blue' | 'yellow' | 'red' | 'orange' | 'gray' | 'purple' {
  const a = action.toUpperCase()
  if (a.includes('CREATE') || a.includes('ENABLE') || a.includes('UNLOCK') || a.includes('ASSIGN')) {
    return 'green'
  }
  if (a.includes('UPDATE') || a.includes('EDIT')) return 'blue'
  if (a.includes('DELETE') || a.includes('LOCK') || a.includes('REVOKE') || a.includes('DISABLE')) {
    return 'red'
  }
  if (a.includes('INVITE') || a.includes('RESEND')) return 'yellow'
  return 'gray'
}

function moduleBadgeColor(module: string): 'blue' | 'purple' | 'orange' | 'gray' | 'green' {
  switch (module.toLowerCase()) {
    case 'security':
      return 'orange'
    case 'user':
    case 'invitation':
      return 'blue'
    case 'role':
    case 'scope':
    case 'responsibility':
      return 'purple'
    case 'module':
      return 'green'
    default:
      return 'gray'
  }
}

function entityPath(row: AdminAuditLogRow): string | null {
  if (!row.entityId) return null
  const entity = row.entity.toLowerCase()
  if (entity.includes('user')) return `/admin/users/${row.entityId}`
  if (entity.includes('role')) return `/admin/roles/${row.entityId}`
  return null
}

export function AdminAuditLogPage() {
  const canView = canAdminPermission('security.view')
  const [rows, setRows] = useState<AdminAuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityDraft, setEntityDraft] = useState('')
  const [entityFilter, setEntityFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isApiMode()) {
        setRows([])
        setTotal(0)
        setTotalPages(1)
        return
      }
      const res = await fetchAdminAuditLogsApi({
        module: moduleFilter || undefined,
        action: actionFilter || undefined,
        entity: entityFilter,
        page,
        limit,
      })
      setRows(res.data)
      setTotal(res.meta?.total ?? res.data.length)
      setTotalPages(res.meta?.totalPages ?? 1)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [moduleFilter, actionFilter, entityFilter, page, limit])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const hay = [
        row.module,
        row.action,
        row.entity,
        row.entityId ?? '',
        row.user?.name ?? '',
        row.user?.email ?? '',
        row.ipAddress ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search])

  const uniqueModules = useMemo(
    () => new Set(filteredRows.map((r) => r.module)).size,
    [filteredRows],
  )
  const uniqueActions = useMemo(
    () => new Set(filteredRows.map((r) => r.action)).size,
    [filteredRows],
  )

  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(total, page * limit)

  const applyEntityFilter = () => {
    const next = entityDraft.trim()
    setEntityFilter(next ? next : undefined)
    setPage(1)
  }

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
            <AdminSummaryCard label="Matching (total)" value={total} accent="blue" />
            <AdminSummaryCard label="Shown (page)" value={filteredRows.length} />
            <AdminSummaryCard label="Modules (page)" value={uniqueModules} accent="green" />
            <AdminSummaryCard label="Actions (page)" value={uniqueActions} accent="amber" />
          </AdminSummaryStrip>

          {!isApiMode() ? (
            <AdminEmptyState title="API mode required" description="Audit logs are stored on the server." />
          ) : (
            <>
              <ErpCardSection
                title="Filters"
                subtitle="Narrow by module, action, or entity. Search further filters the current page."
              >
                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-44">
                    <label className="mb-1 block text-xs font-medium text-erp-muted">Module</label>
                    <Select
                      value={moduleFilter}
                      onChange={(e) => {
                        setModuleFilter(e.target.value)
                        setPage(1)
                      }}
                    >
                      <option value="">All modules</option>
                      {MODULE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="w-44">
                    <label className="mb-1 block text-xs font-medium text-erp-muted">Action</label>
                    <Select
                      value={actionFilter}
                      onChange={(e) => {
                        setActionFilter(e.target.value)
                        setPage(1)
                      }}
                    >
                      <option value="">All actions</option>
                      {ACTION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-erp-muted">Entity contains</label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={entityDraft}
                        onChange={(e) => setEntityDraft(e.target.value)}
                        placeholder="User, Role, RefreshToken…"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') applyEntityFilter()
                        }}
                      />
                      <ErpButton
                        size="sm"
                        variant="secondary"
                        type="button"
                        icon={Filter}
                        onClick={applyEntityFilter}
                        disabled={loading}
                      >
                        Apply
                      </ErpButton>
                    </div>
                  </div>

                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-erp-muted">Search page</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-erp-muted" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Actor, email, IP, entity id…"
                        className="pl-8"
                        aria-label="Search audit events on this page"
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-erp-muted">
                  Empty module uses the default Admin allow-list. Entity filter is server-side; search is page-local.
                </p>
              </ErpCardSection>

              <ErpCardSection
                title="Events"
                subtitle="IAM and security AuditLog rows for this tenant, newest first."
              >
                {filteredRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-erp-muted">
                    {rows.length === 0
                      ? 'No audit events match your filters yet.'
                      : 'No events on this page match your search.'}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
                      <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="border-b border-erp-border text-xs uppercase tracking-wide text-erp-muted">
                          <tr>
                            <th className="px-3 py-3 font-semibold">When</th>
                            <th className="px-3 py-3 font-semibold">Module</th>
                            <th className="px-3 py-3 font-semibold">Action</th>
                            <th className="px-3 py-3 font-semibold">Entity</th>
                            <th className="px-3 py-3 font-semibold">Actor</th>
                            <th className="px-3 py-3 font-semibold">IP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-erp-border">
                          {filteredRows.map((row) => {
                            const link = entityPath(row)
                            return (
                              <tr key={row.id} className="hover:bg-erp-surface-alt/60">
                                <td className="px-3 py-2.5 whitespace-nowrap text-erp-muted">
                                  {new Date(row.createdAt).toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <Badge color={moduleBadgeColor(row.module)}>{row.module}</Badge>
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <Badge color={actionBadgeColor(row.action)}>{row.action}</Badge>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="font-medium text-erp-text">{row.entity}</div>
                                  {row.entityId ? (
                                    link ? (
                                      <Link
                                        to={link}
                                        className="font-mono text-[11px] text-erp-primary hover:underline"
                                        title={row.entityId}
                                      >
                                        {row.entityId.slice(0, 8)}…
                                      </Link>
                                    ) : (
                                      <span
                                        className="font-mono text-[11px] text-erp-muted"
                                        title={row.entityId}
                                      >
                                        {row.entityId.slice(0, 8)}…
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-xs text-erp-muted">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  {row.user ? (
                                    <>
                                      <Link
                                        to={`/admin/users/${row.user.id}`}
                                        className="font-medium text-erp-primary hover:underline"
                                      >
                                        {row.user.name || row.user.email}
                                      </Link>
                                      {row.user.name ? (
                                        <p className="text-xs text-erp-muted">{row.user.email}</p>
                                      ) : null}
                                    </>
                                  ) : (
                                    <span className="text-erp-muted">System / unknown</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[12px] text-erp-muted">
                                  {row.ipAddress ?? '-'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4">
                      <EnterprisePagination
                        from={from}
                        to={to}
                        total={total}
                        pageIndex={page - 1}
                        pageCount={totalPages}
                        pageSize={limit}
                        pageSizeOptions={[10, 25, 50, 100]}
                        onPageChange={(idx) => {
                          setPage(idx + 1)
                          setSearch('')
                        }}
                        onPageSizeChange={(size) => {
                          setLimit(size)
                          setPage(1)
                          setSearch('')
                        }}
                      />
                    </div>
                  </>
                )}
              </ErpCardSection>
            </>
          )}
        </div>
      )}
    </AdminWorkspaceShell>
  )
}
