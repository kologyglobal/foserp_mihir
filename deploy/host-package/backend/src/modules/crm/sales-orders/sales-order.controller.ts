import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './sales-order.service.js'

export const listSalesOrders = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listSalesOrders(tenantId, req.query as never)
  sendPaginated(res, 'Sales orders retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getSalesOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getSalesOrder(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Sales order retrieved', data)
})
