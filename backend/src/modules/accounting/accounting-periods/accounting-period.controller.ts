import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './accounting-period.service.js'

export const listPeriods = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRecords(req, tenantId, req.query as never)
  return sendPaginated(res, 'accounting periods listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const generatePeriods = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const items = await service.generateRecord(req, tenantId, req.body)
  return sendCreated(res, 'accounting periods generated', items)
})

export const getPeriod = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, id)
  return sendSuccess(res, 'accounting period fetched', item)
})

export const updatePeriod = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'accounting period updated', item)
})

export const markUnderReview = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.markUnderReviewRecord(req, tenantId, id)
  return sendSuccess(res, 'accounting period marked under review', item)
})

export const closePeriod = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.closeRecord(req, tenantId, id)
  return sendSuccess(res, 'accounting period closed', item)
})

export const reopenPeriod = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.reopenRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'accounting period reopened', item)
})
