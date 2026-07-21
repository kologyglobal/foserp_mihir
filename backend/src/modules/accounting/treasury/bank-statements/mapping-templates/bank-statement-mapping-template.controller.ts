import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../../types/request-context.js'
import { asyncHandler } from '../../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../../utils/response.js'
import * as service from './bank-statement-mapping-template.service.js'

export const listMappingTemplates = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listMappingTemplates(tenantId, req.query as never)
  return sendPaginated(
    res,
    'mapping templates listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getMappingTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getMappingTemplate(tenantId, id)
  return sendSuccess(res, 'mapping template fetched', item)
})

export const createMappingTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createMappingTemplate(req, tenantId, req.body)
  return sendCreated(res, 'mapping template created', item)
})

export const updateMappingTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateMappingTemplate(req, tenantId, id, req.body)
  return sendSuccess(res, 'mapping template updated', item)
})

export const activateMappingTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateMappingTemplate(req, tenantId, id, req.body.expectedUpdatedAt)
  return sendSuccess(res, 'mapping template activated', item)
})

export const deactivateMappingTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateMappingTemplate(req, tenantId, id, req.body.expectedUpdatedAt)
  return sendSuccess(res, 'mapping template deactivated', item)
})
