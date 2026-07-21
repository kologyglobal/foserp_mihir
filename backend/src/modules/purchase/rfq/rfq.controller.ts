import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './rfq.service.js'

export const listRfqs = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRfqs(tenantId, req.query as never)
  sendPaginated(res, 'RFQs retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getRfq = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getRfq(getTenantId(req), getRouteParam(req, 'id'))
  sendSuccess(res, 'RFQ retrieved', data)
})

export const previewNextRfqNumber = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.previewNextRfqNumber(getTenantId(req))
  sendSuccess(res, 'Next RFQ number previewed', data)
})

export const createRfq = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  const data = await service.createRfq(getTenantId(req), userId, req.body)
  sendCreated(res, 'RFQ created', data)
})

export const updateRfq = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  const data = await service.updateRfq(getTenantId(req), getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'RFQ updated', data)
})

export const setRfqVendors = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  const data = await service.setRfqVendors(
    getTenantId(req),
    getRouteParam(req, 'id'),
    userId,
    req.body,
  )
  sendSuccess(res, 'RFQ vendors updated', data)
})

export const sendRfq = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  const data = await service.sendRfq(
    getTenantId(req),
    getRouteParam(req, 'id'),
    userId,
    req.body ?? {},
  )
  sendSuccess(res, 'RFQ sent', data)
})

export const cancelRfq = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  const data = await service.cancelRfq(
    getTenantId(req),
    getRouteParam(req, 'id'),
    userId,
    req.body ?? {},
  )
  sendSuccess(res, 'RFQ cancelled', data)
})

export const convertPrToRfq = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  const data = await service.convertPurchaseRequisitionToRfq(
    getTenantId(req),
    getRouteParam(req, 'id'),
    userId,
    req.body ?? {},
  )
  sendCreated(res, 'RFQ created from purchase requisition', data)
})
