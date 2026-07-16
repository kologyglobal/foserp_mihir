import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { UserAdminListPage, UserAdminFormPage, UserAdminDetailPage } from '@/modules/systemAdmin/UserAdminPages'
import { RoleAdminListPage, RoleAdminFormPage, RoleAdminDetailPage } from '@/modules/systemAdmin/RoleAdminPages'
import { TenantAdminListPage, TenantAdminFormPage, TenantAdminDetailPage } from '@/modules/systemAdmin/TenantAdminPages'

/**
 * System administration routes — users, roles, tenants.
 * Gated by `settings.view` at the /admin route-prefix level (see permissionMatrix.ts),
 * with finer-grained `user.*` / `role.*` / `tenant.*` permission checks inside each page.
 */
export const adminRouteChildren: RouteObject[] = [
  { path: 'admin', element: <Navigate to="/admin/users" replace /> },

  { path: 'admin/users', element: <UserAdminListPage /> },
  { path: 'admin/users/new', element: <UserAdminFormPage /> },
  { path: 'admin/users/:id', element: <UserAdminDetailPage /> },
  { path: 'admin/users/:id/edit', element: <UserAdminFormPage /> },

  { path: 'admin/roles', element: <RoleAdminListPage /> },
  { path: 'admin/roles/new', element: <RoleAdminFormPage /> },
  { path: 'admin/roles/:id', element: <RoleAdminDetailPage /> },
  { path: 'admin/roles/:id/edit', element: <RoleAdminFormPage /> },

  { path: 'admin/tenants', element: <TenantAdminListPage /> },
  { path: 'admin/tenants/new', element: <TenantAdminFormPage /> },
  { path: 'admin/tenants/:id', element: <TenantAdminDetailPage /> },
  { path: 'admin/tenants/:id/edit', element: <TenantAdminFormPage /> },
]
