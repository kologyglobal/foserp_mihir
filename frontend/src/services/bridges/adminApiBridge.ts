import * as api from '../api/adminApi'
import { formatApiError } from '../api/apiErrors'
import { useAdminStore } from '../../store/adminStore'
import type { StoreActionResult } from '../../store/storeAction'
import type { AdminRoleDetail, AdminTenant, AdminUser } from '../../types/admin'

const submitLocks = new Set<string>()

function lockKey(scope: string, id?: string): string {
  return id ? `${scope}:${id}` : scope
}

async function withSubmitLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (submitLocks.has(key)) throw new Error('Operation already in progress')
  submitLocks.add(key)
  try {
    return await fn()
  } finally {
    submitLocks.delete(key)
  }
}

function fail(err: unknown): StoreActionResult {
  return { ok: false, error: formatApiError(err) }
}

function upsertUser(user: AdminUser): void {
  useAdminStore.setState((s) => ({
    users: [user, ...s.users.filter((u) => u.id !== user.id)],
  }))
}

function upsertRoleDetail(role: AdminRoleDetail): void {
  useAdminStore.setState((s) => ({
    roleDetails: [role, ...s.roleDetails.filter((r) => r.id !== role.id)],
    roles: [
      { id: role.id, tenantId: role.tenantId, name: role.name, description: role.description, isSystem: role.isSystem, permissionCount: role.permissions.length },
      ...s.roles.filter((r) => r.id !== role.id),
    ],
  }))
}

function upsertTenant(tenant: AdminTenant): void {
  useAdminStore.setState((s) => ({
    tenants: [tenant, ...s.tenants.filter((t) => t.id !== tenant.id)],
  }))
}

// ─── Hydration ──────────────────────────────────────────────────────────────

/** Requires `user.view` — swallow permission errors so non-admin logins never fail hydration. */
export async function syncAdminUsersFromApi(): Promise<AdminUser[]> {
  try {
    const users = await api.fetchAdminUsersApi()
    useAdminStore.setState({ users })
    return users
  } catch {
    useAdminStore.setState({ users: [] })
    return []
  }
}

/** Requires `role.view` — swallow permission errors so non-admin logins never fail hydration. */
export async function syncAdminRolesFromApi(): Promise<void> {
  try {
    const [roles, permissionCatalog] = await Promise.all([
      api.fetchAdminRolesApi(),
      api.fetchAdminPermissionCatalogApi(),
    ])
    useAdminStore.setState({ roles: roles.data, permissionCatalog: permissionCatalog.data })
  } catch {
    useAdminStore.setState({ roles: [], permissionCatalog: [] })
  }
}

/** Tenants list is Super Admin-only; swallow 403 for tenant-scoped admins. */
export async function syncAdminTenantsFromApi(): Promise<void> {
  try {
    const tenants = await api.fetchAdminTenantsApi()
    useAdminStore.setState({ tenants })
  } catch {
    useAdminStore.setState({ tenants: [] })
  }
}

export async function syncAdminFromApi(): Promise<void> {
  await Promise.all([syncAdminUsersFromApi(), syncAdminRolesFromApi(), syncAdminTenantsFromApi()])
  useAdminStore.setState({ hydrated: true })
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function apiCreateAdminUser(
  input: api.CreateAdminUserPayload,
): Promise<StoreActionResult & { userId?: string }> {
  return withSubmitLock(lockKey('admin-user:create'), async () => {
    try {
      const res = await api.createAdminUserApi(input)
      upsertUser(res.data)
      return { ok: true, userId: res.data.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateAdminUser(
  id: string,
  patch: api.UpdateAdminUserPayload,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('admin-user:update', id), async () => {
    try {
      const res = await api.updateAdminUserApi(id, patch)
      upsertUser(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteAdminUser(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('admin-user:delete', id), async () => {
    try {
      const res = await api.deleteAdminUserApi(id)
      upsertUser(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeactivateAdminUser(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('admin-user:deactivate', id), async () => {
    try {
      const res = await api.deactivateAdminUserApi(id)
      upsertUser(res.data.user)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiActivateAdminUser(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('admin-user:activate', id), async () => {
    try {
      const res = await api.activateAdminUserApi(id)
      upsertUser(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiRevokeAdminUserSessions(id: string): Promise<StoreActionResult & { revokedSessions?: number }> {
  return withSubmitLock(lockKey('admin-user:revoke-sessions', id), async () => {
    try {
      const res = await api.revokeAdminUserSessionsApi(id)
      return { ok: true, revokedSessions: res.data.revokedSessions }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiAssignAdminUserRole(userId: string, roleId: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('admin-user:assign-role', userId), async () => {
    try {
      const res = await api.assignAdminUserRoleApi(userId, roleId)
      upsertUser(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiRemoveAdminUserRole(userId: string, roleId: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('admin-user:remove-role', userId), async () => {
    try {
      const res = await api.removeAdminUserRoleApi(userId, roleId)
      upsertUser(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

// ─── Roles ──────────────────────────────────────────────────────────────────

export async function apiFetchAdminRoleDetail(id: string): Promise<AdminRoleDetail | undefined> {
  try {
    const res = await api.fetchAdminRoleApi(id)
    upsertRoleDetail(res.data)
    return res.data
  } catch {
    return undefined
  }
}

export async function apiCreateAdminRole(
  input: api.CreateAdminRolePayload,
): Promise<StoreActionResult & { roleId?: string }> {
  return withSubmitLock(lockKey('admin-role:create'), async () => {
    try {
      const res = await api.createAdminRoleApi(input)
      upsertRoleDetail(res.data)
      return { ok: true, roleId: res.data.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateAdminRole(
  id: string,
  patch: api.UpdateAdminRolePayload,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('admin-role:update', id), async () => {
    try {
      const res = await api.updateAdminRoleApi(id, patch)
      upsertRoleDetail(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteAdminRole(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('admin-role:delete', id), async () => {
    try {
      await api.deleteAdminRoleApi(id)
      useAdminStore.setState((s) => ({
        roleDetails: s.roleDetails.filter((r) => r.id !== id),
        roles: s.roles.filter((r) => r.id !== id),
      }))
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

// ─── Tenants ────────────────────────────────────────────────────────────────

export async function apiCreateAdminTenant(
  input: api.CreateAdminTenantPayload,
): Promise<StoreActionResult & { tenantId?: string }> {
  return withSubmitLock(lockKey('admin-tenant:create'), async () => {
    try {
      const res = await api.createAdminTenantApi(input)
      upsertTenant(res.data.tenant)
      return { ok: true, tenantId: res.data.tenant.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateAdminTenant(
  id: string,
  patch: api.UpdateAdminTenantPayload,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('admin-tenant:update', id), async () => {
    try {
      const res = await api.updateAdminTenantApi(id, patch)
      upsertTenant(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteAdminTenant(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('admin-tenant:delete', id), async () => {
    try {
      const res = await api.deleteAdminTenantApi(id)
      upsertTenant(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}
