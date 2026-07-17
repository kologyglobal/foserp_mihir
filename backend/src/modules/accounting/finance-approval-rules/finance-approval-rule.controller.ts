import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './finance-approval-rule.service.js'

export const listApprovalRules = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRecords(req, tenantId, req.query as never)
  return sendPaginated(res, 'approval rules listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getApprovalRule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, id)
  return sendSuccess(res, 'approval rule fetched', item)
})

export const createApprovalRule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRecord(req, tenantId, req.body)
  return sendCreated(res, 'approval rule created', item)
})

export const updateApprovalRule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'approval rule updated', item)
})

export const deleteApprovalRule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  await service.deleteRecord(req, tenantId, id)
  return sendSuccess(res, 'approval rule deleted', null)
})
