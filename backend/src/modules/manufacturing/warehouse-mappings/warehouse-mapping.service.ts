import type { ManufacturingProfile, ManufacturingWarehouseMapping } from '@prisma/client'
import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, ValidationError } from '../../../utils/errors.js'
import { assertActiveWarehouse } from '../shared/manufacturing.helpers.js'
import * as repo from './warehouse-mapping.repository.js'
import type {
  CreateWarehouseMappingInput,
  ListWarehouseMappingsQuery,
  UpdateWarehouseMappingInput,
} from './warehouse-mapping.schemas.js'

async function audit(
  req: Request,
  tenantId: string,
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
    entity: 'manufacturingWarehouseMapping',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

const WAREHOUSE_FIELDS = [
  'rawMaterialWarehouseId',
  'productionIssueWarehouseId',
  'wipWarehouseId',
  'finishedGoodsWarehouseId',
  'qualityHoldWarehouseId',
  'reworkWarehouseId',
  'scrapWarehouseId',
  'jobWorkWarehouseId',
  'defaultReturnWarehouseId',
] as const

type WarehouseField = (typeof WAREHOUSE_FIELDS)[number]

async function assertMappingWarehouses(
  tenantId: string,
  input: Partial<Record<WarehouseField, string | null | undefined>>,
) {
  for (const field of WAREHOUSE_FIELDS) {
    const id = input[field]
    if (id) await assertActiveWarehouse(tenantId, id)
  }
}

async function enforceSingleTenantDefault(
  tenantId: string,
  isDefault: boolean,
  plantCode: string | null | undefined,
  excludeId?: string,
) {
  if (!isDefault) return
  // Tenant-wide default: plantCode null + isDefault. MySQL unique allows multiple NULL plantCodes.
  if (plantCode != null && plantCode !== '') return
  const conflict = await repo.findConflictingTenantDefault(tenantId, excludeId)
  if (conflict) {
    throw new ConflictError(
      'A tenant default warehouse mapping already exists (isDefault=true with null plantCode)',
    )
  }
}

export async function listMappings(tenantId: string, query: ListWarehouseMappingsQuery) {
  return repo.listMappings(tenantId, query)
}

export async function getMapping(tenantId: string, id: string) {
  return repo.getMapping(tenantId, id)
}

export async function createMapping(req: Request, tenantId: string, input: CreateWarehouseMappingInput) {
  const userId = req.context?.userId ?? ''
  await assertMappingWarehouses(tenantId, input)
  await enforceSingleTenantDefault(tenantId, input.isDefault, input.plantCode ?? null)
  const record = await repo.createMapping(tenantId, userId, input)
  await audit(req, tenantId, record.id, 'CREATE', undefined, record)
  return record
}

export async function updateMapping(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateWarehouseMappingInput,
) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getMapping(tenantId, id)
  await assertMappingWarehouses(tenantId, input)
  const nextIsDefault = input.isDefault ?? before.isDefault
  const nextPlantCode = input.plantCode !== undefined ? input.plantCode : before.plantCode
  await enforceSingleTenantDefault(tenantId, nextIsDefault, nextPlantCode, id)
  const record = await repo.updateMapping(tenantId, userId, id, input)
  await audit(req, tenantId, id, 'UPDATE', before, record)
  return record
}

export async function deleteMapping(req: Request, tenantId: string, id: string) {
  const before = await repo.getMapping(tenantId, id)
  const record = await repo.deleteMapping(tenantId, id)
  await audit(req, tenantId, id, 'DELETE', before, record)
  return record
}

export async function activateMapping(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getMapping(tenantId, id)
  const record = await repo.setMappingActive(tenantId, userId, id, true)
  await audit(req, tenantId, id, 'ACTIVATE', before, record)
  return record
}

export async function deactivateMapping(req: Request, tenantId: string, id: string) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getMapping(tenantId, id)
  const record = await repo.setMappingActive(tenantId, userId, id, false)
  await audit(req, tenantId, id, 'DEACTIVATE', before, record)
  return record
}

