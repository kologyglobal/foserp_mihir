import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  ClipboardList,
  FolderTree,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Lock,
  Network,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
} from 'lucide-react'

export type AdminNavItem = {
  id: string
  label: string
  path: string
  icon: LucideIcon
  /** When false, show as planned (Phase 3+) — not a broken link. */
  available: boolean
  description?: string
}

export type AdminNavGroup = {
  id: string
  title: string
  items: AdminNavItem[]
}

/** Target Admin IA — only available routes are clickable in Phase 2. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'overview',
    title: 'Overview',
    items: [
      {
        id: 'overview',
        label: 'Admin Overview',
        path: '/admin',
        icon: LayoutDashboard,
        available: true,
        description: 'Users, roles, and attention items',
      },
    ],
  },
  {
    id: 'people',
    title: 'People & Access',
    items: [
      { id: 'users', label: 'Users', path: '/admin/users', icon: Users, available: true },
      { id: 'roles', label: 'Roles', path: '/admin/roles', icon: ShieldCheck, available: true },
      {
        id: 'invitations',
        label: 'Invitations',
        path: '/admin/invitations',
        icon: UserPlus,
        available: true,
        description: 'Invite users and track acceptance',
      },
      {
        id: 'responsibilities',
        label: 'Responsibilities',
        path: '/admin/responsibilities',
        icon: ClipboardList,
        available: true,
        description: 'Cross-module ownership labels',
      },
      {
        id: 'access-review',
        label: 'Access Review',
        path: '/admin/access-review',
        icon: ClipboardList,
        available: true,
        description: 'Attention register for roles and scopes',
      },
    ],
  },
  {
    id: 'organization',
    title: 'Organization',
    items: [
      {
        id: 'org-structure',
        label: 'Organization Structure',
        path: '/admin/org-structure',
        icon: GitBranch,
        available: true,
        description: 'Legal entities and branches at a glance',
      },
      {
        id: 'companies',
        label: 'Companies',
        path: '/admin/companies',
        icon: Building2,
        available: true,
        description: 'Legal entities (organisation SoT)',
      },
      {
        id: 'branches',
        label: 'Branches',
        path: '/admin/branches',
        icon: Network,
        available: true,
        description: 'Finance branch master',
      },
      {
        id: 'departments',
        label: 'Departments',
        path: '/admin/departments',
        icon: FolderTree,
        available: true,
        description: 'People org units (IAM)',
      },
      {
        id: 'modules',
        label: 'Module Access',
        path: '/admin/modules',
        icon: SlidersHorizontal,
        available: true,
        description: 'Enable or disable workspace modules for this tenant',
      },
      {
        id: 'tenant-profile',
        label: 'Tenant Profile',
        path: '/admin/tenant-profile',
        icon: Building2,
        available: true,
        description: 'Workspace identity and locale defaults',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    items: [
      {
        id: 'login-activity',
        label: 'Login Activity',
        path: '/admin/security/login-activity',
        icon: KeyRound,
        available: true,
        description: 'Successful and failed sign-ins',
      },
      {
        id: 'sessions',
        label: 'Active Sessions',
        path: '/admin/security/sessions',
        icon: KeyRound,
        available: true,
        description: 'Refresh-token sessions across the tenant',
      },
      {
        id: 'locked',
        label: 'Locked Accounts',
        path: '/admin/security/locked-accounts',
        icon: Lock,
        available: true,
        description: 'BLOCKED users and unlock',
      },
      {
        id: 'audit',
        label: 'Admin Audit',
        path: '/admin/security/audit',
        icon: ClipboardList,
        available: true,
        description: 'IAM and security AuditLog register',
      },
    ],
  },
]

export function adminBreadcrumbs(...crumbs: Array<{ label: string; to?: string }>) {
  return [{ label: 'Administration', to: '/admin' }, ...crumbs]
}
