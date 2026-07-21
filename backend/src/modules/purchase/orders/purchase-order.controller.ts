import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'

function getUserId(req: Request): string {
  return getContext(req).userId
}
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

export const previewNextPurchaseOrderNumber = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.previewNextPurchaseOrderNumber(getTenantId(req))
  sendSuccess(res, 'Next purchase order number previewed', data)
})

export const createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createPurchaseOrder(getTenantId(req), getUserId(req), req.body)
  sendSuccess(res, 'Purchase order created', data, 201)
})

export const updatePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updatePurchaseOrder(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body,
  )
  sendSuccess(res, 'Purchase order updated', data)
})

export const submitPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.submitPurchaseOrder(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase order submitted for approval', data)
})

export const approvePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.approvePurchaseOrder(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
    getContext(req).permissions,
  )
  sendSuccess(res, 'Purchase order approved', data)
})

export const rejectPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.rejectPurchaseOrder(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase order rejected', data)
})

export const sendBackPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.sendBackPurchaseOrder(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase order sent back for rework', data)
})

export const sendPurchaseOrderToVendor = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.sendPurchaseOrderToVendor(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase order sent to vendor', data)
})

export const cancelPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.cancelPurchaseOrder(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase order cancelled', data)
})

export const closePurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.closePurchaseOrder(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase order closed', data)
})

export const reopenPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.reopenPurchaseOrder(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Purchase order reopened', data)
})
