import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Filter, RefreshCw, Search } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
  AdminNeedsAttention,
  adminBreadcrumbs,
} from '../../components/admin'
import { Badge } from '../../components/ui/Badge'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { ErpButton } from '../../components/erp/ErpButton'
import { Input, Select } from '../../components/forms/Inputs'
import { EnterprisePagination } from '../../design-system/list-page/EnterprisePagination'
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
  const [emailDraft, setEmailDraft] = useState('')
  const [emailFilter, setEmailFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
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
      const res = await fetchAdminLoginActivityApi({ success: successFilter, email: emailFilter, page, limit })
      setRows(res.data.items)
      setMaxFailed(res.data.policy.maxFailedLogins)
      setTotal(res.data.meta.total)
      setTotalPages(res.data.meta.totalPages)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [successFilter, emailFilter, page, limit])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  const ok = useMemo(() => rows.filter((r) => r.success).length, [rows])
  const fail = useMemo(() => rows.filter((r) => !r.success).length, [rows])

  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(total, page * limit)

  const applyEmailFilter = () => {
    const next = emailDraft.trim()
    setEmailFilter(next ? next : undefined)
    setPage(1)
  }

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
        <AdminErrorState title="Could not load login activity" description={error} />
      ) : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Matching (total)" value={total} accent="blue" />
            <AdminSummaryCard label="Shown (page)" value={rows.length} />
            <AdminSummaryCard label="Success" value={ok} accent="green" />
            <AdminSummaryCard label="Failed" value={fail} accent="red" />
          </AdminSummaryStrip>

          {!isApiMode() ? (
            <AdminEmptyState title="API mode required" description="Login activity is recorded by the auth service." />
          ) : (
            <>
              <ErpCardSection title="Filters">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-56">
                    <label className="mb-1 block text-xs font-medium text-erp-muted">Outcome</label>
                    <Select
                      value={successFilter}
                      onChange={(e) => {
                        setSuccessFilter(e.target.value)
                        setPage(1)
                      }}
                    >
                      <option value="all">All outcomes</option>
                      <option value="true">Success only</option>
                      <option value="false">Failures only</option>
                    </Select>
                  </div>

                  <div className="min-w-[280px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-erp-muted">Email contains</label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-erp-muted" />
                        <Input
                          value={emailDraft}
                          onChange={(e) => setEmailDraft(e.target.value)}
                          placeholder="user@company.com"
                          className="pl-8"
                        />
                      </div>
                      <ErpButton
                        size="sm"
                        variant="secondary"
                        type="button"
                        icon={Filter}
                        onClick={applyEmailFilter}
                        disabled={loading}
                      >
                        Apply
                      </ErpButton>
                    </div>
                    <p className="mt-1 text-xs text-erp-muted">Server-side filtering. Resets to page 1.</p>
                  </div>
                </div>
              </ErpCardSection>

              <ErpCardSection
                title="Recent attempts"
                subtitle="Review successful and failed sign-ins. Failure reasons can help diagnose credential and tenant mismatch."
              >
                {rows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-erp-muted">
                    No login activity matches your filters.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
                      <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="border-b border-erp-border text-xs uppercase tracking-wide text-erp-muted">
                          <tr>
                            <th className="px-3 py-3 font-semibold">When</th>
                            <th className="px-3 py-3 font-semibold">Email</th>
                            <th className="px-3 py-3 font-semibold">Outcome</th>
                            <th className="px-3 py-3 font-semibold">Reason</th>
                            <th className="px-3 py-3 font-semibold">IP</th>
                            <th className="px-3 py-3 font-semibold">User agent</th>
                            <th className="px-3 py-3 font-semibold">User</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-erp-border">
                          {rows.map((row) => (
                            <tr key={row.id} className="hover:bg-erp-surface-alt/60">
                              <td className="px-3 py-2 whitespace-nowrap text-erp-muted">
                                {new Date(row.createdAt).toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-medium text-erp-text">{row.email}</span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <Badge color={row.success ? 'green' : 'red'}>
                                  {row.success ? 'Success' : 'Failed'}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                <Badge color="gray" className="max-w-[220px] truncate">
                                  {row.reason}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap font-mono text-[12px] text-erp-muted">
                                {row.ipAddress ?? '-'}
                              </td>
                              <td className="px-3 py-2">
                                <span className="truncate max-w-[260px] text-erp-muted">
                                  {row.userAgent ?? '-'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {row.user ? (
                                  <Link to={`/admin/users/${row.user.id}`} className="text-erp-primary hover:underline">
                                    {row.user.name}
                                  </Link>
                                ) : (
                                  <span className="text-erp-muted">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
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
                        onPageChange={(idx) => setPage(idx + 1)}
                        onPageSizeChange={(size) => {
                          setLimit(size)
                          setPage(1)
                        }}
                      />
                    </div>
                  </>
                )}
              </ErpCardSection>

              {maxFailed >= 5 ? null : (
                <AdminNeedsAttention
                  title="Low lockout threshold"
                  items={[
                    {
                      id: 'low-lockout-threshold',
                      title: `Auto-lock after ${maxFailed} failed sign-ins`,
                      detail: 'Consider reviewing account lockouts under Locked Accounts if this is too strict for your users.',
                      severity: 'warning',
                      to: '/admin/security/locked-accounts',
                    },
                  ]}
                />
              )}
            </>
          )}
        </div>
      )}
    </AdminWorkspaceShell>
  )
}
