import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListSalesInvoicesQueryInput, ReverseSalesInvoiceBody } from './sales-invoice.schemas.js'
import * as draftService from './sales-invoice-draft.service.js'
import * as readService from './sales-invoice-read.service.js'
import * as postingService from '../posting/sales-invoice-posting.service.js'
import * as reverseService from '../posting/sales-invoice-reverse.service.js'

export const listSalesInvoices = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListSalesInvoicesQueryInput
  const result = await readService.listSalesInvoices(req, tenantId, {
    ...query,
    limit: query.limit ?? query.pageSize,
  })
  return sendPaginated(res, 'sales invoices listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await readService.getSalesInvoice(req, tenantId, id)
  return sendSuccess(res, 'sales invoice fetched', item)
})

export const createSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await draftService.createSalesInvoiceDraft(req, tenantId, req.body)
  return sendCreated(res, 'sales invoice draft created', item)
})

export const updateSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await draftService.updateSalesInvoiceDraft(req, tenantId, id, req.body)
  return sendSuccess(res, 'sales invoice draft updated', item)
})

export const validateSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const report = await draftService.validateSalesInvoiceRecord(req, tenantId, id)
  return sendSuccess(res, 'sales invoice validated', report)
})

export const markSalesInvoiceReady = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await draftService.markSalesInvoiceReady(req, tenantId, id)
  return sendSuccess(res, 'sales invoice marked ready to post', item)
})

export const cancelSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await draftService.cancelSalesInvoiceDraft(req, tenantId, id, req.body)
  return sendSuccess(res, 'sales invoice cancelled', item)
})

export const postSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await postingService.postSalesInvoiceFromRequest(req, tenantId, id)
  return sendSuccess(res, 'sales invoice posted', result)
})

export const reverseSalesInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const body = req.body as ReverseSalesInvoiceBody
  const result = await reverseService.reverseSalesInvoiceFromRequest(req, tenantId, id, body.reason)
  return sendSuccess(res, 'sales invoice reversed', result)
})
