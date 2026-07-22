import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendSuccess, sendPaginated } from '../../../../utils/response.js'
import * as service from './treasury-account.service.js'

export const listTreasuryAccounts = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRecords(tenantId, req.query as never)
  return sendPaginated(res, 'treasury accounts listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getTreasuryAccount = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, id)
  return sendSuccess(res, 'treasury account fetched', item)
})

export const createTreasuryAccount = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRecord(req, tenantId, req.body)
  return sendCreated(res, 'treasury account created', item)
})

export const updateTreasuryAccount = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'treasury account updated', item)
})

export const activateTreasuryAccount = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'treasury account activated', item)
})

export const deactivateTreasuryAccount = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'treasury account deactivated', item)
})

export const closeTreasuryAccount = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.closeRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'treasury account closed', item)
})
