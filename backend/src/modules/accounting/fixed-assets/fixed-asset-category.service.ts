import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { ValidationError } from '../../../utils/errors.js'
import { assertAccountForMapping, getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import { FixedAssetCategoryInUseError, FixedAssetValidationFailedError } from './fixed-assets.errors.js'
import * as repo from './fixed-assets.repository.js'
import { serializeCategory } from './fixed-asset-serialize.js'
import type { CreateFixedAssetCategoryInput, UpdateFixedAssetCategoryInput } from './fixed-assets.schemas.js'

async function validateCategoryAccounts(
  tenantId: string,
  legalEntityId: string,
  accountIds: { assetAccountId: string; accumDepAccountId: string; depExpenseAccountId: string },
): Promise<void> {
  const [assetAccount, accumAccount, expenseAccount] = await Promise.all([
    repo.findAccountInLegalEntity(tenantId, legalEntityId, accountIds.assetAccountId),
    repo.findAccountInLegalEntity(tenantId, legalEntityId, accountIds.accumDepAccountId),
    repo.findAccountInLegalEntity(tenantId, legalEntityId, accountIds.depExpenseAccountId),
  ])

  if (!assetAccount || !accumAccount || !expenseAccount) {
    throw new FixedAssetValidationFailedError('One or more GL accounts were not found in the legal entity')
  }

  for (const account of [assetAccount, accumAccount, expenseAccount]) {
    try {
      assertAccountForMapping(account)
    } catch (error) {
      throw new FixedAssetValidationFailedError(
        error instanceof ValidationError ? error.message : 'Invalid GL account for category mapping',
      )
    }
  }
}

export async function listCategories(_req: Request, tenantId: string, query: Parameters<typeof repo.listCategories>[1]) {
  const result = await repo.listCategories(tenantId, query)
  return {
    ...result,
    items: result.items.map(serializeCategory),
  }
}

export async function getCategory(_req: Request, tenantId: string, id: string) {
  const category = await repo.findCategoryByIdOrThrow(tenantId, id)
  return serializeCategory(category)
}

export async function createCategory(req: Request, tenantId: string, input: CreateFixedAssetCategoryInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  await validateCategoryAccounts(tenantId, input.legalEntityId, input)

  const audit = auditFromRequest(req)
  const userId = req.context?.userId
  if (!userId) throw new FixedAssetValidationFailedError('User context required')

  const category = await repo.createCategory(tenantId, userId, input)

  await createAuditLog({
    tenantId,
    userId,
    module: 'finance',
    entity: 'fixed_asset_category',
    entityId: category.id,
    action: 'CREATE',
    newValues: category,
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  })

  return serializeCategory(category)
}

export async function updateCategory(req: Request, tenantId: string, id: string, input: UpdateFixedAssetCategoryInput) {
  const existing = await repo.findCategoryByIdOrThrow(tenantId, id)
  const accountIds = {
    assetAccountId: input.assetAccountId ?? existing.assetAccountId,
    accumDepAccountId: input.accumDepAccountId ?? existing.accumDepAccountId,
    depExpenseAccountId: input.depExpenseAccountId ?? existing.depExpenseAccountId,
  }
  await validateCategoryAccounts(tenantId, existing.legalEntityId, accountIds)

  if (input.isActive === false) {
    const inUse = await repo.countAssetsInCategory(tenantId, id)
    if (inUse > 0) throw new FixedAssetCategoryInUseError()
  }

  const audit = auditFromRequest(req)
  const userId = req.context?.userId
  if (!userId) throw new FixedAssetValidationFailedError('User context required')

  const category = await repo.updateCategory(tenantId, id, userId, input)

  await createAuditLog({
    tenantId,
    userId,
    module: 'finance',
    entity: 'fixed_asset_category',
    entityId: id,
    action: 'UPDATE',
    newValues: category,
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  })

  return serializeCategory(category)
}
