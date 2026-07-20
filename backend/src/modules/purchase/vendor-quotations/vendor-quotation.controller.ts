import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './vendor-quotation.service.js'

export const listVendorQuotations = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listVendorQuotations(getTenantId(req), req.query as never)
  sendPaginated(res, 'Vendor quotations retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getVendorQuotation = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 'Vendor quotation retrieved', await service.getVendorQuotation(getTenantId(req), getRouteParam(req, 'id')))
})

export const createVendorQuotation = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  sendCreated(res, 'Vendor quotation created', await service.createVendorQuotation(getTenantId(req), userId, req.body))
})

export const updateVendorQuotation = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  sendSuccess(res, 'Vendor quotation updated', await service.updateVendorQuotation(getTenantId(req), getRouteParam(req, 'id'), userId, req.body))
})

export const submitVendorQuotation = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = getContext(req)
  sendSuccess(res, 'Vendor quotation submitted', await service.submitVendorQuotation(getTenantId(req), getRouteParam(req, 'id'), userId, req.body ?? {}))
})
