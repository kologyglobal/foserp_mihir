/**
 * Admin workspace chrome — matches Accounting Journals / CRM Dynamics enterprise pattern.
 */
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DynamicsTabs } from '@/components/dynamics/DynamicsTabs'
import type { DynamicsTabItem } from '@/components/dynamics/DynamicsTabs'
import { adminBreadcrumbs } from '@/components/admin/adminNav'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { shouldNavigate } from '@/utils/safeState'

export type AdminWorkspaceId = 'overview' | 'people' | 'organization' | 'security'

const WORKSPACE_TABS: Record<AdminWorkspaceId, DynamicsTabItem[]> = {
  overview: [{ label: 'Overview', path: '/admin' }],
  people: [
    { label: 'Users', path: '/admin/users' },
    { label: 'Roles', path: '/admin/roles' },
    { label: 'Invitations', path: '/admin/invitations' },
    { label: 'Responsibilities', path: '/admin/responsibilities' },
    { label: 'Access Review', path: '/admin/access-review' },
  ],
  organization: [
    { label: 'Org Structure', path: '/admin/org-structure' },
    { label: 'Companies', path: '/admin/companies' },
    { label: 'Branches', path: '/admin/branches' },
    { label: 'Departments', path: '/admin/departments' },
    { label: 'Module Access', path: '/admin/modules' },
    { label: 'Tenant Profile', path: '/admin/tenant-profile' },
  ],
  security: [
    { label: 'Login Activity', path: '/admin/security/login-activity' },
    { label: 'Sessions', path: '/admin/security/sessions' },
    { label: 'Locked Accounts', path: '/admin/security/locked-accounts' },
    { label: 'Audit', path: '/admin/security/audit' },
  ],
}

export function resolveAdminWorkspace(pathname: string): AdminWorkspaceId {
  if (pathname.startsWith('/admin/security')) return 'security'
  if (
    pathname.startsWith('/admin/companies') ||
    pathname.startsWith('/admin/branches') ||
    pathname.startsWith('/admin/departments') ||
    pathname.startsWith('/admin/tenant-profile') ||
    pathname.startsWith('/admin/org-structure') ||
    pathname.startsWith('/admin/modules')
  ) {
    return 'organization'
  }
  if (
    pathname.startsWith('/admin/users') ||
    pathname.startsWith('/admin/roles') ||
    pathname.startsWith('/admin/invitations') ||
    pathname.startsWith('/admin/responsibilities') ||
    pathname.startsWith('/admin/access-review')
  ) {
    return 'people'
  }
  return 'overview'
}

function resolveActiveTabPath(pathname: string, tabs: DynamicsTabItem[]): string {
  const exact = tabs.find((t) => pathname === t.path || pathname.startsWith(`${t.path}/`))
  return exact?.path ?? tabs[0]?.path ?? pathname
}

export function AdminWorkspaceShell({
  title,
  description,
  children,
  workspace,
  commandBar,
  actions,
  kpiStrip,
  pageGuide,
  favoritePath,
  breadcrumbs,
  showTabs = true,
}: {
  title: string
  description?: string
  children: ReactNode
  workspace?: AdminWorkspaceId
  commandBar?: ReactNode
  actions?: ReactNode
  kpiStrip?: EnterpriseKpiItem[]
  pageGuide?: { purpose: string; nextStep?: string }
  favoritePath?: string
  breadcrumbs?: Array<{ label: string; to?: string }>
  /** Overview hub can hide section tabs when showing full IA nav. */
  showTabs?: boolean
}) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const ws = workspace ?? resolveAdminWorkspace(pathname)
  const tabs = WORKSPACE_TABS[ws]
  const activePath = resolveActiveTabPath(pathname, tabs)

  return (
    <OperationalPageShell
      title={title}
      description={description}
      breadcrumbs={breadcrumbs ?? adminBreadcrumbs({ label: title })}
      favoritePath={favoritePath}
      pageGuide={pageGuide}
      commandBar={commandBar}
      actions={actions}
      kpiStrip={kpiStrip}
    >
      {showTabs && tabs.length > 1 ? (
        <DynamicsTabs
          items={tabs}
          activePath={activePath}
          onChange={(path) => {
            if (shouldNavigate(pathname + search, path)) navigate(path)
          }}
        />
      ) : null}
      {children}
    </OperationalPageShell>
  )
}
