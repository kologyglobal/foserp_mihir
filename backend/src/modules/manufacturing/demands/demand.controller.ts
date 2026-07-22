import type { Request, Response } from 'express'
import type { ProductionDemand } from '@prisma/client'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendSuccess, sendPaginated } from '../../../utils/response.js'
import { dec, isoDate, mapProductionOrder } from '../shared/manufacturing.mappers.js'
import * as service from './demand.service.js'
import * as soConversion from './so-conversion.service.js'
import type { CancelDemandInput, ConvertSalesOrderLineInput, CreateManualDemandInput, ListDemandsQuery } from './demand.schemas.js'

function mapDemand(row: ProductionDemand) {
  return {
    ...row,
    requestedQuantity: dec(row.requestedQuantity),
    convertedQuantity: dec(row.convertedQuantity),
    remainingQuantity: dec(row.remainingQuantity),
    cancelledQuantity: dec(row.cancelledQuantity),
    requiredDate: isoDate(row.requiredDate),
  }
}

export const listDemands = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listDemands(tenantId, req.query as unknown as ListDemandsQuery)
  return sendPaginated(
    res,
    'Production demands listed',
    result.items.map(mapDemand),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getDemand = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getDemand(tenantId, id)
  return sendSuccess(res, 'Production demand fetched', mapDemand(item))
})

export const createManualDemand = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createManualDemand(req, tenantId, req.body as CreateManualDemandInput)
  return sendCreated(res, 'Production demand created', mapDemand(item))
})

export const cancelDemand = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.cancelDemand(req, tenantId, id, req.body as CancelDemandInput)
  return sendSuccess(res, 'Production demand cancelled', mapDemand(item))
})

export const listEligibleSalesOrders = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await soConversion.listEligibleSalesOrders(tenantId)
  return sendSuccess(res, 'Eligible sales orders listed', result)
})

export const getSalesOrderLineEligibility = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const salesOrderId = getRouteParam(req, 'salesOrderId')
  const result = await soConversion.getSalesOrderLineEligibility(tenantId, salesOrderId)
  return sendSuccess(res, 'Sales order line eligibility fetched', result)
})

export const convertSalesOrderLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const salesOrderId = getRouteParam(req, 'salesOrderId')
  const lineRef = getRouteParam(req, 'lineRef')
  const result = await soConversion.convertSalesOrderLine(
    req,
    tenantId,
    salesOrderId,
    lineRef,
    req.body as ConvertSalesOrderLineInput,
  )
  return sendCreated(res, 'Sales order line converted to work order', {
    demand: result.demand ? mapDemand(result.demand) : null,
    order: mapProductionOrder(result.order),
  })
})
