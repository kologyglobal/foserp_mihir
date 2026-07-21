import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import {
  FixedAssetEditNotAllowedError,
  FixedAssetInvalidStatusError,
  FixedAssetValidationFailedError,
} from './fixed-assets.errors.js'
import * as repo from './fixed-assets.repository.js'
import { nextAssetNumber } from './fixed-asset-number.service.js'
import { serializeAsset } from './fixed-asset-serialize.js'
import type { CreateFixedAssetInput, ListFixedAssetsQueryInput, UpdateFixedAssetInput } from './fixed-assets.schemas.js'

function assertEditableStatus(status: string): void {
  if (status !== 'DRAFT' && status !== 'PENDING_CAPITALIZATION') {
    throw new FixedAssetEditNotAllowedError()
  }
}

export async function listAssets(req: Request, tenantId: string, query: ListFixedAssetsQueryInput) {
  const result = await repo.listAssets(tenantId, query)
  return {
    ...result,
    items: result.items.map((item) => serializeAsset(item, req)),
  }
}

export async function getAsset(req: Request, tenantId: string, id: string) {
  const asset = await repo.findAssetByIdOrThrow(tenantId, id)
  return serializeAsset(asset, req)
}

export async function createAsset(req: Request, tenantId: string, input: CreateFixedAssetInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const category = await repo.findCategoryByIdOrThrow(tenantId, input.categoryId)
  if (category.legalEntityId !== input.legalEntityId) {
    throw new FixedAssetValidationFailedError('Category does not belong to the selected legal entity')
  }
  if (!category.isActive) {
    throw new FixedAssetValidationFailedError('Category is not active')
  }

  const audit = auditFromRequest(req)
  const userId = req.context?.userId
  if (!userId) throw new FixedAssetValidationFailedError('User context required')

  const assetNumber = await nextAssetNumber(tenantId, input.legalEntityId)
  const asset = await repo.createAsset(tenantId, userId, assetNumber, {
    ...input,
    usefulLifeYears: input.usefulLifeYears ?? category.usefulLifeYears,
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'finance',
    entity: 'fixed_asset',
    entityId: asset.id,
    action: 'CREATE',
    newValues: { assetNumber: asset.assetNumber, name: asset.name },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  })

  return serializeAsset(asset, req)
}

export async function updateAsset(req: Request, tenantId: string, id: string, input: UpdateFixedAssetInput) {
  const existing = await repo.findAssetByIdOrThrow(tenantId, id)
  assertEditableStatus(existing.status)

  if (input.categoryId) {
    const category = await repo.findCategoryByIdOrThrow(tenantId, input.categoryId)
    if (category.legalEntityId !== existing.legalEntityId) {
      throw new FixedAssetValidationFailedError('Category does not belong to the asset legal entity')
    }
    if (!category.isActive) {
      throw new FixedAssetValidationFailedError('Category is not active')
    }
  }

  if (input.status && input.status !== 'DRAFT' && input.status !== 'PENDING_CAPITALIZATION') {
    throw new FixedAssetInvalidStatusError('Only Draft or Pending Capitalization status is allowed before capitalization')
  }

  const audit = auditFromRequest(req)
  const userId = req.context?.userId
  if (!userId) throw new FixedAssetValidationFailedError('User context required')

  const asset = await repo.updateAsset(tenantId, id, userId, input)

  await createAuditLog({
    tenantId,
    userId,
    module: 'finance',
    entity: 'fixed_asset',
    entityId: id,
    action: 'UPDATE',
    newValues: input,
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  })

  return serializeAsset(asset, req)
}
