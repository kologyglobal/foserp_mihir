import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './finance-number-series.service.js'

export const listNumberSeries = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const items = await service.listRecords(req, tenantId, req.query as never)
  return sendSuccess(res, 'finance number series listed', items)
})

export const upsertNumberSeries = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const items = await service.upsertRecords(req, tenantId, req.body)
  return sendSuccess(res, 'finance number series saved', items)
})

export const previewNextNumber = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const legalEntityId = typeof req.query.legalEntityId === 'string' ? req.query.legalEntityId : undefined
  const documentType = typeof req.query.documentType === 'string' ? req.query.documentType : undefined
  const item = await service.previewNext(req, tenantId, legalEntityId, documentType)
  return sendSuccess(res, 'next number preview', item)
})
