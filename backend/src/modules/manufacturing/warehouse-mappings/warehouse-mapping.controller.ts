import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './warehouse-mapping.service.js'
import type {
  CreateWarehouseMappingInput,
  ListWarehouseMappingsQuery,
  ResolveWarehouseMappingQuery,
  UpdateWarehouseMappingInput,
} from './warehouse-mapping.schemas.js'

export const listMappings = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listMappings(tenantId, req.query as unknown as ListWarehouseMappingsQuery)
  return sendPaginated(
    res,
    'Warehouse mappings listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getMapping(tenantId, id)
  return sendSuccess(res, 'Warehouse mapping fetched', item)
})

export const createMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createMapping(req, tenantId, req.body as CreateWarehouseMappingInput)
  return sendCreated(res, 'Warehouse mapping created', item)
})

export const updateMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateMapping(req, tenantId, id, req.body as UpdateWarehouseMappingInput)
  return sendSuccess(res, 'Warehouse mapping updated', item)
})

export const deleteMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  await service.deleteMapping(req, tenantId, id)
  return sendSuccess(res, 'Warehouse mapping deleted', null)
})

export const activateMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateMapping(req, tenantId, id)
  return sendSuccess(res, 'Warehouse mapping activated', item)
})

export const deactivateMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateMapping(req, tenantId, id)
  return sendSuccess(res, 'Warehouse mapping deactivated', item)
})

export const getMappingReadiness = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await service.getMappingReadinessById(tenantId, id)
  return sendSuccess(res, 'Warehouse mapping readiness fetched', result)
})

export const getTenantReadiness = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ResolveWarehouseMappingQuery
  const result = await service.getMappingReadiness(tenantId, {
    plantCode: query.plantCode,
    profileId: query.profileId,
  })
  return sendSuccess(res, 'Warehouse mapping readiness fetched', result)
})

export const resolveMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ResolveWarehouseMappingQuery
  const result = await service.resolveWarehouseMapping(tenantId, query.plantCode, query.profileId)
  return sendSuccess(res, 'Warehouse mapping resolved', result)
})
