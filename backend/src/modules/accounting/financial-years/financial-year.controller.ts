import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './financial-year.service.js'

export const listFinancialYears = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRecords(req, tenantId, req.query as never)
  return sendPaginated(res, 'financial years listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getFinancialYear = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, id)
  return sendSuccess(res, 'financial year fetched', item)
})

export const createFinancialYear = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRecord(req, tenantId, req.body)
  return sendCreated(res, 'financial year created', item)
})

export const updateFinancialYear = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'financial year updated', item)
})

export const activateFinancialYear = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateRecord(req, tenantId, id)
  return sendSuccess(res, 'financial year activated', item)
})

export const closeFinancialYear = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.closeRecord(req, tenantId, id)
  return sendSuccess(res, 'financial year closed', item)
})
