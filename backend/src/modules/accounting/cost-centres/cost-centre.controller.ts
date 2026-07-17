import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './cost-centre.service.js'

export const listCostCentres = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRecords(req, tenantId, req.query as never)
  return sendPaginated(res, 'cost centres listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getCostCentreTree = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const tree = await service.getTree(req, tenantId, req.query as never)
  return sendSuccess(res, 'cost centre tree fetched', tree)
})

export const createCostCentre = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRecord(req, tenantId, req.body)
  return sendCreated(res, 'cost centre created', item)
})

export const updateCostCentre = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'cost centre updated', item)
})

export const activateCostCentre = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateRecord(req, tenantId, id)
  return sendSuccess(res, 'cost centre activated', item)
})

export const deactivateCostCentre = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateRecord(req, tenantId, id)
  return sendSuccess(res, 'cost centre deactivated', item)
})
