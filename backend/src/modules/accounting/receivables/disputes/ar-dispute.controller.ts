import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListArDisputesQueryInput } from './ar-dispute.schemas.js'
import * as service from './ar-dispute.service.js'

export const listArDisputes = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListArDisputesQueryInput
  const result = await service.listArDisputes(req, tenantId, {
    ...query,
    limit: query.limit ?? query.pageSize,
  })
  return sendPaginated(
    res,
    'AR disputes listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getArDispute = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getArDispute(req, tenantId, id)
  return sendSuccess(res, 'AR dispute fetched', item)
})

export const createArDispute = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createArDispute(req, tenantId, req.body)
  return sendCreated(res, 'AR dispute created', item)
})

export const updateArDispute = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateArDispute(req, tenantId, id, req.body)
  return sendSuccess(res, 'AR dispute updated', item)
})

export const transitionArDispute = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.transitionArDispute(req, tenantId, id, req.body)
  return sendSuccess(res, 'AR dispute status updated', item)
})

export const softDeleteArDispute = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.softDeleteArDispute(req, tenantId, id)
  return sendSuccess(res, 'AR dispute deleted', item)
})
