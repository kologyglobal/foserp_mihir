import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './dashboard.service.js'
import type { DashboardQuery } from './dashboard.validation.js'

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getDashboardMetrics(tenantId, req.query as DashboardQuery)
  sendSuccess(res, 'CRM dashboard metrics', data)
})
