/** Seeded tenant-admin persona names — keep in sync with backend effective-access.service. */
export const TENANT_ADMIN_ROLE_NAMES = new Set([
  'Super Admin',
  'Tenant Admin',
  'Admin',
  'Administrator',
  'CEO',
])

export function isTenantAdminRoleName(name: string): boolean {
  return TENANT_ADMIN_ROLE_NAMES.has(name)
}

export function userHasTenantAdminAccess(
  roles: ReadonlyArray<{ name: string }>,
  permissions?: readonly string[],
): boolean {
  if (permissions?.includes('tenant.manage')) return true
  return roles.some((r) => isTenantAdminRoleName(r.name))
}
