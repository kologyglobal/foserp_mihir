import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './activity.service.js'

export const listActivities = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listActivities(tenantId, req.query as never)
  sendPaginated(res, 'Activities retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getActivity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getActivity(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Activity retrieved', data)
})

export const createActivity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createActivity(tenantId, userId, req.body)
  sendCreated(res, 'Activity created', data)
})

export const updateActivity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateActivity(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Activity updated', data)
})

export const deleteActivity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  await service.deleteActivity(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Activity deleted', null)
})

export const completeActivity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.completeActivity(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Activity completed', data)
})
