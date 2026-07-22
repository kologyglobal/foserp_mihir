import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../../utils/response.js'
import * as service from './sales-order-commercial-position.service.js'

export const getSalesOrderCommercialPosition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const moneyVisible = service.canViewCommercialMoney(req.context?.permissions)
  const data = await service.getSalesOrderCommercialPosition(tenantId, id, moneyVisible)
  return sendSuccess(res, 'Sales order commercial position fetched', data)
})

export const getCompanyCommercialPosition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const moneyVisible = service.canViewCommercialMoney(req.context?.permissions)
  const data = await service.getCompanyCommercialPosition(tenantId, id, moneyVisible)
  return sendSuccess(res, 'Company commercial position fetched', data)
})