export interface WarehouseMappingReadiness {
  ready: boolean
  mappingId: string | null
  source: 'MAPPING' | 'PROFILE_FALLBACK' | 'NONE'
  checks: {
    hasRawMaterialWarehouse: boolean
    hasProductionIssueWarehouse: boolean
    hasWipWarehouse: boolean
    hasFinishedGoodsWarehouse: boolean
    hasQualityHoldWarehouse: boolean
    hasReworkWarehouse: boolean
    hasScrapWarehouse: boolean
    hasJobWorkWarehouse: boolean
    hasDefaultReturnWarehouse: boolean
  }
  missing: string[]
}

function readinessFromResolved(resolved: ResolvedWarehouseMapping | null): WarehouseMappingReadiness {
  if (!resolved) {
    return {
      ready: false,
      mappingId: null,
      source: 'NONE',
      checks: {
        hasRawMaterialWarehouse: false,
        hasProductionIssueWarehouse: false,
        hasWipWarehouse: false,
        hasFinishedGoodsWarehouse: false,
        hasQualityHoldWarehouse: false,
        hasReworkWarehouse: false,
        hasScrapWarehouse: false,
        hasJobWorkWarehouse: false,
        hasDefaultReturnWarehouse: false,
      },
      missing: [
        'rawMaterialWarehouseId',
        'finishedGoodsWarehouseId',
        'wipWarehouseId',
        'productionIssueWarehouseId',
      ],
    }
  }

  const checks = {
    hasRawMaterialWarehouse: Boolean(resolved.rawMaterialWarehouseId),
    hasProductionIssueWarehouse: Boolean(resolved.productionIssueWarehouseId),
    hasWipWarehouse: Boolean(resolved.wipWarehouseId),
    hasFinishedGoodsWarehouse: Boolean(resolved.finishedGoodsWarehouseId),
    hasQualityHoldWarehouse: Boolean(resolved.qualityHoldWarehouseId),
    hasReworkWarehouse: Boolean(resolved.reworkWarehouseId),
    hasScrapWarehouse: Boolean(resolved.scrapWarehouseId),
    hasJobWorkWarehouse: Boolean(resolved.jobWorkWarehouseId),
    hasDefaultReturnWarehouse: Boolean(resolved.defaultReturnWarehouseId),
  }

  const missing: string[] = []
  if (!checks.hasRawMaterialWarehouse) missing.push('rawMaterialWarehouseId is not set')
  if (!checks.hasFinishedGoodsWarehouse) missing.push('finishedGoodsWarehouseId is not set')
  if (!checks.hasWipWarehouse) missing.push('wipWarehouseId is not set')
  if (!checks.hasProductionIssueWarehouse) missing.push('productionIssueWarehouseId is not set')
  if (!checks.hasQualityHoldWarehouse) missing.push('qualityHoldWarehouseId is not set')
  if (!checks.hasScrapWarehouse) missing.push('scrapWarehouseId is not set')
  if (!checks.hasReworkWarehouse) missing.push('reworkWarehouseId is not set')
  if (!checks.hasDefaultReturnWarehouse) missing.push('defaultReturnWarehouseId is not set')

  // Ready when required FG + RM + WIP are present (optional roles listed as missing but not blocking).
  const ready =
    checks.hasRawMaterialWarehouse && checks.hasFinishedGoodsWarehouse && checks.hasWipWarehouse

  return {
    ready,
    mappingId: resolved.mappingId,
    source: resolved.source,
    checks,
    missing,
  }
}

export async function getMappingReadiness(
  tenantId: string,
  options?: { plantCode?: string; profileId?: string },
): Promise<WarehouseMappingReadiness> {
  const resolved = await resolveWarehouseMapping(tenantId, options?.plantCode, options?.profileId)
  return readinessFromResolved(resolved)
}

