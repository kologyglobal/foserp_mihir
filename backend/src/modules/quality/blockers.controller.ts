import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendSuccess } from '../../utils/response.js'
import { collectQualityBlockers, jobWorkQualityBlockers } from './shared/blockers.service.js'

export const getProductionOrderBlockers = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const productionOrderId = getRouteParam(req, 'productionOrderId')
  const blockers = await collectQualityBlockers(tenantId, productionOrderId)
  return sendSuccess(res, 'Quality blockers listed', { blockers })
})
export const getJobWorkSummary = asyncHandler(async (req: Request, res: Response) => {
  const jobWorkOrderId = getRouteParam(req, 'jobWorkOrderId')
  const blockers = await jobWorkQualityBlockers(getTenantId(req), jobWorkOrderId)
  return sendSuccess(res, 'Job work quality summary fetched', { blockers, blocked: blockers.length > 0 })
})
export const getWorkOrderSummary = asyncHandler(async (req: Request, res: Response) => {
  const productionOrderId = getRouteParam(req, 'workOrderId')
  const blockers = await collectQualityBlockers(getTenantId(req), productionOrderId)
  return sendSuccess(res, 'Work order quality summary fetched', { blockers, blocked: blockers.length > 0 })
})
