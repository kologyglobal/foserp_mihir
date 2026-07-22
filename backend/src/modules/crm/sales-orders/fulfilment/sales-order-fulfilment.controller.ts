import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../../utils/response.js'
import type { SetCancelledQtyInput } from './sales-order-fulfilment.schemas.js'
import * as service from './sales-order-fulfilment.service.js'

export const getFulfilment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const data = await service.getSalesOrderFulfilment(tenantId, id)
  return sendSuccess(res, 'Sales order fulfilment fetched', data)
})

export const setCancelledQty = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const lineId = getRouteParam(req, 'lineId')
  const data = await service.setLineCancelledQty(
    tenantId,
    id,
    lineId,
    req.body as SetCancelledQtyInput,
    req.context?.userId,
  )
  return sendSuccess(res, 'Cancelled quantity updated', data)
})
