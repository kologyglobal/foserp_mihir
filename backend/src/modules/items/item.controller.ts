import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import * as service from './item.service.js'

export const listItems = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRecords(req, tenantId, req.query as never)
  return sendPaginated(
    res,
    'items listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const listItemLookups = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listLookups(req, tenantId, req.query as never)
  return sendPaginated(
    res,
    'item lookups',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getItem = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, id)
  return sendSuccess(res, 'item fetched', item)
})

export const createItem = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRecord(req, tenantId, req.body as Record<string, unknown>)
  return sendCreated(res, 'item created', item)
})

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body as Record<string, unknown>)
  return sendSuccess(res, 'item updated', item)
})

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  await service.deleteRecord(req, tenantId, id)
  return sendSuccess(res, 'item deleted', null)
})

export const activateItem = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateRecord(req, tenantId, id)
  return sendSuccess(res, 'item activated', item)
})

export const deactivateItem = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateRecord(req, tenantId, id)
  return sendSuccess(res, 'item deactivated', item)
})

export const uploadItemImage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const file = req.file
  if (!file) {
    return res.status(400).json({ success: false, message: 'Image file is required' })
  }
  const item = await service.uploadItemImage(req, tenantId, id, file)
  return sendSuccess(res, 'item image uploaded', item)
})

export const getItemImage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const { buffer, contentType } = await service.getItemImage(tenantId, id)
  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', 'private, max-age=300')
  return res.send(buffer)
})

export const deleteItemImage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.removeItemImage(req, tenantId, id)
  return sendSuccess(res, 'item image removed', item)
})
