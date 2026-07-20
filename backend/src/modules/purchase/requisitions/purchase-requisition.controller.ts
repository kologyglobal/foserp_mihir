import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './purchase-requisition.service.js'
import { convertPurchaseRequisitionToRfq } from '../rfq/rfq.service.js'

export const listPurchaseRequisitions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listPurchaseRequisitions(tenantId, req.query as never)
  sendPaginated(
    res,
    'Purchase requisitions retrieved',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const previewNextPurchaseRequisitionNumber = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.previewNextPurchaseRequisitionNumber(tenantId)
  sendSuccess(res, 'Next purchase requisition number previewed', data)
})

export const getPurchaseRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getPurchaseRequisition(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Purchase requisition retrieved', data)
})

export const createPurchaseRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createPurchaseRequisition(tenantId, userId, req.body)
  sendCreated(res, 'Purchase requisition created', data)
})

export const updatePurchaseRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updatePurchaseRequisition(
    tenantId,
    getRouteParam(req, 'id'),
    userId,
    req.body,
  )
  sendSuccess(res, 'Purchase requisition updated', data)
})

export const submitPurchaseRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.submitPurchaseRequisition(
    tenantId,
    getRouteParam(req, 'id'),
    userId,
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase requisition submitted', data)
})

export const approvePurchaseRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.approvePurchaseRequisition(
    tenantId,
    getRouteParam(req, 'id'),
    userId,
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase requisition approved', data)
})

export const rejectPurchaseRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.rejectPurchaseRequisition(
    tenantId,
    getRouteParam(req, 'id'),
    userId,
    req.body,
  )
  sendSuccess(res, 'Purchase requisition rejected', data)
})

export const cancelPurchaseRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.cancelPurchaseRequisition(
    tenantId,
    getRouteParam(req, 'id'),
    userId,
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase requisition cancelled', data)
})

export const reopenPurchaseRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.reopenPurchaseRequisition(
    tenantId,
    getRouteParam(req, 'id'),
    userId,
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase requisition reopened', data)
})

export const convertPrToRfq = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  const data = await convertPurchaseRequisitionToRfq(
    getTenantId(req),
    getRouteParam(req, 'id'),
    userId,
    req.body ?? {},
  )
  sendCreated(res, 'RFQ created from purchase requisition', data)
})
