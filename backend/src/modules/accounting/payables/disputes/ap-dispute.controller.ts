import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListApDisputesQueryInput } from './ap-dispute.schemas.js'
import * as service from './ap-dispute.service.js'

export const listApDisputes = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListApDisputesQueryInput
  const result = await service.listApDisputes(req, tenantId, {
    ...query,
    limit: query.limit ?? query.pageSize,
  })
  return sendPaginated(
    res,
    'AP disputes listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getApDispute = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.getApDispute(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'AP dispute fetched', item)
})

export const createApDispute = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.createApDispute(req, getTenantId(req), req.body)
  return sendCreated(res, 'AP dispute created', item)
})

export const updateApDispute = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.updateApDispute(req, getTenantId(req), getRouteParam(req, 'id'), req.body)
  return sendSuccess(res, 'AP dispute updated', item)
})

export const transitionApDispute = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.transitionApDispute(req, getTenantId(req), getRouteParam(req, 'id'), req.body)
  return sendSuccess(res, 'AP dispute status updated', item)
})

export const softDeleteApDispute = asyncHandler(async (req: Request, res: Response) => {
  const item = await service.softDeleteApDispute(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'AP dispute deleted', item)
})
