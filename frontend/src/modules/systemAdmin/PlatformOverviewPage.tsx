import { Link } from 'react-router-dom'
import { Building2, LayoutDashboard } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import {
  AdminEmptyState,
  AdminSummaryCard,
  AdminSummaryStrip,
} from '../../components/admin'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCardSection } from '../../components/erp/card-form'
import { isSuperAdminUser } from '../../utils/permissions'
import { useAdminStore } from '../../store/adminStore'

/**
 * Platform Admin home — Super Admin only. Tenant IAM stays under /admin.
 */
export function PlatformOverviewPage() {
  const isSuperAdmin = isSuperAdminUser()
  const tenants = useAdminStore((s) => s.tenants)

  if (!isSuperAdmin) {
    return (
      <OperationalPageShell title="Platform" breadcrumbs={[{ label: 'Platform' }]}>
        <AdminEmptyState
          title="Super Admin required"
          description="The Platform Admin tree is limited to users with tenant.manage."
        />
      </OperationalPageShell>
    )
  }

  const active = tenants.filter((t) => t.status === 'ACTIVE').length

  return (
    <OperationalPageShell
      favoritePath="/platform"
      title="Platform Admin"
      description="Cross-tenant administration. Workspace IAM remains under Administration for each tenant."
      breadcrumbs={[{ label: 'Platform' }]}
      actions={
        <Link to="/platform/tenants">
          <ErpButton type="button" size="sm">
            Manage tenants
          </ErpButton>
        </Link>
      }
    >
      <div className="space-y-4">
        <AdminSummaryStrip>
          <AdminSummaryCard label="Tenants" value={tenants.length} accent="blue" />
          <AdminSummaryCard label="Active" value={active} accent="green" />
        </AdminSummaryStrip>

        <ErpCardSection title="Platform areas">
          <div className="grid gap-3 md:grid-cols-2">
            <Link
              to="/platform/tenants"
              className="flex items-start gap-3 rounded-lg border border-erp-border p-4 hover:bg-erp-surface-alt"
            >
              <Building2 className="mt-0.5 h-5 w-5 text-erp-primary" />
              <div>
                <p className="font-medium text-erp-text">Tenants</p>
                <p className="text-xs text-erp-muted">Create and manage workspaces, status, and subscriptions.</p>
              </div>
            </Link>
            <Link
              to="/admin"
              className="flex items-start gap-3 rounded-lg border border-erp-border p-4 hover:bg-erp-surface-alt"
            >
              <LayoutDashboard className="mt-0.5 h-5 w-5 text-erp-primary" />
              <div>
                <p className="font-medium text-erp-text">Current tenant Admin</p>
                <p className="text-xs text-erp-muted">Users, roles, modules, and security for the active workspace.</p>
              </div>
            </Link>
          </div>
        </ErpCardSection>
      </div>
    </OperationalPageShell>
  )
}
