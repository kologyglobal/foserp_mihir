import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import * as service from './payment-account-mapping.service.js'

export const listPaymentAccountMappings = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRecords(tenantId, req.query as never)
  return sendPaginated(res, 'payment account mappings listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getPaymentAccountMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, id)
  return sendSuccess(res, 'payment account mapping fetched', item)
})

export const createPaymentAccountMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRecord(req, tenantId, req.body)
  return sendCreated(res, 'payment account mapping created', item)
})

export const updatePaymentAccountMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'payment account mapping updated', item)
})

export const activatePaymentAccountMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'payment account mapping activated', item)
})

export const deactivatePaymentAccountMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'payment account mapping deactivated', item)
})

export const resolvePaymentAccountMapping = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.resolveRecord(tenantId, req.body)
  return sendSuccess(res, 'payment account mapping resolved', item)
})
