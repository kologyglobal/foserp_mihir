import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './quotation-template.service.js'

export const listQuotationTemplates = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listQuotationTemplates(tenantId, req.query as never)
  sendPaginated(
    res,
    'Quotation templates retrieved',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getQuotationTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getQuotationTemplate(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Quotation template retrieved', data)
})

export const createQuotationTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createQuotationTemplate(tenantId, userId, req.body)
  sendCreated(res, 'Quotation template created', data)
})

export const updateQuotationTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateQuotationTemplate(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Quotation template updated', data)
})

export const duplicateQuotationTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.duplicateQuotationTemplate(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendCreated(res, 'Quotation template duplicated', data)
})

export const deleteQuotationTemplate = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  await service.deleteQuotationTemplate(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Quotation template deleted', null)
})
