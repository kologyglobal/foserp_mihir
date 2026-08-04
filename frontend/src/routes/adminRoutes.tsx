import type { RouteObject } from 'react-router-dom'
import { UserAdminListPage, UserAdminFormPage, UserAdminDetailPage } from '@/modules/systemAdmin/UserAdminPages'
import { RoleAdminListPage, RoleAdminFormPage, RoleAdminDetailPage } from '@/modules/systemAdmin/RoleAdminPages'
import { AdminOverviewPage } from '@/modules/systemAdmin/AdminOverviewPage'
import {
  AdminOrganizationPage,
  AdminTenantProfilePage,
} from '@/modules/systemAdmin/AdminOrganizationPages'
import { AdminCompaniesPage } from '@/modules/systemAdmin/AdminCompaniesPage'
import { AdminBranchesPage } from '@/modules/systemAdmin/AdminBranchesPage'
import { AdminInvitationsPage } from '@/modules/systemAdmin/AdminInvitationsPage'
import { AdminDepartmentsPage } from '@/modules/systemAdmin/AdminDepartmentsPage'
import { AdminResponsibilitiesPage } from '@/modules/systemAdmin/AdminResponsibilitiesPage'
import { AdminAccessReviewPage } from '@/modules/systemAdmin/AdminAccessReviewPage'
import { AdminPermissionMatrixPage } from '@/modules/systemAdmin/AdminPermissionMatrixPage'
import { AdminDataScopesPage } from '@/modules/systemAdmin/AdminDataScopesPage'
import { AdminApprovalAuthorityPage } from '@/modules/systemAdmin/AdminApprovalAuthorityPage'
import { AdminLoginActivityPage } from '@/modules/systemAdmin/AdminLoginActivityPage'
import { AdminSecuritySessionsPage } from '@/modules/systemAdmin/AdminSecuritySessionsPage'
import { AdminLockedAccountsPage } from '@/modules/systemAdmin/AdminLockedAccountsPage'
import { AdminSecurityPolicyPage } from '@/modules/systemAdmin/AdminSecurityPolicyPage'
import { AdminModulesPage } from '@/modules/systemAdmin/AdminModulesPage'
import { AdminOrgStructurePage } from '@/modules/systemAdmin/AdminOrgStructurePage'
import { AdminAuditLogPage } from '@/modules/systemAdmin/AdminAuditLogPage'
import { AdminDocumentGovernanceDateControlsPage } from '@/modules/systemAdmin/AdminDocumentGovernanceDateControlsPage'

/**
 * System administration routes — overview, organization, people, security, and platform tenants.
 * Shell gated by `canAccessAdminShell()` (see permissions/index canRoute).
 */
export const adminRouteChildren: RouteObject[] = [
  { path: 'admin', element: <AdminOverviewPage /> },

  { path: 'admin/organization', element: <AdminOrganizationPage /> },
  { path: 'admin/organization/tenant', element: <AdminTenantProfilePage /> },

  { path: 'admin/users', element: <UserAdminListPage /> },
  { path: 'admin/users/new', element: <UserAdminFormPage /> },
  { path: 'admin/users/:id', element: <UserAdminDetailPage /> },
  { path: 'admin/users/:id/edit', element: <UserAdminFormPage /> },

  { path: 'admin/roles', element: <RoleAdminListPage /> },
  { path: 'admin/roles/new', element: <RoleAdminFormPage /> },
  { path: 'admin/roles/:id', element: <RoleAdminDetailPage /> },
  { path: 'admin/roles/:id/edit', element: <RoleAdminFormPage /> },

  { path: 'admin/permission-matrix', element: <AdminPermissionMatrixPage /> },
  { path: 'admin/data-scopes', element: <AdminDataScopesPage /> },
  { path: 'admin/approval-authority', element: <AdminApprovalAuthorityPage /> },

  // Platform tenants CRUD lives under /platform/tenants (see platformRoutes) — /admin/tenants redirects there.

  { path: 'admin/invitations', element: <AdminInvitationsPage /> },
  { path: 'admin/departments', element: <AdminDepartmentsPage /> },
  { path: 'admin/responsibilities', element: <AdminResponsibilitiesPage /> },
  { path: 'admin/access-review', element: <AdminAccessReviewPage /> },
  { path: 'admin/security/login-activity', element: <AdminLoginActivityPage /> },
  { path: 'admin/security/sessions', element: <AdminSecuritySessionsPage /> },
  { path: 'admin/security/locked-accounts', element: <AdminLockedAccountsPage /> },
  { path: 'admin/security/policy', element: <AdminSecurityPolicyPage /> },
  { path: 'admin/security/audit', element: <AdminAuditLogPage /> },
  { path: 'admin/tenant-profile', element: <AdminTenantProfilePage /> },
  { path: 'admin/companies', element: <AdminCompaniesPage /> },
  { path: 'admin/branches', element: <AdminBranchesPage /> },
  { path: 'admin/org-structure', element: <AdminOrgStructurePage /> },
  { path: 'admin/modules', element: <AdminModulesPage /> },
  {
    path: 'admin/document-governance/date-controls',
    element: <AdminDocumentGovernanceDateControlsPage />,
  },
]
