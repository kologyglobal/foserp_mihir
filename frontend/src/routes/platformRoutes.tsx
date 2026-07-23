import type { RouteObject } from 'react-router-dom'
import { Navigate, useParams } from 'react-router-dom'
import { ProfileSettingsPage, SettingsHomePage } from '@/modules/settings'
import { UatDashboardPage } from '@/modules/uat/UatDashboardPage'
import { PlatformOverviewPage } from '@/modules/systemAdmin/PlatformOverviewPage'
import {
  TenantAdminListPage,
  TenantAdminFormPage,
  TenantAdminDetailPage,
} from '@/modules/systemAdmin/TenantAdminPages'

function AdminTenantsToPlatformRedirect({ suffix = '' }: { suffix?: string }) {
  const { id } = useParams()
  if (id) return <Navigate to={`/platform/tenants/${id}${suffix}`} replace />
  return <Navigate to={`/platform/tenants${suffix}`} replace />
}

/**
 * Platform surfaces: Super Admin tree + settings/UAT.
 * Tenant IAM stays under /admin; workspace tenants CRUD lives under /platform/tenants.
 */
export const platformRouteChildren: RouteObject[] = [
  { path: 'platform', element: <PlatformOverviewPage /> },
  { path: 'platform/tenants', element: <TenantAdminListPage /> },
  { path: 'platform/tenants/new', element: <TenantAdminFormPage /> },
  { path: 'platform/tenants/:id', element: <TenantAdminDetailPage /> },
  { path: 'platform/tenants/:id/edit', element: <TenantAdminFormPage /> },

  { path: 'admin/tenants', element: <AdminTenantsToPlatformRedirect /> },
  { path: 'admin/tenants/new', element: <Navigate to="/platform/tenants/new" replace /> },
  { path: 'admin/tenants/:id', element: <AdminTenantsToPlatformRedirect /> },
  { path: 'admin/tenants/:id/edit', element: <AdminTenantsToPlatformRedirect suffix="/edit" /> },

  { path: 'settings', element: <SettingsHomePage /> },
  { path: 'settings/profile', element: <ProfileSettingsPage /> },
  { path: 'uat/dashboard', element: <UatDashboardPage /> },
]
