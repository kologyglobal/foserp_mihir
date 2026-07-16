import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './company.service.js'

export const listCompanies = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listCompanies(tenantId, req.query as never)
  sendPaginated(res, 'Companies retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getCompany = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getCompany(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Company retrieved', data)
})

export const createCompany = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createCompany(tenantId, userId, req.body)
  sendCreated(res, 'Company created', data)
})

export const updateCompany = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateCompany(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Company updated', data)
})

export const deleteCompany = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  await service.deleteCompany(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Company deleted', null)
})
