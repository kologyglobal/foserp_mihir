import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Search, ShieldOff } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
  AdminUserStatusBadge,
  adminBreadcrumbs,
} from '../../components/admin'
import { Badge } from '../../components/ui/Badge'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { Input } from '../../components/forms/Inputs'
import { EnterprisePagination } from '../../design-system/list-page/EnterprisePagination'
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
import type { AdminUserStatus } from '../../types/admin'

const ADMIN_USER_STATUSES = new Set<AdminUserStatus>([
  'ACTIVE',
  'INVITED',
  'INACTIVE',
  'BLOCKED',
  'ARCHIVED',
])

function isAdminUserStatus(value: string): value is AdminUserStatus {
  return ADMIN_USER_STATUSES.has(value as AdminUserStatus)
}

function summarizeUserAgent(ua: string | null): string {
  if (!ua?.trim()) return 'Unknown device'
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua)
  if (/Edg\//i.test(ua)) return mobile ? 'Edge · Mobile' : 'Edge'
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return mobile ? 'Chrome · Mobile' : 'Chrome'
  if (/Firefox\//i.test(ua)) return mobile ? 'Firefox · Mobile' : 'Firefox'
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return mobile ? 'Safari · Mobile' : 'Safari'
  return ua.length > 48 ? `${ua.slice(0, 48)}…` : ua
}

function sessionExpiry(expiresAt: string): { label: string; color: 'green' | 'yellow' | 'red' } {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (Number.isNaN(ms) || ms <= 0) return { label: 'Expired', color: 'red' }
  if (ms < 24 * 60 * 60 * 1000) return { label: 'Expires soon', color: 'yellow' }
  return { label: 'Active', color: 'green' }
}

export function AdminSecuritySessionsPage() {
  const canView = canAdminPermission('security.view') || canAdminPermission('user.view')
  const canManage = canAdminPermission('security.manage') || canAdminPermission('user.update')
  const [rows, setRows] = useState<AdminSecuritySession[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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
      const res = await fetchAdminSecuritySessionsApi({ page, limit })
      setRows(res.data)
      setTotal(res.meta?.total ?? res.data.length)
      setTotalPages(res.meta?.totalPages ?? 1)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const hay = [
        row.user.name,
        row.user.email,
        row.ipAddress ?? '',
        row.userAgent ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search])

  const uniqueUsers = useMemo(
    () => new Set(filteredRows.map((r) => r.userId)).size,
    [filteredRows],
  )
  const expiringSoon = useMemo(
    () => filteredRows.filter((r) => sessionExpiry(r.expiresAt).color === 'yellow').length,
    [filteredRows],
  )

  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(total, page * limit)

  async function revoke(session: AdminSecuritySession) {
    if (!canManage) return
    const ok = await appConfirm({
      title: 'Revoke session?',
      description: `Signs out ${session.user.name} (${session.user.email}) on that device. They will need to sign in again.`,
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
      pageGuide={{
        purpose: 'See who is signed in and revoke refresh-token sessions when a device is lost or access must end.',
        nextStep: 'Use Locked Accounts for failed-login lockouts, or Login Activity to investigate sign-in attempts.',
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
        <AdminEmptyState title="No access" description="You need security.view to list sessions." />
      ) : loading ? (
        <AdminSkeleton rows={5} />
      ) : error ? (
        <AdminErrorState title="Could not load sessions" description={error} />
      ) : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Active (total)" value={total} accent="blue" />
            <AdminSummaryCard label="Shown (page)" value={filteredRows.length} />
            <AdminSummaryCard label="Unique users" value={uniqueUsers} accent="green" />
            <AdminSummaryCard
              label="Expiring soon"
              value={expiringSoon}
              helper="Within 24 hours"
              accent={expiringSoon > 0 ? 'amber' : 'slate'}
            />
          </AdminSummaryStrip>

          {!isApiMode() ? (
            <AdminEmptyState
              title="API mode required"
              description="Sessions are backed by refresh tokens in the API."
            />
          ) : (
            <>
              <ErpCardSection title="Filters" subtitle="Narrow the current page by user, email, IP, or device.">
                <div className="max-w-md">
                  <label className="mb-1 block text-xs font-medium text-erp-muted">Search</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-erp-muted" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Name, email, IP, or user agent…"
                      className="pl-8"
                      aria-label="Filter sessions"
                    />
                  </div>
                  <p className="mt-1 text-xs text-erp-muted">
                    Filters rows on this page. Change page size below to load more sessions.
                  </p>
                </div>
              </ErpCardSection>

              <ErpCardSection
                title="Sessions"
                subtitle="Non-revoked, unexpired refresh tokens. Revoke to force sign-in on that device."
              >
                {filteredRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-erp-muted">
                    {rows.length === 0
                      ? 'No active sessions right now.'
                      : 'No sessions match your search on this page.'}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
                      <table className="w-full min-w-[960px] text-left text-sm">
                        <thead className="border-b border-erp-border text-xs uppercase tracking-wide text-erp-muted">
                          <tr>
                            <th className="px-3 py-3 font-semibold">User</th>
                            <th className="px-3 py-3 font-semibold">Status</th>
                            <th className="px-3 py-3 font-semibold">IP</th>
                            <th className="px-3 py-3 font-semibold">Device</th>
                            <th className="px-3 py-3 font-semibold">Started</th>
                            <th className="px-3 py-3 font-semibold">Expires</th>
                            <th className="px-3 py-3 font-semibold">Session</th>
                            {canManage ? (
                              <th className="sticky right-0 z-10 bg-white px-3 py-3 text-right font-semibold shadow-[-8px_0_10px_-8px_rgba(15,23,42,0.12)]">
                                Actions
                              </th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-erp-border">
                          {filteredRows.map((row) => {
                            const expiry = sessionExpiry(row.expiresAt)
                            return (
                              <tr key={row.id} className="group hover:bg-erp-surface-alt/60">
                                <td className="px-3 py-2.5">
                                  <Link
                                    to={`/admin/users/${row.userId}`}
                                    className="font-medium text-erp-primary hover:underline"
                                  >
                                    {row.user.name}
                                  </Link>
                                  <p className="text-xs text-erp-muted">{row.user.email}</p>
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  {isAdminUserStatus(row.user.status) ? (
                                    <AdminUserStatusBadge status={row.user.status} />
                                  ) : (
                                    <Badge color="gray">{row.user.status}</Badge>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[12px] text-erp-muted">
                                  {row.ipAddress ?? '—'}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className="block max-w-[200px] truncate text-erp-text"
                                    title={row.userAgent ?? undefined}
                                  >
                                    {summarizeUserAgent(row.userAgent)}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-erp-muted">
                                  {new Date(row.createdAt).toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-erp-muted">
                                  {new Date(row.expiresAt).toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <Badge color={expiry.color}>{expiry.label}</Badge>
                                </td>
                                {canManage ? (
                                  <td className="sticky right-0 z-10 bg-white px-3 py-2.5 text-right shadow-[-8px_0_10px_-8px_rgba(15,23,42,0.12)] group-hover:bg-erp-surface-alt/60">
                                    <ErpButton
                                      size="sm"
                                      variant="danger"
                                      type="button"
                                      icon={ShieldOff}
                                      disabled={busyId === row.id}
                                      loading={busyId === row.id}
                                      onClick={() => void revoke(row)}
                                    >
                                      Revoke
                                    </ErpButton>
                                  </td>
                                ) : null}
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
