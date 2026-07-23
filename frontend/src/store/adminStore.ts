import { create } from 'zustand'
import type { AdminPermission, AdminRoleDetail, AdminRoleSummary, AdminTenant, AdminUser } from '../types/admin'
import { seedAdminUsers, seedPermissionCatalog, seedRoleDetails, seedRoles, seedTenants } from '../data/admin/seed'
import { isApiMode } from '../config/apiConfig'
import type { StoreActionResult, MaybePromise } from './storeAction'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

interface AdminState {
  users: AdminUser[]
  roles: AdminRoleSummary[]
  roleDetails: AdminRoleDetail[]
  permissionCatalog: AdminPermission[]
  tenants: AdminTenant[]
  hydrated: boolean

  // Users
  getUser: (id: string) => AdminUser | undefined
  createUser: (data: {
    firstName: string
    lastName: string
    email: string
    password: string
    mobile?: string
    designation?: string
    department?: string
    departmentId?: string | null
    status?: AdminUser['status']
    roleIds?: string[]
  }) => MaybePromise<StoreActionResult & { userId?: string }>
  updateUser: (id: string, data: Partial<Pick<AdminUser, 'firstName' | 'lastName' | 'email' | 'mobile' | 'designation' | 'department' | 'departmentId' | 'status'>>) => MaybePromise<StoreActionResult>
  deleteUser: (id: string) => MaybePromise<StoreActionResult>
  activateUser: (id: string) => MaybePromise<StoreActionResult>
  deactivateUser: (id: string) => MaybePromise<StoreActionResult>
  assignUserRole: (userId: string, roleId: string) => MaybePromise<StoreActionResult>
  removeUserRole: (userId: string, roleId: string) => MaybePromise<StoreActionResult>

  // Roles
  getRole: (id: string) => AdminRoleSummary | undefined
  getRoleDetail: (id: string) => AdminRoleDetail | undefined
  loadRoleDetail: (id: string) => Promise<AdminRoleDetail | undefined>
  createRole: (data: { name: string; description?: string; permissionNames: string[] }) => MaybePromise<StoreActionResult & { roleId?: string }>
  updateRole: (id: string, data: { name?: string; description?: string | null; permissionNames?: string[] }) => MaybePromise<StoreActionResult>
  deleteRole: (id: string) => MaybePromise<StoreActionResult>

  // Tenants
  getTenant: (id: string) => AdminTenant | undefined
  createTenant: (data: {
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
    status?: AdminTenant['status']
    subscriptionPlan?: string
    adminUser: { firstName: string; lastName: string; email: string; password: string; mobile?: string }
  }) => MaybePromise<StoreActionResult & { tenantId?: string }>
  updateTenant: (id: string, data: Partial<Pick<AdminTenant, 'name' | 'legalName' | 'email' | 'phone' | 'country' | 'state' | 'city' | 'timezone' | 'currency' | 'status' | 'subscriptionPlan' | 'subscriptionStatus'>>) => MaybePromise<StoreActionResult>
  deleteTenant: (id: string) => MaybePromise<StoreActionResult>
}