export async function getMappingReadinessById(tenantId: string, id: string): Promise<WarehouseMappingReadiness> {
  const row = await repo.getMapping(tenantId, id)
  return readinessFromResolved(fromMappingRow(row))
}

export type WarehouseMappingSource = 'MAPPING' | 'PROFILE_FALLBACK'

export interface ResolvedWarehouseMapping {
  source: WarehouseMappingSource
  mappingId: string | null
  profileId: string | null
  plantCode: string | null
  rawMaterialWarehouseId: string | null
  productionIssueWarehouseId: string | null
  wipWarehouseId: string | null
  finishedGoodsWarehouseId: string | null
  qualityHoldWarehouseId: string | null
  reworkWarehouseId: string | null
  scrapWarehouseId: string | null
  jobWorkWarehouseId: string | null
  defaultReturnWarehouseId: string | null
  isDefault: boolean
}

function fromMappingRow(row: ManufacturingWarehouseMapping): ResolvedWarehouseMapping {
  return {
    source: 'MAPPING',
    mappingId: row.id,
    profileId: null,
    plantCode: row.plantCode,
    rawMaterialWarehouseId: row.rawMaterialWarehouseId,
    productionIssueWarehouseId: row.productionIssueWarehouseId,
    wipWarehouseId: row.wipWarehouseId,
    finishedGoodsWarehouseId: row.finishedGoodsWarehouseId,
    qualityHoldWarehouseId: row.qualityHoldWarehouseId,
    reworkWarehouseId: row.reworkWarehouseId,
    scrapWarehouseId: row.scrapWarehouseId,
    jobWorkWarehouseId: row.jobWorkWarehouseId,
    defaultReturnWarehouseId: row.defaultReturnWarehouseId,
    isDefault: row.isDefault,
  }
}

function fromProfile(profile: ManufacturingProfile): ResolvedWarehouseMapping {
  const productionWh = profile.productionWarehouseId
  return {
    source: 'PROFILE_FALLBACK',
    mappingId: null,
    profileId: profile.id,
    plantCode: profile.plantCode,
    rawMaterialWarehouseId: productionWh,
    productionIssueWarehouseId: productionWh,
    wipWarehouseId: profile.wipWarehouseId,
    finishedGoodsWarehouseId: profile.finishedGoodsWarehouseId,
    qualityHoldWarehouseId: profile.qualityHoldWarehouseId,
    reworkWarehouseId: null,
    scrapWarehouseId: profile.scrapWarehouseId,
    jobWorkWarehouseId: null,
    defaultReturnWarehouseId: productionWh,
    isDefault: false,
  }
}

/**
 * Resolve warehouse roles for a tenant/plant:
 * 1. Active mapping with matching plantCode
 * 2. Active isDefault mapping
 * 3. ManufacturingProfile warehouses (plant match, else any active with warehouses)
 */
export async function resolveWarehouseMapping(
  tenantId: string,
  plantCode?: string,
  profileId?: string,
): Promise<ResolvedWarehouseMapping | null> {
  if (plantCode) {
    const byPlant = await repo.findByPlantCode(tenantId, plantCode)
    if (byPlant) return fromMappingRow(byPlant)
  }

  const defaultMapping = await repo.findDefault(tenantId)
  if (defaultMapping) return fromMappingRow(defaultMapping)

  const profile = await repo.findProfileFallback(tenantId, plantCode, profileId)
  if (profile) {
    if (!profile.finishedGoodsWarehouseId && !profile.productionWarehouseId) {
      return null
    }
    return fromProfile(profile)
  }

  return null
}

export async function resolveMappingOrThrow(
  tenantId: string,
  plantCode?: string,
  profileId?: string,
): Promise<ResolvedWarehouseMapping> {
  const resolved = await resolveWarehouseMapping(tenantId, plantCode, profileId)
  if (!resolved) {
    throw new ValidationError(
      'No manufacturing warehouse mapping found (plant override, tenant default, or profile fallback)',
    )
  }
  return resolved
}
