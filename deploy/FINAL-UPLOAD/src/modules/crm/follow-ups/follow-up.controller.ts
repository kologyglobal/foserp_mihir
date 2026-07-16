import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './follow-up.service.js'

export const listFollowUps = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const result = await service.listFollowUps(tenantId, req.query as never, userId)
  sendPaginated(res, 'Follow-ups retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getFollowUp(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Follow-up retrieved', data)
})

export const createFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createFollowUp(tenantId, userId, req.body)
  sendCreated(res, 'Follow-up created', data)
})

export const updateFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateFollowUp(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Follow-up updated', data)
})

export const completeFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.completeFollowUp(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Follow-up completed', data)
})

export const rescheduleFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.rescheduleFollowUp(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Follow-up rescheduled', data)
})

export const snoozeFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.snoozeFollowUp(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Follow-up snoozed', data)
})

export const cancelFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.cancelFollowUp(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Follow-up cancelled', data)
})

export const deleteFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  await service.deleteFollowUp(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Follow-up deleted', null)
})
