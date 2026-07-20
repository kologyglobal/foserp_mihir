import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './purchase-order.service.js'

export const listPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listPurchaseOrders(tenantId, req.query as never)
  sendPaginated(
    res,
    'Purchase orders retrieved',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getPurchaseOrder(getTenantId(req), getRouteParam(req, 'id'))
  sendSuccess(res, 'Purchase order retrieved', data)
})
