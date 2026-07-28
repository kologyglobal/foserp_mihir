import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { loadUserDataScope } from '../../access-scopes/scope.service.js'

export interface OrgScopeDims {
  legalEntityId?: string | null
  branchId?: string | null
}

/**
 * Prisma where fragment for CRM lists with optional LE/branch columns.
 * Fail-open when the user has no grants (unrestricted).
 * Restricted users see granted LE/branch rows **plus** null (legacy) rows until backfilled.
 */
export function crmOrgScopeWhere(scope: UserDataScope): {
  AND?: Array<Record<string, unknown>>
} {
  if (scope.unrestricted) return {}

  const and: Array<Record<string, unknown>> = []

  if (scope.legalEntities.length > 0) {
    const ids = scope.legalEntities.map((x) => x.legalEntityId)
    and.push({
      OR: [{ legalEntityId: null }, { legalEntityId: { in: ids } }],
    })
  }

  if (scope.branches.length > 0) {
    const ids = scope.branches.map((x) => x.branchId)
    and.push({
      OR: [{ branchId: null }, { branchId: { in: ids } }],
    })
  }

  // Warehouse-only grants do not constrain CRM commercial docs.
  if (and.length === 0) return {}
  return { AND: and }
}

export async function loadCrmOrgScopeWhere(tenantId: string, userId: string | undefined) {
  if (!userId) return {}
  const scope = await loadUserDataScope(tenantId, userId)
  return crmOrgScopeWhere(scope)
}

/** Default LE/branch for new CRM writes from the actor's scope grants. */
export async function defaultOrgDimsForUser(
  tenantId: string,
  userId: string | undefined,
): Promise<OrgScopeDims> {
  if (!userId) return { legalEntityId: null, branchId: null }
  const scope = await loadUserDataScope(tenantId, userId)
  if (scope.unrestricted) return { legalEntityId: null, branchId: null }

  const defaultLe =
    scope.legalEntities.find((x) => x.isDefault)?.legalEntityId ??
    scope.legalEntities[0]?.legalEntityId ??
    null
  const branchForLe = defaultLe
    ? scope.branches.find((b) => b.legalEntityId === defaultLe)?.branchId
    : undefined
  const branchId = branchForLe ?? scope.branches[0]?.branchId ?? null

  return { legalEntityId: defaultLe, branchId }
}
