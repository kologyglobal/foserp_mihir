/**
 * Thin location resolver — finance Branch (invoice branchId).
 * Warehouse/plant lookups stay on master lookup routers; this is the accounting boundary.
 */
import { prisma } from '../../../../config/database.js'
import { NotFoundError } from '../../../../utils/errors.js'

export class AccountingBranchNotFoundError extends NotFoundError {
  constructor(message = 'Branch not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'ACCOUNTING_BRANCH_NOT_FOUND' })
  }
}

export interface AccountingBranchLookup {
  id: string
  legalEntityId: string
  code: string
  name: string
  branchType: string | null
  isActive: boolean
}

export async function resolveBranch(
  tenantId: string,
  legalEntityId: string,
  branchId: string,
): Promise<AccountingBranchLookup | null> {
  const row = await prisma.branch.findFirst({
    where: { id: branchId, tenantId, legalEntityId },
    select: {
      id: true,
      legalEntityId: true,
      code: true,
      name: true,
      branchType: true,
      isActive: true,
    },
  })
  if (!row) return null
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    code: row.code,
    name: row.name,
    branchType: row.branchType,
    isActive: row.isActive,
  }
}

export async function requireActiveBranch(
  tenantId: string,
  legalEntityId: string,
  branchId: string,
): Promise<AccountingBranchLookup> {
  const branch = await resolveBranch(tenantId, legalEntityId, branchId)
  if (!branch) throw new AccountingBranchNotFoundError()
  if (!branch.isActive) {
    throw new AccountingBranchNotFoundError('Branch is inactive')
  }
  return branch
}
