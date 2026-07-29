import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
} from '../../components/admin'
import { Badge } from '../../components/ui/Badge'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { Select } from '../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import {
  fetchAdminModulesApi,
  replaceAdminModuleAdministratorsApi,
  setAdminModuleFlagApi,
  type AdminModuleStatus,
} from '../../services/api/adminApi'
import { formatApiError, isPermissionDeniedError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { useAdminStore } from '../../store/adminStore'
import { canAdminPermission } from '../../utils/permissions'
import { useTenantModulesStore } from '../../store/tenantModulesStore'
import {
  PermissionDeniedPage,
  permissionDeniedPropsFromError,
} from '../../components/system/PermissionDeniedPage'

export function AdminModulesPage() {
  const navigate = useNavigate()
  const users = useAdminStore((s) => s.users)
  const canView = canAdminPermission('module.view') || canAdminPermission('settings.view')
  const canManage = canAdminPermission('module.manage')
  const setEnabledKeys = useTenantModulesStore((s) => s.setEnabledKeys)
  const [rows, setRows] = useState<AdminModuleStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [pendingAdminUser, setPendingAdminUser] = useState<Record<string, string>>({})
  const [savingAdmins, setSavingAdmins] = useState<string | null>(null)

  const activeUsers = useMemo(
    () =>
      users
        .filter((u) => u.status === 'ACTIVE' || u.status === 'INVITED')
        .slice()
        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
    [users],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!isApiMode()) {
        setRows([])
        return
      }
      const res = await fetchAdminModulesApi()
      setRows(res.data.modules)
      setEnabledKeys(
        res.data.enabledKeys,
        res.data.modules.map((m) => m.key),
      )
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [setEnabledKeys])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  async function toggle(row: AdminModuleStatus) {
    if (!canManage || row.alwaysOn) return
    const next = !row.isEnabled
    setBusyKey(row.key)
    try {
      const res = await setAdminModuleFlagApi(row.key, { isEnabled: next })
      notify.success(`${row.name} ${next ? 'enabled' : 'disabled'}`)
      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, ...res.data } : r)))
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusyKey(null)
    }
  }

  async function addAdministrator(moduleKey: string) {
    if (!canManage) return
    const userId = pendingAdminUser[moduleKey]
    if (!userId) return
    const row = rows.find((r) => r.key === moduleKey)
    if (!row) return
    if (row.administrators.some((a) => a.userId === userId)) {
      notify.error('User is already a module administrator')
      return
    }
    setSavingAdmins(moduleKey)
    try {
      const nextIds = [...row.administrators.map((a) => a.userId), userId]
      const res = await replaceAdminModuleAdministratorsApi(moduleKey, nextIds)
      setRows((prev) =>
        prev.map((r) => (r.key === moduleKey ? { ...r, administrators: res.data } : r)),
      )
      setPendingAdminUser((s) => ({ ...s, [moduleKey]: '' }))
      notify.success('Module administrator added')
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setSavingAdmins(null)
    }
  }

  async function removeAdministrator(moduleKey: string, userId: string) {
    if (!canManage) return
    const row = rows.find((r) => r.key === moduleKey)
    if (!row) return
    setSavingAdmins(moduleKey)
    try {
      const nextIds = row.administrators.filter((a) => a.userId !== userId).map((a) => a.userId)
      const res = await replaceAdminModuleAdministratorsApi(moduleKey, nextIds)
      setRows((prev) =>
        prev.map((r) => (r.key === moduleKey ? { ...r, administrators: res.data } : r)),
      )
      notify.success('Module administrator removed')
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setSavingAdmins(null)
    }
  }

  const enabled = rows.filter((r) => r.isEnabled).length
  const adminCount = rows.reduce((n, r) => n + (r.administrators?.length ?? 0), 0)

  if (!canView) {
    return (
      <PermissionDeniedPage
        pageName="Module Access"
        requiredPermission="module.view"
        reason="Missing permission: module.view"
      />
    )
  }

  if (error && isPermissionDeniedError(error)) {
    return (
      <PermissionDeniedPage
        {...(permissionDeniedPropsFromError(error, 'Module Access') ?? {
          pageName: 'Module Access',
          reason: error,
        })}
      />
    )
  }

  return (
    <AdminWorkspaceShell
      title="Module Access"
      description="Enable or disable workspace modules and designate module administrators (ownership contacts). Module admin designation does not grant module.manage by itself."
      workspace="organization"
      favoritePath="/admin/modules"
      pageGuide={{
        purpose:
          'Tenant module enablement (fail-open) plus module administrator designations. Soft-gates the sidebar; purchase/manufacturing APIs also check flags.',
        nextStep:
          'Disable unused modules carefully (respect dependencies), assign module owners, then manage permissions on Roles.',
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
          secondaryActions={[
            {
              id: 'roles',
              label: 'Manage via Roles',
              icon: ShieldCheck,
              onClick: () => navigate('/admin/roles'),
            },
          ]}
        />
      }
    >
      {loading ? (
        <AdminSkeleton rows={5} />
      ) : error ? (
        <AdminErrorState title="Could not load modules" description={error} />
      ) : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Catalog" value={rows.length} />
            <AdminSummaryCard label="Enabled" value={enabled} accent="green" />
            <AdminSummaryCard label="Disabled" value={rows.length - enabled} accent="amber" />
            <AdminSummaryCard label="Module admins" value={adminCount} accent="blue" />
          </AdminSummaryStrip>

          <p className="text-sm text-erp-muted">
            Module administrators are ownership contacts for each catalog module. Permission packs remain on{' '}
            <Link to="/admin/roles" className="text-erp-primary hover:underline">
              Roles
            </Link>
            .
          </p>

          {!isApiMode() ? (
            <AdminEmptyState title="API mode required" description="Module flags are stored per tenant in the API." />
          ) : (
            <ErpCardSection title="Modules">
              <div className="divide-y divide-erp-border">
                {rows.map((row) => (
                  <div key={row.key} className="space-y-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-erp-text">{row.name}</span>
                          <Badge color={row.isEnabled ? 'green' : 'gray'}>
                            {row.isEnabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {row.alwaysOn ? <Badge color="blue">Always on</Badge> : null}
                          {!row.configured ? <Badge color="gray">Default</Badge> : null}
                        </div>
                        <p className="text-xs text-erp-muted">{row.description}</p>
                        {row.dependsOn.length > 0 ? (
                          <p className="text-xs text-erp-muted">Depends on: {row.dependsOn.join(', ')}</p>
                        ) : null}
                        {row.blockedBy.length > 0 ? (
                          <p className="text-xs text-erp-danger-fg">
                            Blocked by disabled: {row.blockedBy.join(', ')}
                          </p>
                        ) : null}
                      </div>
                      {canManage && !row.alwaysOn ? (
                        <ErpButton
                          size="sm"
                          type="button"
                          variant="secondary"
                          disabled={busyKey === row.key || (row.isEnabled === false && row.blockedBy.length > 0)}
                          onClick={() => void toggle(row)}
                        >
                          {row.isEnabled ? 'Disable' : 'Enable'}
                        </ErpButton>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-erp-border bg-erp-surface-alt/40 px-3 py-2">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-erp-muted">
                        Module administrators
                      </p>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {(row.administrators ?? []).length === 0 ? (
                          <span className="text-xs text-erp-muted">None designated</span>
                        ) : (
                          (row.administrators ?? []).map((a) => (
                            <span
                              key={a.id}
                              className="inline-flex items-center gap-1 rounded-md border border-erp-border bg-erp-surface px-2 py-1 text-xs"
                            >
                              <Link to={`/admin/users/${a.userId}`} className="text-erp-primary hover:underline">
                                {a.firstName} {a.lastName}
                              </Link>
                              {canManage ? (
                                <button
                                  type="button"
                                  className="text-erp-muted hover:text-erp-danger-fg"
                                  disabled={savingAdmins === row.key}
                                  onClick={() => void removeAdministrator(row.key, a.userId)}
                                  aria-label={`Remove ${a.firstName} ${a.lastName}`}
                                >
                                  ×
                                </button>
                              ) : null}
                            </span>
                          ))
                        )}
                      </div>
                      {canManage ? (
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="min-w-[220px] flex-1">
                            <Select
                              value={pendingAdminUser[row.key] ?? ''}
                              onChange={(e) =>
                                setPendingAdminUser((s) => ({ ...s, [row.key]: e.target.value }))
                              }
                            >
                              <option value="">{SELECT_PLACEHOLDER}</option>
                              {activeUsers
                                .filter((u) => !(row.administrators ?? []).some((a) => a.userId === u.id))
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.firstName} {u.lastName} ({u.email})
                                  </option>
                                ))}
                            </Select>
                          </div>
                          <ErpButton
                            size="sm"
                            type="button"
                            disabled={!pendingAdminUser[row.key] || savingAdmins === row.key}
                            onClick={() => void addAdministrator(row.key)}
                          >
                            Add
                          </ErpButton>
                        </div>
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
