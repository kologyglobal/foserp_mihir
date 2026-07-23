import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  FolderTree,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  ADMIN_NAV_GROUPS,
  AdminNeedsAttention,
  type AdminAttentionItem,
} from '@/components/admin'
import { AdminWorkspaceShell } from '@/modules/systemAdmin/AdminWorkspaceShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { useAdminStore } from '@/store/adminStore'
import { canAdminPermission, isSuperAdminUser } from '@/utils/permissions'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

export function AdminOverviewPage() {
  const navigate = useNavigate()
  const users = useAdminStore((s) => s.users)
  const roles = useAdminStore((s) => s.roles)
  const canInvite = canAdminPermission('user.create')
  const showTenants = isSuperAdminUser()

  const stats = useMemo(() => {
    const activeUsers = users.filter((u) => u.status === 'ACTIVE').length
    const invited = users.filter((u) => u.status === 'INVITED').length
    const locked = users.filter((u) => u.status === 'BLOCKED').length
    const noRole = users.filter((u) => u.status !== 'ARCHIVED' && u.roles.length === 0).length
    const neverLogin = users.filter((u) => u.status === 'ACTIVE' && !u.lastLoginAt).length
    return { activeUsers, invited, locked, noRole, neverLogin, roleCount: roles.length }
  }, [users, roles])

  const attention = useMemo((): AdminAttentionItem[] => {
    const items: AdminAttentionItem[] = []
    if (stats.noRole > 0) {
      items.push({
        id: 'no-role',
        title: `${stats.noRole} user${stats.noRole === 1 ? '' : 's'} have no active role`,
        detail: 'Assign a role before they can use ERP modules.',
        severity: 'warning',
        to: '/admin/users',
      })
    }
    if (stats.invited > 0) {
      items.push({
        id: 'invited',
        title: `${stats.invited} invited user${stats.invited === 1 ? '' : 's'} pending`,
        detail: 'Resend from Invitations or the user detail page.',
        severity: 'info',
        to: '/admin/invitations',
      })
    }
    if (stats.locked > 0) {
      items.push({
        id: 'locked',
        title: `${stats.locked} locked account${stats.locked === 1 ? '' : 's'}`,
        detail: 'Review and unlock from Locked Accounts.',
        severity: 'critical',
        to: '/admin/security/locked-accounts',
      })
    }
    if (stats.neverLogin > 0) {
      items.push({
        id: 'never-login',
        title: `${stats.neverLogin} active user${stats.neverLogin === 1 ? '' : 's'} never logged in`,
        detail: 'Confirm invitations reached the right people.',
        severity: 'info',
        to: '/admin/users',
      })
    }
    return items
  }, [stats])

  const kpiStrip: EnterpriseKpiItem[] = useMemo(
    () => [
      {
        id: 'active',
        label: 'Active users',
        value: String(stats.activeUsers),
        helper: `${users.length} total`,
        accent: 'green',
        onClick: () => navigate('/admin/users'),
      },
      {
        id: 'invited',
        label: 'Invited',
        value: String(stats.invited),
        accent: 'amber',
        onClick: () => navigate('/admin/invitations'),
      },
      {
        id: 'roles',
        label: 'Active roles',
        value: String(stats.roleCount),
        accent: 'blue',
        onClick: () => navigate('/admin/roles'),
      },
      {
        id: 'locked',
        label: 'Locked',
        value: String(stats.locked),
        accent: stats.locked > 0 ? 'red' : 'slate',
        onClick: () => navigate('/admin/security/locked-accounts'),
      },
    ],
    [stats, users.length, navigate],
  )

  return (
    <AdminWorkspaceShell
      title="Administration"
      description="Users, roles, organisation, and security — same Dynamics chrome as CRM and Accounting."
      workspace="overview"
      showTabs={false}
      favoritePath="/admin"
      breadcrumbs={[{ label: 'Administration' }]}
      kpiStrip={kpiStrip}
      pageGuide={{
        purpose: 'Administration hub — people, access, organisation, and security.',
        nextStep: 'Invite a user or open Roles to review module permissions.',
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            canInvite
              ? {
                  id: 'invite',
                  label: 'Invite User',
                  icon: UserPlus,
                  onClick: () => navigate('/admin/invitations'),
                }
              : {
                  id: 'users',
                  label: 'Users',
                  icon: Users,
                  onClick: () => navigate('/admin/users'),
                }
          }
          secondaryActions={[
            {
              id: 'roles',
              label: 'Manage Roles',
              icon: ShieldCheck,
              onClick: () => navigate('/admin/roles'),
            },
            {
              id: 'org-structure',
              label: 'Org Structure',
              icon: FolderTree,
              onClick: () => navigate('/admin/org-structure'),
            },
            {
              id: 'companies',
              label: 'Companies',
              icon: Building2,
              onClick: () => navigate('/admin/companies'),
            },
          ]}
        />
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/admin/org-structure"
            className="rounded border border-erp-border p-3 hover:bg-erp-surface-alt"
          >
            <FolderTree className="mb-1 h-4 w-4 text-erp-primary" />
            <p className="text-sm font-medium text-erp-text">Organization Structure</p>
            <p className="text-xs text-erp-muted">LE → Branch map</p>
          </Link>
          <Link to="/admin/modules" className="rounded border border-erp-border p-3 hover:bg-erp-surface-alt">
            <SlidersHorizontal className="mb-1 h-4 w-4 text-erp-primary" />
            <p className="text-sm font-medium text-erp-text">Module Access</p>
            <p className="text-xs text-erp-muted">Enable tenant modules</p>
          </Link>
          <Link
            to="/admin/security/audit"
            className="rounded border border-erp-border p-3 hover:bg-erp-surface-alt"
          >
            <ScrollText className="mb-1 h-4 w-4 text-erp-primary" />
            <p className="text-sm font-medium text-erp-text">Admin Audit</p>
            <p className="text-xs text-erp-muted">IAM change history</p>
          </Link>
          <Link
            to="/admin/security/locked-accounts"
            className="rounded border border-erp-border p-3 hover:bg-erp-surface-alt"
          >
            <ShieldCheck className="mb-1 h-4 w-4 text-erp-primary" />
            <p className="text-sm font-medium text-erp-text">Security policy</p>
            <p className="text-xs text-erp-muted">Lockout defaults (read-only)</p>
          </Link>
        </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <AdminNeedsAttention items={attention} />

        <aside className="space-y-3">
          <section className="rounded border border-erp-border bg-erp-surface/40">
            <header className="border-b border-erp-border px-3 py-2.5">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-erp-muted">
                Admin areas
              </h2>
              <p className="mt-0.5 text-[12px] text-erp-muted">People, organisation, and security.</p>
            </header>
            <div className="space-y-3 p-3">
              {ADMIN_NAV_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                    {group.title}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        {item.available ? (
                          <Link
                            to={item.path}
                            className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] text-erp-text hover:bg-erp-surface-alt"
                          >
                            <item.icon className="h-4 w-4 text-erp-muted" strokeWidth={1.75} />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          </Link>
                        ) : (
                          <div
                            className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] text-erp-muted"
                            title={item.description}
                          >
                            <item.icon className="h-4 w-4 opacity-50" strokeWidth={1.75} />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70">
                              Soon
                            </span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {showTenants ? (
                <Link
                  to="/platform/tenants"
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-[13px] text-erp-text hover:bg-erp-surface-alt"
                >
                  <Building2 className="h-4 w-4 text-erp-muted" strokeWidth={1.75} />
                  Tenants (platform)
                </Link>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
      </div>
    </AdminWorkspaceShell>
  )
}
