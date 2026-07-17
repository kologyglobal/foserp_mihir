import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './branch.service.js'

export const listBranches = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const legalEntityId = getRouteParam(req, 'legalEntityId')
  const result = await service.listRecords(req, tenantId, legalEntityId, req.query as never)
  return sendPaginated(res, 'branches listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createBranch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const legalEntityId = getRouteParam(req, 'legalEntityId')
  const item = await service.createRecord(req, tenantId, legalEntityId, req.body)
  return sendCreated(res, 'branch created', item)
})

export const updateBranch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'branch updated', item)
})

export const setDefaultBranch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.setDefaultRecord(req, tenantId, id)
  return sendSuccess(res, 'default branch set', item)
})

export const activateBranch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateRecord(req, tenantId, id)
  return sendSuccess(res, 'branch activated', item)
})

export const deactivateBranch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateRecord(req, tenantId, id)
  return sendSuccess(res, 'branch deactivated', item)
})
