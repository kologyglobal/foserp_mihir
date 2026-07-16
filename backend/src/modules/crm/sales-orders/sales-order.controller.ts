import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './sales-order.service.js'

export const listSalesOrders = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listSalesOrders(tenantId, req.query as never)
  sendPaginated(res, 'Sales orders retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getSalesOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getSalesOrder(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Sales order retrieved', data)
})

export const createSalesOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createSalesOrder(tenantId, userId, req.body)
  sendCreated(res, 'Sales order created', data)
})

export const updateSalesOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateSalesOrder(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Sales order updated', data)
})

export const deleteSalesOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  await service.deleteSalesOrder(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Sales order deleted', null)
})

export const confirmSalesOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.confirmSalesOrder(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Sales order confirmed', data)
})

export const closeSalesOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.closeSalesOrder(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Sales order closed', data)
})
