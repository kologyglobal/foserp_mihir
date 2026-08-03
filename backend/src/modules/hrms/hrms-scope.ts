import type { Request } from 'express'
import { loadUserDataScope, scopeAllows, type UserDataScope } from '../access-scopes/scope.service.js'
import { AuthorizationError } from '../../utils/errors.js'

export interface HrOrgDims {
  legalEntityId?: string | null
  branchId?: string | null
}

/**
 * Fail-closed HR scope loader: unrestricted (empty grants) users get full access;
 * restricted users are constrained to their granted legal entities / branches.
 */
export async function loadHrScope(req: Request): Promise<UserDataScope> {
  const tenantId = req.context?.tenantId
  const userId = req.context?.userId
  if (!tenantId || !userId) {
    return { unrestricted: true, legalEntities: [], branches: [], warehouses: [] }
  }
  return loadUserDataScope(tenantId, userId)
}

/** Prisma where fragment restricting HR employee/designation lists to the caller's scope. */
export function hrScopeWhere(scope: UserDataScope): { AND?: Array<Record<string, unknown>> } {
  if (scope.unrestricted) return {}
  const and: Array<Record<string, unknown>> = []
  if (scope.legalEntities.length > 0) {
    and.push({ legalEntityId: { in: scope.legalEntities.map((x) => x.legalEntityId) } })
  }
  if (scope.branches.length > 0) {
    and.push({ branchId: { in: scope.branches.map((x) => x.branchId) } })
  }
  if (and.length === 0) return {}
  return { AND: and }
}

/** Throws 403 when the caller's scope does not cover the given legal entity / branch. */
export function assertHrAccess(scope: UserDataScope, dims: HrOrgDims): void {
  if (!scopeAllows(scope, dims)) {
    throw new AuthorizationError('You do not have HR access to this legal entity / branch')
  }
}

/**
 * LE-only scope for HR config entities without branchId (salary components/structures).
 * Unrestricted → no filter; restricted → tenant-wide (null LE) or granted legal entities.
 */
export function hrLegalEntityScopeWhere(scope: UserDataScope): {
  OR?: Array<{ legalEntityId: null } | { legalEntityId: { in: string[] } }>
} {
  if (scope.unrestricted) return {}
  const leIds = scope.legalEntities.map((x) => x.legalEntityId)
  if (leIds.length === 0) return {}
  return { OR: [{ legalEntityId: null }, { legalEntityId: { in: leIds } }] }
}
