import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './parameter.service.js'
import type { CreateParameterInput, ListParametersQuery, UpdateParameterInput } from './parameter.schemas.js'

export const listParameters = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listParameters(tenantId, req.query as unknown as ListParametersQuery)
  return sendPaginated(
    res,
    'QC parameters listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getParameter = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.getParameter(tenantId, id)
  return sendSuccess(res, 'QC parameter fetched', row)
})

export const createParameter = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const row = await service.createParameter(req, tenantId, req.body as CreateParameterInput)
  return sendCreated(res, 'QC parameter created', row)
})

export const updateParameter = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.updateParameter(req, tenantId, id, req.body as UpdateParameterInput)
  return sendSuccess(res, 'QC parameter updated', row)
})

export const deactivateParameter = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.deactivateParameter(req, tenantId, id)
  return sendSuccess(res, 'QC parameter deactivated', row)
})
