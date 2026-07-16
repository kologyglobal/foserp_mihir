import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import * as service from './vendor.service.js'

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRecords(req, tenantId, req.query as never)
  return sendPaginated(
    res,
    'vendors listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getVendor = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, id)
  return sendSuccess(res, 'vendor fetched', item)
})

export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRecord(req, tenantId, req.body as Record<string, unknown>)
  return sendCreated(res, 'vendor created', item)
})

export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body as Record<string, unknown>)
  return sendSuccess(res, 'vendor updated', item)
})

export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  await service.deleteRecord(req, tenantId, id)
  return sendSuccess(res, 'vendor deleted', null)
})

export const activateVendor = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateRecord(req, tenantId, id)
  return sendSuccess(res, 'vendor activated', item)
})

export const deactivateVendor = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateRecord(req, tenantId, id)
  return sendSuccess(res, 'vendor deactivated', item)
})

export const listVendorLookups = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listLookups(req, tenantId, req.query as never)
  return sendPaginated(
    res,
    'vendor lookups',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})
