/** Mirrors frontend AdminPermissionMatrix sensitive heuristics. */
export const SENSITIVE_PERMISSION_PREFIXES = [
  'tenant.manage',
  'tenant.create',
  'tenant.delete',
  'user.delete',
  'role.delete',
  'finance.',
  'accounting.',
] as const

export function isSensitivePermission(name: string): boolean {
  return SENSITIVE_PERMISSION_PREFIXES.some(
    (p) => name === p || (p.endsWith('.') && name.startsWith(p)) || name.includes('.reverse') || name.includes('.post'),
  )
}
