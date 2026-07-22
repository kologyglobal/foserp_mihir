import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './ncr.service.js'
import type { CloseNcrInput, ListNcrsQuery } from './ncr.schemas.js'

export const listNcrs = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listNcrs(tenantId, req.query as unknown as ListNcrsQuery)
  return sendPaginated(
    res,
    'Quality NCRs listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getNcr = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const ncr = await service.getNcr(tenantId, id)
  return sendSuccess(res, 'Quality NCR fetched', ncr)
})

export const closeNcr = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const ncr = await service.closeNcr(req, tenantId, id, req.body as CloseNcrInput)
  return sendSuccess(res, 'Quality NCR closed', ncr)
})
export const dispositionNcr = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'NCR disposition saved', await service.dispositionNcr(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))
export const submitAction = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'NCR action submitted', await service.submitAction(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))
export const verifyNcr = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'NCR action verified', await service.verifyNcr(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))