export const useAdminStore = create<AdminState>()((set, get) => ({
  users: isApiMode() ? [] : seedAdminUsers,
  roles: isApiMode() ? [] : seedRoles,
  roleDetails: isApiMode() ? [] : seedRoleDetails,
  permissionCatalog: isApiMode() ? [] : seedPermissionCatalog,
  tenants: isApiMode() ? [] : seedTenants,
  hydrated: !isApiMode(),

  getUser: (id) => get().users.find((u) => u.id === id),

  createUser: (data) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiCreateAdminUser(data))
    const roles = (data.roleIds ?? [])
      .map((rid) => get().roleDetails.find((r) => r.id === rid))
      .filter((r): r is AdminRoleDetail => Boolean(r))
      .map((r) => ({ id: r.id, name: r.name, description: r.description, isSystem: r.isSystem }))
    const id = genId('admin-user')
    const user: AdminUser = {
      id,
      tenantId: 'demo-tenant',
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      mobile: data.mobile ?? null,
      designation: data.designation ?? null,
      department: data.department ?? null,
      departmentId: data.departmentId ?? null,
      status: data.status ?? 'INVITED',
      emailVerified: false,
      lastLoginAt: null,
      createdBy: null,
      updatedBy: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      roles,
    }
    set((s) => ({ users: [...s.users, user] }))
    return { ok: true, userId: id }
  },

  updateUser: (id, data) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiUpdateAdminUser(id, data))
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, ...data, updatedAt: nowIso() } : u)),
    }))
    return { ok: true }
  },

  deleteUser: (id) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiDeleteAdminUser(id))
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, status: 'ARCHIVED', updatedAt: nowIso() } : u)),
    }))
    return { ok: true }
  },

  activateUser: (id) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiActivateAdminUser(id))
    return get().updateUser(id, { status: 'ACTIVE' })
  },
  deactivateUser: (id) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiDeactivateAdminUser(id))
    return get().updateUser(id, { status: 'INACTIVE' })
  },

  assignUserRole: (userId, roleId) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiAssignAdminUserRole(userId, roleId))
    const role = get().roleDetails.find((r) => r.id === roleId)
    if (!role) return { ok: false, error: 'Role not found' }
    set((s) => ({
      users: s.users.map((u) =>
        u.id === userId && !u.roles.some((r) => r.id === roleId)
          ? {
              ...u,
              roles: [...u.roles, { id: role.id, name: role.name, description: role.description, isSystem: role.isSystem }],
              updatedAt: nowIso(),
            }
          : u,
      ),
    }))
    return { ok: true }
  },

  removeUserRole: (userId, roleId) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiRemoveAdminUserRole(userId, roleId))
    set((s) => ({
      users: s.users.map((u) =>
        u.id === userId ? { ...u, roles: u.roles.filter((r) => r.id !== roleId), updatedAt: nowIso() } : u,
      ),
    }))
    return { ok: true }
  },

  getRole: (id) => get().roles.find((r) => r.id === id),
  getRoleDetail: (id) => get().roleDetails.find((r) => r.id === id),

  loadRoleDetail: async (id) => {
    if (isApiMode()) {
      const m = await import('../services/bridges/adminApiBridge')
      return m.apiFetchAdminRoleDetail(id)
    }
    return get().roleDetails.find((r) => r.id === id)
  },

  createRole: (data) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiCreateAdminRole(data))
    const id = genId('admin-role')
    const detail: AdminRoleDetail = {
      id,
      tenantId: 'demo-tenant',
      name: data.name,
      description: data.description ?? null,
      isSystem: false,
      userCount: 0,
      permissions: [...data.permissionNames].sort(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    set((s) => ({
      roleDetails: [...s.roleDetails, detail],
      roles: [
        ...s.roles,
        { id, tenantId: detail.tenantId, name: detail.name, description: detail.description, isSystem: false, permissionCount: detail.permissions.length },
      ],
    }))
    return { ok: true, roleId: id }
  },

  updateRole: (id, data) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiUpdateAdminRole(id, data))
    const existing = get().roleDetails.find((r) => r.id === id)
    if (!existing) return { ok: false, error: 'Role not found' }
    if (existing.isSystem) return { ok: false, error: 'System roles cannot be modified' }
    const permissions = data.permissionNames !== undefined ? [...data.permissionNames].sort() : existing.permissions
    set((s) => ({
      roleDetails: s.roleDetails.map((r) =>
        r.id === id
          ? { ...r, name: data.name ?? r.name, description: data.description === undefined ? r.description : data.description, permissions, updatedAt: nowIso() }
          : r,
      ),
      roles: s.roles.map((r) =>
        r.id === id
          ? { ...r, name: data.name ?? r.name, description: data.description === undefined ? r.description : data.description, permissionCount: permissions.length }
          : r,
      ),
    }))
    return { ok: true }
  },

  deleteRole: (id) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiDeleteAdminRole(id))
    const existing = get().roleDetails.find((r) => r.id === id)
    if (!existing) return { ok: false, error: 'Role not found' }
    if (existing.isSystem) return { ok: false, error: 'System roles cannot be deleted' }
    if (get().users.some((u) => u.roles.some((r) => r.id === id))) {
      return { ok: false, error: 'Role is assigned to users; unassign before deleting' }
    }
    set((s) => ({
      roleDetails: s.roleDetails.filter((r) => r.id !== id),
      roles: s.roles.filter((r) => r.id !== id),
    }))
    return { ok: true }
  },

  getTenant: (id) => get().tenants.find((t) => t.id === id),

  createTenant: (data) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiCreateAdminTenant(data))
    const id = genId('tenant')
    const tenant: AdminTenant = {
      id,
      name: data.name,
      slug: data.slug,
      legalName: data.legalName ?? null,
      email: data.email,
      phone: data.phone ?? null,
      country: data.country ?? null,
      state: data.state ?? null,
      city: data.city ?? null,
      timezone: data.timezone ?? 'Asia/Kolkata',
      currency: data.currency ?? 'INR',
      status: data.status ?? 'TRIAL',
      subscriptionPlan: data.subscriptionPlan ?? null,
      subscriptionStatus: null,
      trialEndsAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    set((s) => ({ tenants: [...s.tenants, tenant] }))
    return { ok: true, tenantId: id }
  },

  updateTenant: (id, data) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiUpdateAdminTenant(id, data))
    set((s) => ({
      tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...data, updatedAt: nowIso() } : t)),
    }))
    return { ok: true }
  },

  deleteTenant: (id) => {
    if (isApiMode()) return import('../services/bridges/adminApiBridge').then((m) => m.apiDeleteAdminTenant(id))
    set((s) => ({
      tenants: s.tenants.map((t) => (t.id === id ? { ...t, status: 'ARCHIVED', updatedAt: nowIso() } : t)),
    }))
    return { ok: true }
  },
}))
