import { apiRequest, tenantPath } from './client'
import type {
  AdminPermission,
  AdminRoleDetail,
  AdminRoleSummary,
  AdminTenant,
  AdminUser,
} from '../../types/admin'

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

async function fetchAllPages<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T[]> {
  const limit = 100
  let page = 1
  const all: T[] = []
  for (;;) {
    const res = await apiRequest<T[]>(`${path}${buildQuery({ ...params, page, limit })}`)
    all.push(...res.data)
    const meta = res.meta
    if (!meta || page >= meta.totalPages) break
    page += 1
  }
  return all
}

// ─── Users ───────────────────────────────────────────────────────────────

export async function fetchAdminUsersApi(params?: { search?: string; status?: string }) {
  return fetchAllPages<AdminUser>(tenantPath('/users'), params)
}

export async function fetchAdminUserApi(id: string) {
  return apiRequest<AdminUser>(tenantPath(`/users/${id}`))
}

export interface CreateAdminUserPayload {
  firstName: string
  lastName: string
  email: string
  password: string
  mobile?: string
  designation?: string
  department?: string
  status?: string
  roleIds?: string[]
}

export async function createAdminUserApi(payload: CreateAdminUserPayload) {
  return apiRequest<AdminUser>(tenantPath('/users'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface UpdateAdminUserPayload {
  firstName?: string
  lastName?: string
  email?: string
  mobile?: string | null
  designation?: string | null
  department?: string | null
  status?: string
}

export async function updateAdminUserApi(id: string, payload: UpdateAdminUserPayload) {
  return apiRequest<AdminUser>(tenantPath(`/users/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminUserApi(id: string) {
  return apiRequest<AdminUser>(tenantPath(`/users/${id}`), { method: 'DELETE' })
}

export async function assignAdminUserRoleApi(userId: string, roleId: string) {
  return apiRequest<AdminUser>(tenantPath(`/users/${userId}/roles`), {
    method: 'POST',
    body: JSON.stringify({ roleId }),
  })
}

export async function removeAdminUserRoleApi(userId: string, roleId: string) {
  return apiRequest<AdminUser>(tenantPath(`/users/${userId}/roles/${roleId}`), { method: 'DELETE' })
}

// ─── Roles & Permissions ───────────────────────────────────────────────────

export async function fetchAdminRolesApi() {
  return apiRequest<AdminRoleSummary[]>(tenantPath('/roles'))
}

export async function fetchAdminRoleApi(id: string) {
  return apiRequest<AdminRoleDetail>(tenantPath(`/roles/${id}`))
}

export async function fetchAdminPermissionCatalogApi() {
  return apiRequest<AdminPermission[]>(tenantPath('/roles/permissions/catalog'))
}

export interface CreateAdminRolePayload {
  name: string
  description?: string
  permissionNames: string[]
}

export async function createAdminRoleApi(payload: CreateAdminRolePayload) {
  return apiRequest<AdminRoleDetail>(tenantPath('/roles'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface UpdateAdminRolePayload {
  name?: string
  description?: string | null
  permissionNames?: string[]
}

export async function updateAdminRoleApi(id: string, payload: UpdateAdminRolePayload) {
  return apiRequest<AdminRoleDetail>(tenantPath(`/roles/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminRoleApi(id: string) {
  return apiRequest<AdminRoleDetail>(tenantPath(`/roles/${id}`), { method: 'DELETE' })
}

// ─── Tenants (top-level, not tenant-scoped) ────────────────────────────────

export async function fetchAdminTenantsApi(params?: { search?: string; status?: string }) {
  return fetchAllPages<AdminTenant>('/tenants', params)
}

export async function fetchAdminTenantApi(id: string) {
  return apiRequest<AdminTenant>(`/tenants/${id}`)
}

export interface UpdateAdminTenantPayload {
  name?: string
  legalName?: string | null
  email?: string
  phone?: string | null
  country?: string | null
  state?: string | null
  city?: string | null
  timezone?: string
  currency?: string
  status?: string
  subscriptionPlan?: string | null
  subscriptionStatus?: string | null
}

export async function updateAdminTenantApi(id: string, payload: UpdateAdminTenantPayload) {
  return apiRequest<AdminTenant>(`/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export interface CreateAdminTenantPayload {
  name: string
  slug: string
  legalName?: string
  email: string
  phone?: string
  country?: string
  state?: string
  city?: string
  timezone?: string
  currency?: string
  status?: string
  subscriptionPlan?: string
  subscriptionStatus?: string
  adminUser: {
    firstName: string
    lastName: string
    email: string
    password: string
    mobile?: string
  }
}

export async function createAdminTenantApi(payload: CreateAdminTenantPayload) {
  return apiRequest<{ tenant: AdminTenant; adminUser: AdminUser | null }>('/tenants', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminTenantApi(id: string) {
  return apiRequest<AdminTenant>(`/tenants/${id}`, { method: 'DELETE' })
}
