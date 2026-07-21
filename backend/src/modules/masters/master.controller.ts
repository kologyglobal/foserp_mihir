import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import { NotFoundError } from '../../utils/errors.js'
import { getMasterResource, masterPermission } from './master.registry.js'
import * as service from './master.service.js'

function resolveConfig(req: Request) {
  const resource = getRouteParam(req, 'resource')
  const config = getMasterResource(resource)
  if (!config) throw new NotFoundError(`Unknown master resource: ${resource}`)
  return config
}

export const listMasters = asyncHandler(async (req: Request, res: Response) => {
  const config = resolveConfig(req)
  const tenantId = getTenantId(req)
  const result = await service.listRecords(req, tenantId, config, req.query as never)
  return sendPaginated(
    res,
    `${config.slug} listed`,
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getMaster = asyncHandler(async (req: Request, res: Response) => {
  const config = resolveConfig(req)
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, config, id)
  return sendSuccess(res, `${config.slug} fetched`, item)
})

export const createMaster = asyncHandler(async (req: Request, res: Response) => {
  const config = resolveConfig(req)
  const tenantId = getTenantId(req)
  const item = await service.createRecord(req, tenantId, config, req.body as Record<string, unknown>)
  return sendCreated(res, `${config.slug} created`, item)
})

export const updateMaster = asyncHandler(async (req: Request, res: Response) => {
  const config = resolveConfig(req)
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, config, id, req.body as Record<string, unknown>)
  return sendSuccess(res, `${config.slug} updated`, item)
})

export const deleteMaster = asyncHandler(async (req: Request, res: Response) => {
  const config = resolveConfig(req)
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  await service.deleteRecord(req, tenantId, config, id)
  return sendSuccess(res, `${config.slug} deleted`, null)
})

export const activateMaster = asyncHandler(async (req: Request, res: Response) => {
  const config = resolveConfig(req)
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateRecord(req, tenantId, config, id)
  return sendSuccess(res, `${config.slug} activated`, item)
})

export const deactivateMaster = asyncHandler(async (req: Request, res: Response) => {
  const config = resolveConfig(req)
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateRecord(req, tenantId, config, id)
  return sendSuccess(res, `${config.slug} deactivated`, item)
})

export const listLookups = asyncHandler(async (req: Request, res: Response) => {
  const resource = getRouteParam(req, 'resource')
  const config = getMasterResource(resource)
  if (!config) {
    const { NotFoundError } = await import('../../utils/errors.js')
    throw new NotFoundError(`Unknown lookup resource: ${resource}`)
  }
  const tenantId = getTenantId(req)
  const extra: Record<string, unknown> = {}
  if (req.query.stateId) extra.stateId = String(req.query.stateId)
  if (req.query.warehouseId) extra.warehouseId = String(req.query.warehouseId)
  if (req.query.plantId && config.slug === 'warehouses') extra.plantId = String(req.query.plantId)
  if (req.query.storageLocationId && config.slug === 'bins') {
    extra.storageLocationId = String(req.query.storageLocationId)
  }
  const items = await service.listLookups(tenantId, config, extra)
  return sendSuccess(res, `${config.slug} lookups`, items)
})

export function permissionFor(config: ReturnType<typeof getMasterResource>, action: 'view' | 'create' | 'update' | 'delete') {
  if (!config) return 'master.view'
  return masterPermission(action, config.permissionKey)
}
