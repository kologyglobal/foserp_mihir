import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './opportunity.service.js'

export const listOpportunities = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listOpportunities(tenantId, req.query as never)
  sendPaginated(res, 'Opportunities retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getOpportunity(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Opportunity retrieved', data)
})

export const createOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createOpportunity(tenantId, userId, req.body)
  sendCreated(res, 'Opportunity created', data)
})

export const updateOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateOpportunity(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Opportunity updated', data)
})

export const deleteOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  await service.deleteOpportunity(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Opportunity deleted', null)
})

export const winOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.winOpportunity(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Opportunity won', data)
})

export const loseOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.loseOpportunity(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Opportunity lost', data)
})

export const reopenOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.reopenOpportunity(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Opportunity reopened', data)
})

export const assignOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.assignOpportunity(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Opportunity assigned', data)
})

export const moveOpportunityStage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.moveOpportunityStage(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Opportunity stage updated', data)
})

export const getStageHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getOpportunityStageHistory(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Opportunity stage history retrieved', data)
})

export const getAssignmentHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getOpportunityAssignmentHistory(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Opportunity assignment history retrieved', data)
})

export const getAmountHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getOpportunityAmountHistory(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Opportunity amount history retrieved', data)
})

export const getStatusHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getOpportunityStatusHistory(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Opportunity status history retrieved', data)
})
