import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import { getShopfloorLive } from './shopfloor.service.js'

export const getLive = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const plantCode = typeof req.query.plantCode === 'string' ? req.query.plantCode : undefined
  const workCentreId = typeof req.query.workCentreId === 'string' ? req.query.workCentreId : undefined
  const result = await getShopfloorLive(tenantId, { plantCode, workCentreId })
  return sendSuccess(res, 'Shopfloor live board fetched', result)
})
