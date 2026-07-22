import type { Request } from 'express'
import type { FixedAssetTransfer, FixedAssetTransferStatus } from '@prisma/client'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import {
  FixedAssetInvalidStatusError,
  FixedAssetNotFoundError,
  FixedAssetStaleVersionError,
  FixedAssetValidationFailedError,
} from './fixed-assets.errors.js'
import * as repo from './fixed-assets.repository.js'
import { nextTransferNumber } from './fixed-asset-number.service.js'
import type {
  CompleteFixedAssetTransferInput,
  CreateFixedAssetTransferInput,
  ListFixedAssetTransfersQueryInput,
} from './fixed-assets.schemas.js'
import type { FixedAssetTransferDto, FixedAssetTransferStatusApi } from './fixed-assets.types.js'

const TRANSFERABLE = ['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'] as const

const STATUS_LABELS: Record<FixedAssetTransferStatus, FixedAssetTransferStatusApi> = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function assertTransferPermission(req: Request): void {
  if (!hasPerm(req, 'finance.fa.transfer')) {
    throw new AuthorizationError('Missing permission: finance.fa.transfer')
  }
}

function serializeTransfer(
  row: FixedAssetTransfer & { asset?: { assetNumber: string; name: string } },
): FixedAssetTransferDto {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    assetId: row.assetId,
    assetNumber: row.asset?.assetNumber ?? '',
    assetName: row.asset?.name ?? '',
    transferNumber: row.transferNumber,
    transferDate: row.transferDate.toISOString().slice(0, 10),
    status: STATUS_LABELS[row.status],
    fromLocation: row.fromLocation,
    fromPlant: row.fromPlant,
    fromDepartment: row.fromDepartment,
    fromCustodian: row.fromCustodian,
    toLocation: row.toLocation,
    toPlant: row.toPlant,
    toDepartment: row.toDepartment,
    toCustodian: row.toCustodian,
    reason: row.reason,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function assertDestinationProvided(input: CreateFixedAssetTransferInput): void {
  if (!input.toLocation && !input.toPlant && !input.toDepartment && !input.toCustodian) {
    throw new FixedAssetValidationFailedError('At least one destination field is required')
  }
}

export async function listTransfers(
  req: Request,
  tenantId: string,
  query: ListFixedAssetTransfersQueryInput,
) {
  if (!hasPerm(req, 'finance.fa.view') && !hasPerm(req, 'finance.fa.transfer')) {
    throw new AuthorizationError('Missing permission: finance.fa.view')
  }
  const result = await repo.listTransfers(tenantId, query)
  return {
    items: result.items.map(serializeTransfer),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  }
}

export async function getTransfer(req: Request, tenantId: string, id: string): Promise<FixedAssetTransferDto> {
  if (!hasPerm(req, 'finance.fa.view') && !hasPerm(req, 'finance.fa.transfer')) {
    throw new AuthorizationError('Missing permission: finance.fa.view')
  }
  const row = await repo.findTransferByIdOrThrow(tenantId, id)
  return serializeTransfer(row)
}

export async function createTransfer(
  req: Request,
  tenantId: string,
  input: CreateFixedAssetTransferInput,
): Promise<FixedAssetTransferDto> {
  assertTransferPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  assertDestinationProvided(input)

  const asset = await repo.findAssetByIdOrThrow(tenantId, input.assetId)
  if (asset.legalEntityId !== input.legalEntityId) {
    throw new FixedAssetValidationFailedError('Asset does not belong to the specified legal entity')
  }
  if (!TRANSFERABLE.includes(asset.status as (typeof TRANSFERABLE)[number])) {
    throw new FixedAssetInvalidStatusError('Only active, idle, or fully depreciated assets can be transferred')
  }

  const transferNumber = await nextTransferNumber(tenantId, input.legalEntityId)
  const transferDate = parseDateOnly(input.transferDate ?? new Date().toISOString().slice(0, 10))

  const row = await repo.createTransfer({
    tenantId,
    legalEntityId: input.legalEntityId,
    assetId: asset.id,
    transferNumber,
    transferDate,
    fromLocation: asset.location,
    fromPlant: asset.plant,
    fromDepartment: asset.department,
    fromCustodian: asset.custodian,
    toLocation: input.toLocation ?? null,
    toPlant: input.toPlant ?? null,
    toDepartment: input.toDepartment ?? null,
    toCustodian: input.toCustodian ?? null,
    reason: input.reason.trim(),
    createdById: userId,
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'finance',
    entity: 'fixed_asset_transfer',
    entityId: row.id,
    action: 'FIXED_ASSET_TRANSFER_CREATED',
    newValues: { transferNumber, assetId: asset.id },
    ipAddress: auditFromRequest(req).ipAddress ?? null,
    userAgent: auditFromRequest(req).userAgent ?? null,
  })

  return serializeTransfer(row)
}

export async function completeTransfer(
  req: Request,
  tenantId: string,
  id: string,
  body: CompleteFixedAssetTransferInput,
): Promise<FixedAssetTransferDto> {
  assertTransferPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const row = await repo.findTransferByIdOrThrow(tenantId, id)
  if (row.status === 'COMPLETED') {
    return serializeTransfer(row)
  }
  if (row.status !== 'DRAFT') {
    throw new FixedAssetInvalidStatusError('Only draft transfers can be completed')
  }

  const completed = await repo.completeTransfer({
    tenantId,
    transferId: id,
    userId,
    expectedUpdatedAt: body.expectedUpdatedAt,
    assetExpectedUpdatedAt: body.assetExpectedUpdatedAt,
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'finance',
    entity: 'fixed_asset_transfer',
    entityId: id,
    action: 'FIXED_ASSET_TRANSFER_COMPLETED',
    newValues: { transferNumber: completed.transferNumber },
    ipAddress: auditFromRequest(req).ipAddress ?? null,
    userAgent: auditFromRequest(req).userAgent ?? null,
  })

  return serializeTransfer(completed)
}

export { FixedAssetNotFoundError, FixedAssetStaleVersionError }
