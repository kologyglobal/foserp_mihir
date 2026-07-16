import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import { ErpDataGrid } from '../../components/erp/ErpDataGrid'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import {
  ERP_ROLE_LABELS,
  PRIMARY_ERP_ROLES,
} from '../../utils/permissions'
import { ROLE_PERMISSION_MATRIX, formatPermissionKey, type PermissionKey } from '../../config/permissionMatrix'
import { buildMasterBreadcrumbs } from '../../utils/masterNavigation'

function masterAdminBreadcrumbs(pageTitle: string) {
  return buildMasterBreadcrumbs('administration', pageTitle)
}

export function RoleMasterPage() {
  const rows = PRIMARY_ERP_ROLES.map((role) => ({
    role,
    label: ERP_ROLE_LABELS[role],
    permissionCount:
      ROLE_PERMISSION_MATRIX[role] === '*'
        ? 'All'
        : (ROLE_PERMISSION_MATRIX[role] as PermissionKey[]).length,
  }))

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Master Data"
      title="Role Master"
      description="ERP roles and permission scope — matrix is code-defined until AuthModule ships"
      breadcrumbs={masterAdminBreadcrumbs('Role Master')}
      autoBreadcrumbs={false}
      favoritePath="/masters/roles"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'permissions',
              label: 'Role Permission Matrix',
              icon: ShieldCheck,
              onClick: () => { window.location.href = '/masters/role-permissions' },
            },
          ]}
        />
      )}
      insights={[
        { label: 'Roles', value: rows.length, accent: 'blue' },
        { label: 'Matrix', value: 'Code-defined', accent: 'slate' },
      ]}
    >
      <EnterpriseRegisterTableShell>
        <div className="ent-data-grid ent-data-grid--register masters-register-grid p-0">
          <ErpDataGrid
            data={rows}
            columns={[
              { accessorKey: 'label', header: 'Role' },
              {
                accessorKey: 'role',
                header: 'Code',
                cell: ({ row }) => <code className="text-xs font-mono">{row.original.role}</code>,
              },
              { accessorKey: 'permissionCount', header: 'Permissions' },
            ]}
          />
        </div>
      </EnterpriseRegisterTableShell>
      <p className="mt-4 text-xs text-erp-muted">
        Edit role permissions in{' '}
        <Link to="/masters/role-permissions" className="font-semibold text-erp-primary hover:underline">
          Role Permission Matrix
        </Link>{' '}
        (read-only view) or{' '}
        <code className="rounded bg-slate-100 px-1">src/config/permissionMatrix.ts</code> for code changes.
      </p>
    </OperationalPageShell>
  )
}

export function PermissionMatrixPage() {
  const modules = [
    'sales',
    'purchase',
    'inventory',
    'production',
    'quality',
    'dispatch',
    'accounts',
    'engineering',
    'masters',
    'approval',
    'settings',
  ] as const

  const rows = PRIMARY_ERP_ROLES.flatMap((role) => {
    const perms = ROLE_PERMISSION_MATRIX[role]
    if (perms === '*') {
      return [{ role, label: ERP_ROLE_LABELS[role], permission: '* (all)' }]
    }
    return (perms as PermissionKey[])
      .filter((p) => modules.some((m) => p.startsWith(`${m}.`)))
      .slice(0, 8)
      .map((p) => ({
        role,
        label: ERP_ROLE_LABELS[role],
        permission: formatPermissionKey(p),
      }))
  })

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Master Data"
      title="Role Permission Matrix"
      description="Role × module × action permissions"
      breadcrumbs={masterAdminBreadcrumbs('Role Permission Matrix')}
      autoBreadcrumbs={false}
      favoritePath="/masters/role-permissions"
      insights={[
        { label: 'Roles', value: PRIMARY_ERP_ROLES.length, accent: 'blue' },
        { label: 'Modules', value: modules.length, accent: 'slate' },
      ]}
    >
      <EnterpriseRegisterTableShell>
        <div className="ent-data-grid ent-data-grid--register masters-register-grid p-0">
          <ErpDataGrid
            data={rows}
            columns={[
              { accessorKey: 'label', header: 'Role' },
              {
                accessorKey: 'permission',
                header: 'Permission',
                cell: ({ row }) =>
                  row.original.permission.startsWith('*') ? (
                    <span className="text-xs font-medium text-emerald-700">All permissions</span>
                  ) : (
                    <code className="text-xs font-mono">{row.original.permission}</code>
                  ),
              },
            ]}
          />
        </div>
      </EnterpriseRegisterTableShell>
    </OperationalPageShell>
  )
}

export function SettingsHomePage() {
  const links = [
    { to: '/settings/demo-data', title: 'Demo Data', desc: 'Reset factory demo dataset' },
    { to: '/masters/roles', title: 'Role Master', desc: 'View ERP roles' },
    { to: '/masters/role-permissions', title: 'Role Permission Matrix', desc: 'Role × module × action' },
    { to: '/masters/approval-workflows', title: 'Approval Workflow', desc: 'Document approval rules' },
  ]

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Settings"
      title="Settings"
      description="RBAC and approval configuration"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="crm-masters-card block rounded-lg border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)] transition hover:border-erp-primary/30 hover:shadow-md"
          >
            <h3 className="font-medium text-slate-900">{l.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{l.desc}</p>
          </Link>
        ))}
      </div>
    </OperationalPageShell>
  )
}
