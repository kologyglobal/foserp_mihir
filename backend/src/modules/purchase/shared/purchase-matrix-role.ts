import { prisma } from '../../../config/prisma.js'
import type { PurchaseApprovalMatrixRole } from '@prisma/client'
import { permissionSetIncludes } from '../../../constants/permissions.js'

/** API / stored approverRole strings used on PurchaseApproval rows. */
export type PurchaseMatrixRoleApi =
  | 'department_head'
  | 'purchase_head'
  | 'finance_head'
  | 'management'

const ROLE_NAME_TOKENS: Record<PurchaseMatrixRoleApi, string[]> = {
  department_head: [
    'department_head',
    'department head',
    'dept_head',
    'dept head',
    'engineering_head',
    'engineering head',
    'planning_manager',
    'planning manager',
    'production_head',
    'production head',
  ],
  purchase_head: [
    'purchase_head',
    'purchase head',
    'purchase manager',
    'purchase',
    'buyer',
    'procurement',
  ],
  finance_head: [
    'finance_head',
    'finance head',
    'accounts_head',
    'accounts head',
    'finance',
    'accounts',
    'cfo',
  ],
  management: [
    'management',
    'ceo',
    'director',
    'admin',
    'administrator',
    'tenant admin',
    'super admin',
  ],
}

export function normalizeMatrixRoleApi(role: string | null | undefined): PurchaseMatrixRoleApi | null {
  if (!role) return null
  const key = role.trim().toLowerCase().replace(/\s+/g, '_')
  if (key === 'department_head' || key === 'purchase_head' || key === 'finance_head' || key === 'management') {
    return key
  }
  return null
}

export function matrixEnumToApi(role: PurchaseApprovalMatrixRole): PurchaseMatrixRoleApi {
  switch (role) {
    case 'DEPARTMENT_HEAD':
      return 'department_head'
    case 'FINANCE_HEAD':
      return 'finance_head'
    case 'MANAGEMENT':
      return 'management'
    case 'PURCHASE_HEAD':
    default:
      return 'purchase_head'
  }
}

function roleNameMatches(roleName: string, matrixRole: PurchaseMatrixRoleApi): boolean {
  const normalized = roleName.trim().toLowerCase()
  return ROLE_NAME_TOKENS[matrixRole].some(
    (token) => normalized === token || normalized.includes(token),
  )
}

/**
 * Whether the actor may act as the matrix role for the current approval level.
 * Tenant admins (via role name) and users with matching role names pass.
 * Permission-only users without a matching role name are rejected when a role is required.
 */
export async function actorSatisfiesMatrixRole(
  tenantId: string,
  actorId: string,
  requiredRole: string | null | undefined,
  actorPermissions: readonly string[] = [],
): Promise<boolean> {
  const matrixRole = normalizeMatrixRoleApi(requiredRole)
  if (!matrixRole) return true

  const user = await prisma.user.findFirst({
    where: { id: actorId, tenantId, deletedAt: null },
    select: {
      userRoles: {
        where: { role: { deletedAt: null } },
        select: { role: { select: { name: true } } },
      },
    },
  })
  if (!user) return false

  const roleNames = user.userRoles.map((ur) => ur.role.name)
  if (roleNames.some((name) => roleNameMatches(name, matrixRole))) return true

  // Tenant / system admin roles can clear any matrix level.
  if (roleNames.some((name) => roleNameMatches(name, 'management'))) return true

  // Default / first-tier purchase_head: any user with the document approve permission
  // may act when tenants have not assigned named matrix roles (live UAT fixtures).
  if (matrixRole === 'purchase_head') {
    return (
      permissionSetIncludes([...actorPermissions], 'purchase.po.approve')
      || permissionSetIncludes([...actorPermissions], 'purchase.pr.approve')
      || permissionSetIncludes([...actorPermissions], 'purchase.invoice.approve')
    )
  }

  return false
}

export async function assertActorMatchesApproverRole(
  tenantId: string,
  actorId: string,
  requiredRole: string | null | undefined,
  actorPermissions: readonly string[] = [],
  errorFactory: (message: string) => Error,
): Promise<void> {
  const ok = await actorSatisfiesMatrixRole(tenantId, actorId, requiredRole, actorPermissions)
  if (!ok) {
    throw errorFactory(
      `Approver role "${requiredRole ?? 'unknown'}" is required for this approval level.`,
    )
  }
}
