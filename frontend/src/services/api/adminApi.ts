import { apiRequest, tenantPath } from './client'
import type {
  AdminDepartment,
  AdminEffectiveAccess,
  AdminPermission,
  AdminRoleDetail,
  AdminRoleSummary,
  AdminTenant,
  AdminUser,
} from '../../types/admin'

export type { AdminDepartment }

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
  departmentId?: string | null
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
  departmentId?: string | null
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

export interface InviteAdminUserPayload {
  firstName: string
  lastName: string
  email: string
  mobile?: string
  designation?: string
  department?: string
  departmentId?: string | null
  roleIds?: string[]
}

export interface AdminInvitation {
  id: string
  tenantId: string
  userId: string
  email: string
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  invitedBy: string | null
  createdAt: string
  status: 'open' | 'accepted' | 'revoked' | 'expired'
  user: { id: string; firstName: string; lastName: string; status: string }
}

export async function inviteAdminUserApi(payload: InviteAdminUserPayload) {
  return apiRequest<{ user: AdminUser; invitation: AdminInvitation; inviteToken?: string }>(
    tenantPath('/users/invite'),
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export async function fetchAdminInvitationsApi(params?: { status?: string }) {
  return fetchAllPages<AdminInvitation>(tenantPath('/users/invitations'), params)
}

export async function resendAdminInvitationApi(userId: string) {
  return apiRequest<{ invitation: AdminInvitation; inviteToken?: string }>(
    tenantPath(`/users/${userId}/resend-invitation`),
    { method: 'POST', body: '{}' },
  )
}

export async function deactivateAdminUserApi(userId: string) {
  return apiRequest<{ user: AdminUser; revokedSessions: number }>(
    tenantPath(`/users/${userId}/deactivate`),
    { method: 'POST', body: '{}' },
  )
}

export async function activateAdminUserApi(userId: string) {
  return apiRequest<AdminUser>(tenantPath(`/users/${userId}/activate`), {
    method: 'POST',
    body: '{}',
  })
}

export interface AdminUserSession {
  id: string
  createdAt: string
  expiresAt: string
  userAgent: string | null
  ipAddress: string | null
}

export async function fetchAdminUserSessionsApi(userId: string) {
  return apiRequest<AdminUserSession[]>(tenantPath(`/users/${userId}/sessions`))
}

export async function revokeAdminUserSessionsApi(userId: string) {
  return apiRequest<{ revokedSessions: number }>(tenantPath(`/users/${userId}/revoke-sessions`), {
    method: 'POST',
    body: '{}',
  })
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

// ─── Departments (Admin IAM org units) ───────────────────────────────────────

export async function fetchAdminDepartmentsApi(params?: { search?: string; active?: string }) {
  return fetchAllPages<AdminDepartment>(tenantPath('/departments'), params)
}

export async function fetchAdminDepartmentApi(id: string) {
  return apiRequest<AdminDepartment>(tenantPath(`/departments/${id}`))
}

export interface CreateAdminDepartmentPayload {
  code: string
  name: string
  description?: string
  isActive?: boolean
}

export async function createAdminDepartmentApi(payload: CreateAdminDepartmentPayload) {
  return apiRequest<AdminDepartment>(tenantPath('/departments'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface UpdateAdminDepartmentPayload {
  code?: string
  name?: string
  description?: string | null
  isActive?: boolean
}

export async function updateAdminDepartmentApi(id: string, payload: UpdateAdminDepartmentPayload) {
  return apiRequest<AdminDepartment>(tenantPath(`/departments/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminDepartmentApi(id: string) {
  return apiRequest<AdminDepartment>(tenantPath(`/departments/${id}`), { method: 'DELETE' })
}

// ─── Data scopes (Phase 6) ───────────────────────────────────────────────────

export interface AdminUserDataScope {
  unrestricted: boolean
  legalEntities: Array<{
    id: string
    legalEntityId: string
    accessLevel: string
    isDefault: boolean
    code: string
    name: string
  }>
  branches: Array<{ id: string; branchId: string; code: string; name: string; legalEntityId: string }>
  warehouses: Array<{ id: string; warehouseId: string; code: string; name: string }>
}

export interface ReplaceAdminUserScopesPayload {
  legalEntities: Array<{ legalEntityId: string; accessLevel?: string; isDefault?: boolean }>
  branchIds: string[]
  warehouseIds: string[]
}

export async function fetchAdminUserScopesApi(userId: string) {
  return apiRequest<AdminUserDataScope>(tenantPath(`/users/${userId}/scopes`))
}

export async function replaceAdminUserScopesApi(userId: string, payload: ReplaceAdminUserScopesPayload) {
  return apiRequest<AdminUserDataScope>(tenantPath(`/users/${userId}/scopes`), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ─── Responsibilities (Phase 6) ──────────────────────────────────────────────

export interface AdminResponsibility {
  id: string
  tenantId: string | null
  code: string
  name: string
  module: string
  description: string | null
  isSystem: boolean
  isActive: boolean
  assignmentCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminUserResponsibility {
  id: string
  tenantId: string
  userId: string
  responsibilityId: string
  legalEntityId: string | null
  branchId: string | null
  departmentId: string | null
  warehouseId: string | null
  externalRefType: string | null
  externalRefId: string | null
  createdAt: string
  responsibility: {
    id: string
    code: string
    name: string
    module: string
    isSystem: boolean
  }
}

export async function fetchAdminResponsibilitiesApi(params?: { search?: string; active?: string; module?: string }) {
  return fetchAllPages<AdminResponsibility>(tenantPath('/responsibilities'), params)
}

export async function createAdminResponsibilityApi(payload: {
  code: string
  name: string
  module: string
  description?: string
  isActive?: boolean
}) {
  return apiRequest<AdminResponsibility>(tenantPath('/responsibilities'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminResponsibilityApi(
  id: string,
  payload: { name?: string; module?: string; description?: string | null; isActive?: boolean },
) {
  return apiRequest<AdminResponsibility>(tenantPath(`/responsibilities/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminResponsibilityApi(id: string) {
  return apiRequest<AdminResponsibility>(tenantPath(`/responsibilities/${id}`), { method: 'DELETE' })
}

export async function fetchAdminUserResponsibilitiesApi(userId: string) {
  return apiRequest<AdminUserResponsibility[]>(tenantPath(`/users/${userId}/responsibilities`))
}

export async function assignAdminUserResponsibilityApi(
  userId: string,
  payload: {
    responsibilityId: string
    legalEntityId?: string | null
    branchId?: string | null
    departmentId?: string | null
    warehouseId?: string | null
  },
) {
  return apiRequest<AdminUserResponsibility>(tenantPath(`/users/${userId}/responsibilities`), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function removeAdminUserResponsibilityApi(userId: string, assignmentId: string) {
  return apiRequest<AdminUserResponsibility>(tenantPath(`/users/${userId}/responsibilities/${assignmentId}`), {
    method: 'DELETE',
  })
}

// ─── Effective access + Access Review (Phase 7) ──────────────────────────────

export interface AdminEffectiveAccessReport {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    status: string
    department: string | null
    departmentId: string | null
  }
  roles: Array<{ id: string; name: string; isSystem: boolean; permissionCount: number }>
  permissions: Array<{
    name: string
    module: string
    description: string | null
    sensitive: boolean
    sources: string[]
  }>
  permissionCount: number
  sensitivePermissions: string[]
  modules: Array<{ module: string; count: number; sensitiveCount: number }>
  scopes: AdminUserDataScope
  responsibilities: AdminUserResponsibility[]
  moduleAdministrations: string[]
  explain: { summary: string; notes: string[] }
  generatedAt: string
}

export async function fetchAdminEffectiveAccessApi(userId: string) {
  return apiRequest<AdminEffectiveAccessReport>(tenantPath(`/users/${userId}/effective-access`))
}

/** Maps Phase 7 detailed report to the compact A4 store shape. */
export async function fetchAdminUserEffectiveAccessApi(userId: string) {
  const res = await fetchAdminEffectiveAccessApi(userId)
  const report = res.data
  const permissions = report.permissions.map((p) => p.name)
  const roles = report.roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: null as string | null,
    isSystem: r.isSystem,
  }))
  const data: AdminEffectiveAccess = {
    userId: report.user.id,
    tenantId: '',
    roles,
    permissions,
    permissionCount: report.permissionCount,
    isSuperAdmin: permissions.includes('tenant.manage'),
    isTenantAdmin:
      permissions.includes('tenant.manage') ||
      roles.some((r) =>
        ['Super Admin', 'Tenant Admin', 'Admin', 'Administrator', 'CEO'].includes(r.name),
      ),
  }
  return { ...res, data }
}

export interface AdminAccessReviewItem {
  userId: string
  email: string
  name: string
  status: string
  reasons: string[]
  severity: 'high' | 'medium' | 'low'
  roleCount: number
  permissionCount: number
  sensitiveCount: number
  overrideCount?: number
  activeSessionCount?: number
  unrestrictedScope: boolean
  lastLoginAt: string | null
  createdAt: string
  buckets?: string[]
  sodWarnings?: string[]
}

export interface AdminAccessReviewReport {
  generatedAt: string
  totals: {
    usersScanned: number
    attentionCount: number
    high: number
    medium: number
    low: number
  }
  buckets?: Record<string, number>
  unusedRoles?: Array<{ roleId: string; name: string; userCount: number; permissionCount: number }>
  items: AdminAccessReviewItem[]
}

export async function fetchAdminAccessReviewApi() {
  return apiRequest<AdminAccessReviewReport>(tenantPath('/access-review'))
}

// ─── Security (Phase 8) ──────────────────────────────────────────────────────

export interface AdminLoginActivity {
  id: string
  tenantId: string | null
  userId: string | null
  email: string
  success: boolean
  reason: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: { id: string; name: string; status: string } | null
}

export async function fetchAdminLoginActivityApi(params?: { success?: string; email?: string; page?: number; limit?: number }) {
  return apiRequest<{
    items: AdminLoginActivity[]
    meta: { page: number; limit: number; total: number; totalPages: number }
    policy: { maxFailedLogins: number }
  }>(tenantPath(`/security/login-activity${buildQuery(params)}`))
}

export interface AdminSecuritySession {
  id: string
  userId: string
  createdAt: string
  expiresAt: string
  userAgent: string | null
  ipAddress: string | null
  user: { id: string; name: string; email: string; status: string }
}

export async function fetchAdminSecuritySessionsApi(params?: { userId?: string; page?: number; limit?: number }) {
  return apiRequest<AdminSecuritySession[]>(tenantPath(`/security/sessions${buildQuery(params)}`))
}

export async function revokeAdminSecuritySessionApi(sessionId: string) {
  return apiRequest<{ id: string; revoked: boolean }>(tenantPath(`/security/sessions/${sessionId}/revoke`), {
    method: 'POST',
  })
}

export interface AdminLockedAccount {
  id: string
  email: string
  firstName: string
  lastName: string
  status: string
  failedLoginCount: number
  lockedAt: string | null
  lastLoginAt: string | null
}

export async function fetchAdminLockedAccountsApi() {
  return apiRequest<{ items: AdminLockedAccount[]; policy: { maxFailedLogins: number } }>(
    tenantPath('/security/locked-accounts'),
  )
}

export async function lockAdminUserApi(userId: string) {
  return apiRequest<{ user: AdminUser; revokedSessions: number }>(tenantPath(`/users/${userId}/lock`), {
    method: 'POST',
  })
}

export async function unlockAdminUserApi(userId: string) {
  return apiRequest<AdminUser>(tenantPath(`/users/${userId}/unlock`), { method: 'POST' })
}

// ─── Module enablement (Phase 9) ─────────────────────────────────────────────

export interface AdminModuleStatus {
  key: string
  name: string
  description: string
  dependsOn: string[]
  alwaysOn: boolean
  isEnabled: boolean
  configured: boolean
  blockedBy: string[]
  administrators: AdminModuleAdministrator[]
}

export interface AdminModuleAdministrator {
  id: string
  userId: string
  moduleKey: string
  email: string
  firstName: string
  lastName: string
  status: string
}

export async function fetchAdminModulesApi() {
  return apiRequest<{
    modules: AdminModuleStatus[]
    enabledKeys: string[]
    businessType?: string
  }>(tenantPath('/modules'))
}

export async function setAdminModuleFlagApi(moduleKey: string, payload: { isEnabled: boolean }) {
  return apiRequest<AdminModuleStatus>(tenantPath(`/modules/${moduleKey}`), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function fetchAdminModuleAdministratorsApi(moduleKey?: string) {
  const path = moduleKey
    ? tenantPath(`/modules/${moduleKey}/administrators`)
    : tenantPath('/modules/administrators')
  return apiRequest<AdminModuleAdministrator[]>(path)
}

export async function replaceAdminModuleAdministratorsApi(moduleKey: string, userIds: string[]) {
  return apiRequest<AdminModuleAdministrator[]>(tenantPath(`/modules/${moduleKey}/administrators`), {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  })
}

// ─── Security policy + Admin Audit (Phase 10) ────────────────────────────────

export interface AdminSecurityPolicy {
  maxFailedLogins: number
  passwordMinLength: number
  requireComplexity?: boolean
  mfaMode?: 'off' | 'optional' | 'required'
  mfaEnrollmentAvailable?: boolean
  mfa: 'not_configured' | string
  adminAuditModules: string[]
}

export async function fetchAdminSecurityPolicyApi() {
  return apiRequest<AdminSecurityPolicy>(tenantPath('/security/policy'))
}

export async function updateAdminSecurityPolicyApi(body: {
  passwordMinLength?: number
  maxFailedLogins?: number
  requireComplexity?: boolean
  mfaMode?: 'off' | 'optional' | 'required'
}) {
  return apiRequest<AdminSecurityPolicy>(tenantPath('/security/policy'), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export interface AdminAuditLogRow {
  id: string
  tenantId: string | null
  userId: string | null
  module: string
  entity: string
  entityId: string | null
  action: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: { id: string; name: string; email: string } | null
}

export async function fetchAdminAuditLogsApi(params?: {
  module?: string
  entity?: string
  action?: string
  from?: string
  to?: string
  modules?: string
  page?: number
  limit?: number
}) {
  return apiRequest<AdminAuditLogRow[]>(tenantPath(`/security/audit-logs${buildQuery(params)}`))
}

// ─── Document Governance (configuration-only date controls) ─────────────────

export interface DocumentDateControlRow {
  id: string
  tenantId: string
  legalEntityId: string | null
  branchId: string | null
  moduleKey: string
  documentType: string
  policyEnabled: boolean
  futureDateMode: string
  pastDateMode: string
  maxFutureDays: number | null
  maxBackDateDays: number | null
  approvalRequired: boolean
  allowEmergencyOverride: boolean
  policyProfile: string | null
  profileId: string | null
  profile: { id: string; code: string; name: string } | null
  effectiveFrom: string | null
  effectiveTo: string | null
  active: boolean
  allowances: Array<{ id: string; kind: string; roleId: string | null; userId: string | null }>
  createdAt: string
  updatedAt: string
}

export interface DocumentGovernanceDocumentType {
  moduleKey: string
  moduleLabel: string
  documentType: string
  documentLabel: string
}

export interface DocumentGovernanceProfile {
  id: string
  code: string
  name: string
  description: string | null
  futureDateMode: string
  pastDateMode: string
  maxFutureDays: number | null
  maxBackDateDays: number | null
  approvalRequired: boolean
  allowEmergencyOverride: boolean
  active: boolean
}

export async function fetchDateControlsApi(params?: {
  moduleKey?: string
  documentType?: string
  active?: string
  policyEnabled?: string
  page?: number
  limit?: number
}) {
  return apiRequest<DocumentDateControlRow[]>(
    tenantPath(`/admin/document-governance/date-controls${buildQuery(params)}`),
  )
}

export async function fetchDateControlApi(id: string) {
  return apiRequest<DocumentDateControlRow>(
    tenantPath(`/admin/document-governance/date-controls/${id}`),
  )
}

export async function createDateControlApi(body: Record<string, unknown>) {
  return apiRequest<DocumentDateControlRow>(tenantPath('/admin/document-governance/date-controls'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateDateControlApi(id: string, body: Record<string, unknown>) {
  return apiRequest<DocumentDateControlRow>(
    tenantPath(`/admin/document-governance/date-controls/${id}`),
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

export async function activateDateControlApi(id: string) {
  return apiRequest<DocumentDateControlRow>(
    tenantPath(`/admin/document-governance/date-controls/${id}/activate`),
    { method: 'POST' },
  )
}

export async function deactivateDateControlApi(id: string) {
  return apiRequest<DocumentDateControlRow>(
    tenantPath(`/admin/document-governance/date-controls/${id}/deactivate`),
    { method: 'POST' },
  )
}

export async function resetDateControlApi(id: string) {
  return apiRequest<DocumentDateControlRow>(
    tenantPath(`/admin/document-governance/date-controls/${id}/reset-current-behaviour`),
    { method: 'POST' },
  )
}

export async function fetchDocumentGovernanceTypesApi(moduleKey?: string) {
  return apiRequest<{ items: DocumentGovernanceDocumentType[] }>(
    tenantPath(`/admin/document-governance/document-types${buildQuery({ moduleKey })}`),
  )
}

export async function fetchDocumentGovernanceProfilesApi() {
  return apiRequest<DocumentGovernanceProfile[]>(
    tenantPath('/admin/document-governance/profiles'),
  )
}

export async function createDocumentGovernanceProfileApi(body: Record<string, unknown>) {
  return apiRequest<DocumentGovernanceProfile>(
    tenantPath('/admin/document-governance/profiles'),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function updateDocumentGovernanceProfileApi(id: string, body: Record<string, unknown>) {
  return apiRequest<DocumentGovernanceProfile>(
    tenantPath(`/admin/document-governance/profiles/${id}`),
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

// ─── People & Access extension ───────────────────────────────────────────────

export async function cloneAdminRoleApi(roleId: string, name?: string) {
  return apiRequest<{ id: string; name: string }>(tenantPath(`/roles/${roleId}/clone`), {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function bulkAdminUsersApi(body: {
  userIds: string[]
  action: string
  roleId?: string
  branchId?: string
  warehouseId?: string
  dataAccessLevel?: string
}) {
  return apiRequest<{ affected: number; action: string }>(tenantPath('/users/bulk'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchAdminUserOverridesApi(userId: string) {
  return apiRequest<
    Array<{ id: string; permissionName: string; module: string; effect: 'ALLOW' | 'DENY'; reason: string | null }>
  >(tenantPath(`/users/${userId}/overrides`))
}

export async function upsertAdminUserOverrideApi(
  userId: string,
  body: { permissionName: string; effect: 'ALLOW' | 'DENY'; reason?: string | null },
) {
  return apiRequest(tenantPath(`/users/${userId}/overrides`), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function removeAdminUserOverrideApi(userId: string, permissionName: string) {
  return apiRequest(tenantPath(`/users/${userId}/overrides/${encodeURIComponent(permissionName)}`), {
    method: 'DELETE',
  })
}

export async function previewCopyAdminAccessApi(toUserId: string, fromUserId: string) {
  return apiRequest(tenantPath(`/users/${toUserId}/copy-access/preview`), {
    method: 'POST',
    body: JSON.stringify({ fromUserId }),
  })
}

export async function applyCopyAdminAccessApi(
  toUserId: string,
  body: {
    fromUserId: string
    includeRoles?: boolean
    includeScopes?: boolean
    includeOverrides?: boolean
    includeDataAccessLevel?: boolean
  },
) {
  return apiRequest(tenantPath(`/users/${toUserId}/copy-access`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchAdminUserApprovalLimitsApi(userId: string) {
  return apiRequest<Array<Record<string, unknown>>>(tenantPath(`/users/${userId}/approval-limits`))
}

export async function patchAdminUserDataAccessLevelApi(userId: string, dataAccessLevel: string) {
  return apiRequest(tenantPath(`/users/${userId}/data-access-level`), {
    method: 'PATCH',
    body: JSON.stringify({ dataAccessLevel }),
  })
}

export async function fetchApprovalAuthorityRulesApi() {
  return apiRequest<Array<Record<string, unknown>>>(tenantPath('/approval-authority'))
}

export async function createApprovalAuthorityRuleApi(body: Record<string, unknown>) {
  return apiRequest(tenantPath('/approval-authority'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function deleteApprovalAuthorityRuleApi(ruleId: string) {
  return apiRequest(tenantPath(`/approval-authority/${ruleId}`), { method: 'DELETE' })
}
