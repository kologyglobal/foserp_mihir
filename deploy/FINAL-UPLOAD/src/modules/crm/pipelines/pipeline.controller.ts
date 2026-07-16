import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './pipeline.service.js'

export const listPipelines = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listPipelines(tenantId, req.query as never)
  sendPaginated(res, 'Pipelines retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getPipeline = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getPipeline(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Pipeline retrieved', data)
})

export const createPipeline = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createPipeline(tenantId, userId, req.body)
  sendCreated(res, 'Pipeline created', data)
})

export const updatePipeline = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updatePipeline(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Pipeline updated', data)
})

export const deletePipeline = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  await service.deletePipeline(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Pipeline deleted', null)
})
