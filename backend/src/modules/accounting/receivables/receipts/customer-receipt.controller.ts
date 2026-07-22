import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListCustomerReceiptsQueryInput, ReverseCustomerReceiptInput } from './customer-receipt.schemas.js'
import * as draftService from './customer-receipt-draft.service.js'
import * as readService from './customer-receipt-read.service.js'
import * as postingService from './posting/customer-receipt-posting.service.js'
import * as reverseService from './posting/customer-receipt-reverse.service.js'

export const listCustomerReceipts = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListCustomerReceiptsQueryInput
  const result = await readService.listCustomerReceipts(req, tenantId, {
    ...query,
    limit: query.limit ?? query.pageSize,
  })
  return sendPaginated(res, 'customer receipts listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getCustomerReceipt = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await readService.getCustomerReceipt(req, tenantId, id)
  return sendSuccess(res, 'customer receipt fetched', item)
})

export const createCustomerReceipt = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await draftService.createCustomerReceiptDraft(req, tenantId, req.body)
  return sendCreated(res, 'customer receipt draft created', item)
})

export const updateCustomerReceipt = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await draftService.updateCustomerReceiptDraft(req, tenantId, id, req.body)
  return sendSuccess(res, 'customer receipt draft updated', item)
})

export const validateCustomerReceipt = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const report = await draftService.validateCustomerReceiptRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'customer receipt validated', report)
})

export const markCustomerReceiptReady = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await draftService.markCustomerReceiptReady(req, tenantId, id)
  return sendSuccess(res, 'customer receipt marked ready to post', item)
})

export const cancelCustomerReceipt = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await draftService.cancelCustomerReceiptDraft(req, tenantId, id, req.body)
  return sendSuccess(res, 'customer receipt cancelled', item)
})

export const postCustomerReceipt = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await postingService.postCustomerReceiptFromRequest(req, tenantId, id)
  return sendSuccess(res, 'customer receipt posted', result)
})

export const reverseCustomerReceipt = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const body = req.body as ReverseCustomerReceiptInput
  const result = await reverseService.reverseCustomerReceiptFromRequest(req, tenantId, id, body.reason)
  return sendSuccess(res, 'customer receipt reversed', result)
})
