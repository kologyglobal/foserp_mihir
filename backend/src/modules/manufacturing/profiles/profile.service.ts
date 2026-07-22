import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import * as repo from './profile.repository.js'
import type { CreateProfileInput, ListProfilesQuery, UpdateProfileInput } from './profile.schemas.js'

async function audit(
  req: Request,
  tenantId: string,
  entity: string,
  entityId: string,
  action: string,
  oldValues: unknown,
  newValues: unknown,
) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity,
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

export async function listProfiles(tenantId: string, query: ListProfilesQuery) {
  return repo.listProfiles(tenantId, query)
}

export async function getProfile(tenantId: string, profileId: string) {
  return repo.getProfile(tenantId, profileId)
}

export async function createProfile(req: Request, tenantId: string, input: CreateProfileInput) {
  const userId = req.context?.userId ?? ''
  const record = await repo.createProfile(tenantId, userId, input)
  await audit(req, tenantId, 'manufacturingProfile', record.id, 'CREATE', undefined, record)
  return record
}

export async function updateProfile(req: Request, tenantId: string, profileId: string, input: UpdateProfileInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getProfile(tenantId, profileId)
  const record = await repo.updateProfile(tenantId, userId, profileId, input)
  await audit(req, tenantId, 'manufacturingProfile', profileId, 'UPDATE', before, record)
  return record
}

export async function deleteProfile(req: Request, tenantId: string, profileId: string) {
  const before = await repo.getProfile(tenantId, profileId)
  const record = await repo.deleteProfile(tenantId, profileId)
  await audit(req, tenantId, 'manufacturingProfile', profileId, 'DELETE', before, record)
  return record
}

export async function activateProfile(req: Request, tenantId: string, profileId: string) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getProfile(tenantId, profileId)
  const record = await repo.setProfileActive(tenantId, userId, profileId, true)
  await audit(req, tenantId, 'manufacturingProfile', profileId, 'ACTIVATE', before, record)
  return record
}

export async function deactivateProfile(req: Request, tenantId: string, profileId: string) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getProfile(tenantId, profileId)
  const record = await repo.setProfileActive(tenantId, userId, profileId, false)
  await audit(req, tenantId, 'manufacturingProfile', profileId, 'DEACTIVATE', before, record)
  return record
}

export interface ProfileReadiness {
  ready: boolean
  checks: {
    hasDefaultBomVersion: boolean
    defaultBomVersionActive: boolean
    hasDefaultRoutingVersion: boolean
    defaultRoutingVersionActive: boolean
    hasProductionWarehouse: boolean
    hasWipWarehouse: boolean
    hasFinishedGoodsWarehouse: boolean
    hasScrapWarehouse: boolean
  }
  missing: string[]
}

export async function getProfileReadiness(tenantId: string, profileId: string): Promise<ProfileReadiness> {
  const { profile, defaultBomVersion, defaultRoutingVersion } = await repo.getProfileReadiness(tenantId, profileId)

  const missing: string[] = []

  const hasDefaultBomVersion = Boolean(profile.defaultBomVersionId)
  if (!hasDefaultBomVersion) missing.push('defaultBomVersionId is not set')
  const defaultBomVersionActive = defaultBomVersion?.status === 'ACTIVE'
  if (hasDefaultBomVersion && !defaultBomVersionActive) missing.push('defaultBomVersionId is not in ACTIVE status')

  const hasDefaultRoutingVersion = Boolean(profile.defaultRoutingVersionId)
  const executionRequiresRouting = profile.executionMode === 'DETAILED'
  if (executionRequiresRouting && !hasDefaultRoutingVersion) {
    missing.push('defaultRoutingVersionId is not set (required for DETAILED execution mode)')
  }
  const defaultRoutingVersionActive = defaultRoutingVersion?.status === 'ACTIVE'
  if (hasDefaultRoutingVersion && !defaultRoutingVersionActive) {
    missing.push('defaultRoutingVersionId is not in ACTIVE status')
  }

  const hasProductionWarehouse = Boolean(profile.productionWarehouseId)
  if (!hasProductionWarehouse) missing.push('productionWarehouseId is not set')

  const hasWipWarehouse = Boolean(profile.wipWarehouseId)
  if (profile.wipTrackingMethod === 'STOCKED_SEMI_FINISHED' || profile.wipTrackingMethod === 'BOTH') {
    if (!hasWipWarehouse) missing.push('wipWarehouseId is not set (required for this WIP tracking method)')
  }

  const hasFinishedGoodsWarehouse = Boolean(profile.finishedGoodsWarehouseId)
  if (!hasFinishedGoodsWarehouse) missing.push('finishedGoodsWarehouseId is not set')

  const hasScrapWarehouse = Boolean(profile.scrapWarehouseId)

  return {
    ready: missing.length === 0,
    checks: {
      hasDefaultBomVersion,
      defaultBomVersionActive,
      hasDefaultRoutingVersion,
      defaultRoutingVersionActive,
      hasProductionWarehouse,
      hasWipWarehouse,
      hasFinishedGoodsWarehouse,
      hasScrapWarehouse,
    },
    missing,
  }
}
