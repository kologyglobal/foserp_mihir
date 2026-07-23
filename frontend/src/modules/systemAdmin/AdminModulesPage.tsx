import { useCallback, useEffect, useState } from 'react'
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
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import {
  fetchAdminModulesApi,
  setAdminModuleFlagApi,
  type AdminModuleStatus,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import { useTenantModulesStore } from '../../store/tenantModulesStore'

export function AdminModulesPage() {
  const navigate = useNavigate()
  const canView = canAdminPermission('module.view') || canAdminPermission('settings.view')
  const canManage = canAdminPermission('module.manage')
  const setEnabledKeys = useTenantModulesStore((s) => s.setEnabledKeys)
  const [rows, setRows] = useState<AdminModuleStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

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
      setEnabledKeys(res.data.enabledKeys)
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

  const enabled = rows.filter((r) => r.isEnabled).length

  return (
    <AdminWorkspaceShell
      title="Module Access"
      description="Enable or disable workspace modules for this tenant. Missing flags default to enabled. Finance LE feature controls stay under Accounting."
      workspace="organization"
      favoritePath="/admin/modules"
      pageGuide={{
        purpose: 'Tenant module enablement (fail-open). Soft-gates the sidebar; purchase/manufacturing APIs also check flags.',
        nextStep: 'Disable unused modules carefully (respect dependencies), then manage permissions on Roles.',
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
      {!canView ? (
        <AdminEmptyState title="No access" description="You need module.view to manage module enablement." />
      ) : loading ? (
        <AdminSkeleton rows={5} />
      ) : error ? (
        <AdminErrorState title="Could not load modules" description={error} />
      ) : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Catalog" value={rows.length} />
            <AdminSummaryCard label="Enabled" value={enabled} accent="green" />
            <AdminSummaryCard label="Disabled" value={rows.length - enabled} accent="amber" />
          </AdminSummaryStrip>

          <p className="text-sm text-erp-muted">
            Module Admins are not a separate IAM entity — assign module permission packs on{' '}
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
                  <div key={row.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-erp-text">{row.name}</span>
                        <Badge color={row.isEnabled ? 'green' : 'gray'}>{row.isEnabled ? 'Enabled' : 'Disabled'}</Badge>
                        {row.alwaysOn ? <Badge color="blue">Always on</Badge> : null}
                        {!row.configured ? <Badge color="gray">Default</Badge> : null}
                      </div>
                      <p className="text-xs text-erp-muted">{row.description}</p>
                      {row.dependsOn.length > 0 ? (
                        <p className="text-xs text-erp-muted">Depends on: {row.dependsOn.join(', ')}</p>
                      ) : null}
                      {row.blockedBy.length > 0 ? (
                        <p className="text-xs text-erp-danger-fg">Blocked by disabled: {row.blockedBy.join(', ')}</p>
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
                ))}
              </div>
            </ErpCardSection>
          )}
        </div>
      )}
    </AdminWorkspaceShell>
  )
}
