import type { RouteObject } from 'react-router-dom'
import { UserAdminListPage, UserAdminFormPage, UserAdminDetailPage } from '@/modules/systemAdmin/UserAdminPages'
import { RoleAdminListPage, RoleAdminFormPage, RoleAdminDetailPage } from '@/modules/systemAdmin/RoleAdminPages'
import { AdminOverviewPage } from '@/modules/systemAdmin/AdminOverviewPage'
import { AdminTenantProfilePage } from '@/modules/systemAdmin/AdminTenantProfilePage'
import { AdminCompaniesPage } from '@/modules/systemAdmin/AdminCompaniesPage'
import { AdminBranchesPage } from '@/modules/systemAdmin/AdminBranchesPage'
import { AdminInvitationsPage } from '@/modules/systemAdmin/AdminInvitationsPage'
import { AdminDepartmentsPage } from '@/modules/systemAdmin/AdminDepartmentsPage'
import { AdminResponsibilitiesPage } from '@/modules/systemAdmin/AdminResponsibilitiesPage'
import { AdminAccessReviewPage } from '@/modules/systemAdmin/AdminAccessReviewPage'
import { AdminLoginActivityPage } from '@/modules/systemAdmin/AdminLoginActivityPage'
import { AdminSecuritySessionsPage } from '@/modules/systemAdmin/AdminSecuritySessionsPage'
import { AdminLockedAccountsPage } from '@/modules/systemAdmin/AdminLockedAccountsPage'
import { AdminModulesPage } from '@/modules/systemAdmin/AdminModulesPage'
import { AdminOrgStructurePage } from '@/modules/systemAdmin/AdminOrgStructurePage'
import { AdminAuditLogPage } from '@/modules/systemAdmin/AdminAuditLogPage'

/**
 * System administration routes — overview, people, org hubs, modules, security.
 * Platform tenants live under `/platform/tenants` (Super Admin).
 */
export const adminRouteChildren: RouteObject[] = [
  { path: 'admin', element: <AdminOverviewPage /> },

  { path: 'admin/users', element: <UserAdminListPage /> },
  { path: 'admin/users/new', element: <UserAdminFormPage /> },
  { path: 'admin/users/:id', element: <UserAdminDetailPage /> },
  { path: 'admin/users/:id/edit', element: <UserAdminFormPage /> },

  { path: 'admin/roles', element: <RoleAdminListPage /> },
  { path: 'admin/roles/new', element: <RoleAdminFormPage /> },
  { path: 'admin/roles/:id', element: <RoleAdminDetailPage /> },
  { path: 'admin/roles/:id/edit', element: <RoleAdminFormPage /> },

  { path: 'admin/invitations', element: <AdminInvitationsPage /> },
  { path: 'admin/departments', element: <AdminDepartmentsPage /> },
  { path: 'admin/responsibilities', element: <AdminResponsibilitiesPage /> },
  { path: 'admin/access-review', element: <AdminAccessReviewPage /> },
  { path: 'admin/security/login-activity', element: <AdminLoginActivityPage /> },
  { path: 'admin/security/sessions', element: <AdminSecuritySessionsPage /> },
  { path: 'admin/security/locked-accounts', element: <AdminLockedAccountsPage /> },
  { path: 'admin/security/audit', element: <AdminAuditLogPage /> },
  { path: 'admin/tenant-profile', element: <AdminTenantProfilePage /> },
  { path: 'admin/companies', element: <AdminCompaniesPage /> },
  { path: 'admin/branches', element: <AdminBranchesPage /> },
  { path: 'admin/org-structure', element: <AdminOrgStructurePage /> },
  { path: 'admin/modules', element: <AdminModulesPage /> },
]
