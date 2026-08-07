import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  GitBranch,
  LayoutDashboard,
  ShieldCheck,
  Users,
  ArrowRight,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { Badge } from '@/components/ui/Badge'
import { useAdminStore } from '@/store/adminStore'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { syncCurrentTenantProfile } from '@/services/bridges/adminApiBridge'
import { canAdminPermission, isSuperAdminUser } from '@/utils/permissions'
import type { AdminTenant, AdminTenantStatus } from '@/types/admin'

const STATUS_COLOR: Record<AdminTenantStatus, 'green' | 'gray' | 'yellow' | 'red'> = {
  ACTIVE: 'green',
  TRIAL: 'yellow',
  INACTIVE: 'gray',
  SUSPENDED: 'red',
  ARCHIVED: 'gray',
}

const DEMO_TENANT_ID = 'demo-tenant'

function resolveCurrentTenantId(): string | null {
  if (isApiMode()) return getStoredSession()?.tenantId ?? null
  return DEMO_TENANT_ID
}

function KpiCard({
  label,
  value,
  hint,
  to,
  icon: Icon,
}: {
  label: string
  value: string | number
  hint?: string
  to: string
  icon: typeof Users
}) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-3 rounded-lg border border-erp-border bg-white p-4 shadow-sm transition hover:border-erp-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-erp-text">{value}</p>
          {hint ? <p className="mt-1 text-xs text-erp-muted">{hint}</p> : null}
        </div>
        <span className="rounded-md bg-slate-50 p-2 text-erp-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-erp-primary">
        Open <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}

function QuickLink({
  to,
  title,
  description,
  icon: Icon,
}: {
  to: string
  title: string
  description: string
  icon: typeof Users
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-lg border border-erp-border bg-white p-4 transition hover:border-erp-primary/40 hover:bg-slate-50/60"
    >
      <span className="rounded-md bg-slate-50 p-2 text-erp-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-erp-text">{title}</span>
        <span className="mt-0.5 block text-xs text-erp-muted">{description}</span>
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-erp-muted" />
    </Link>
  )
}

export function AdminOverviewPage() {
  const users = useAdminStore((s) => s.users)
  const roles = useAdminStore((s) => s.roles)
  const tenants = useAdminStore((s) => s.tenants)
  const getTenant = useAdminStore((s) => s.getTenant)
  const [profileTenant, setProfileTenant] = useState<AdminTenant | undefined>()
  const [loadingTenant, setLoadingTenant] = useState(false)
  const isSuperAdmin = isSuperAdminUser()
  const canUsers = canAdminPermission('user.view')
  const canRoles = canAdminPermission('role.view')

  const tenantId = resolveCurrentTenantId()

  useEffect(() => {
    let cancelled = false
    if (!tenantId) {
      setProfileTenant(undefined)
      return
    }
    const cached = getTenant(tenantId) ?? tenants.find((t) => t.id === tenantId || t.slug === getStoredSession()?.tenantSlug)
    if (cached) setProfileTenant(cached)

    if (!isApiMode()) {
      setProfileTenant(getTenant(tenantId) ?? tenants.find((t) => t.id === tenantId))
      return
    }

    setLoadingTenant(true)
    void syncCurrentTenantProfile().then((tenant) => {
      if (cancelled) return
      setProfileTenant(tenant ?? undefined)
      setLoadingTenant(false)
    })
    return () => {
      cancelled = true
    }
  }, [tenantId, getTenant, tenants])

  const activeUsers = useMemo(() => users.filter((u) => u.status === 'ACTIVE').length, [users])
  const tenantStatus = profileTenant?.status

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Administration"
      title="Administration Overview"
      description="Users, roles, and organization settings for this workspace."
      showDescription
      favoritePath="/admin"
      breadcrumbs={[{ label: 'Administration' }]}
      autoBreadcrumbs={false}
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Users"
            value={canUsers ? users.length : '-'}
            hint={canUsers ? `${activeUsers} active` : 'Requires user.view'}
            to="/admin/users"
            icon={Users}
          />
          <KpiCard
            label="Roles"
            value={canRoles ? roles.length : '-'}
            hint={canRoles ? `${roles.filter((r) => r.isSystem).length} system` : 'Requires role.view'}
            to="/admin/roles"
            icon={ShieldCheck}
          />
          <KpiCard
            label="Tenant status"
            value={loadingTenant && !tenantStatus ? '…' : tenantStatus ?? '-'}
            hint={profileTenant?.name ?? (isApiMode() ? 'Current workspace' : 'Demo tenant')}
            to="/admin/organization/tenant"
            icon={Building2}
          />
          <KpiCard
            label="Organization"
            value="LE / Branch"
            hint="Company = Legal Entity"
            to="/admin/organization"
            icon={GitBranch}
          />
        </div>

        <section className="rounded-lg border border-erp-border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-erp-primary" />
              <h2 className="text-sm font-semibold text-erp-text">Workspace</h2>
            </div>
            {tenantStatus ? <Badge color={STATUS_COLOR[tenantStatus]}>{tenantStatus}</Badge> : null}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-erp-muted">Name</dt>
              <dd className="text-sm font-medium text-erp-text">{profileTenant?.name ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-erp-muted">Slug</dt>
              <dd className="text-sm font-medium text-erp-text">{profileTenant?.slug ?? getStoredSession()?.tenantSlug ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-erp-muted">Plan</dt>
              <dd className="text-sm font-medium text-erp-text">{profileTenant?.subscriptionPlan ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-erp-muted">Currency / TZ</dt>
              <dd className="text-sm font-medium text-erp-text">
                {profileTenant ? `${profileTenant.currency} · ${profileTenant.timezone}` : '-'}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-erp-text">Quick links</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <QuickLink
              to="/admin/users"
              title="Users"
              description="Invite, activate, and assign roles"
              icon={Users}
            />
            <QuickLink
              to="/admin/roles"
              title="Roles & permissions"
              description="Role builder and Effective Access"
              icon={ShieldCheck}
            />
            <QuickLink
              to="/admin/organization/tenant"
              title="Tenant Profile"
              description="Name, slug, status, and basic settings"
              icon={Building2}
            />
            <QuickLink
              to="/admin/organization"
              title="Organization"
              description="Legal Entities and Branches (no duplicate Company model)"
              icon={GitBranch}
            />
            {isSuperAdmin ? (
              <QuickLink
                to="/admin/tenants"
                title="Platform Tenants"
                description="Super Admin multi-tenant workspace CRUD"
                icon={Building2}
              />
            ) : null}
          </div>
        </section>
      </div>
    </OperationalPageShell>
  )
}
