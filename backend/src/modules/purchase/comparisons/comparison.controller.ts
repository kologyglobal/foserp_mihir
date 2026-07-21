import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './comparison.service.js'

export const listComparisons = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listComparisons(getTenantId(req), req.query as never)
  sendPaginated(res, 'Vendor comparisons retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getComparison = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Vendor comparison retrieved', await service.getComparison(getTenantId(req), getRouteParam(req, 'id')))
})

export const createComparison = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  sendCreated(res, 'Vendor comparison created', await service.createComparison(getTenantId(req), userId, req.body))
})

export const awardComparison = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  sendSuccess(res, 'Vendor awarded', await service.awardComparison(getTenantId(req), getRouteParam(req, 'id'), userId, req.body))
})

export const createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  sendCreated(res, 'Purchase order created', await service.createPurchaseOrderFromComparison(getTenantId(req), getRouteParam(req, 'id'), userId))
})
