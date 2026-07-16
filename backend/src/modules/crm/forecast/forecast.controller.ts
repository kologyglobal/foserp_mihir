import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './forecast.service.js'
import type { ForecastQuery } from './forecast.validation.js'

export const getForecast = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getSalesForecast(tenantId, req.query as ForecastQuery)
  sendSuccess(res, 'CRM sales forecast', data)
})
