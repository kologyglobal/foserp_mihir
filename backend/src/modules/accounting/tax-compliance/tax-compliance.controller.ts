import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendSuccess } from '../../../utils/response.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import * as einvoiceService from './einvoice.service.js'
import * as ewayBillService from './eway-bill.service.js'
import * as gstExtractService from './gst-extract.service.js'
import type {
  CancelGstDocumentInput,
  GenerateEInvoiceInput,
  GenerateEWayBillInput,
  GstExtractQueryInput,
  GstSummaryQueryInput,
  ListGstDocumentQueryInput,
} from './tax-compliance.schemas.js'

export const listOutwardSupplies = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstExtractQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const result = await gstExtractService.listOutwardSupplies({
    tenantId,
    legalEntityId: query.legalEntityId,
    fromDate: query.fromDate,
    toDate: query.toDate,
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
  })

  return sendSuccess(
    res,
    'outward supplies extract fetched',
    {
      fromDate: query.fromDate,
      toDate: query.toDate,
      legalEntityId: query.legalEntityId,
      items: result.items,
      summary: result.summary,
    },
    200,
    buildPaginationMeta(result.total, query.page, query.pageSize),
  )
})

export const listInwardSupplies = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstExtractQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const result = await gstExtractService.listInwardSupplies({
    tenantId,
    legalEntityId: query.legalEntityId,
    fromDate: query.fromDate,
    toDate: query.toDate,
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
  })

  return sendSuccess(
    res,
    'inward supplies extract fetched',
    {
      fromDate: query.fromDate,
      toDate: query.toDate,
      legalEntityId: query.legalEntityId,
      items: result.items,
      summary: result.summary,
    },
    200,
    buildPaginationMeta(result.total, query.page, query.pageSize),
  )
})

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as GstSummaryQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const result = await gstExtractService.getGstComplianceSummary({
    tenantId,
    legalEntityId: query.legalEntityId,
    fromDate: query.fromDate,
    toDate: query.toDate,
  })

  return sendSuccess(res, 'GST compliance summary fetched', {
    fromDate: query.fromDate,
    toDate: query.toDate,
    legalEntityId: query.legalEntityId,
    outward: result.outward,
    inward: result.inward,
  })
})

export const listEInvoices = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListGstDocumentQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await einvoiceService.listEInvoices(req, tenantId, query)
  return sendSuccess(
    res,
    'e-invoices fetched',
    { items: result.items },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getEInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await einvoiceService.getEInvoice(req, tenantId, String(req.params.id))
  return sendSuccess(res, 'e-invoice fetched', item)
})

export const generateEInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GenerateEInvoiceInput
  const result = await einvoiceService.generateEInvoice(req, tenantId, body)
  return sendSuccess(res, result.idempotentReplay ? 'e-invoice already generated' : 'e-invoice generated', result, 201)
})

export const cancelEInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as CancelGstDocumentInput
  const item = await einvoiceService.cancelEInvoice(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'e-invoice cancelled', item)
})

export const listEWayBills = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListGstDocumentQueryInput
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await ewayBillService.listEWayBills(req, tenantId, query)
  return sendSuccess(
    res,
    'e-way bills fetched',
    { items: result.items },
    200,
    buildPaginationMeta(result.total, result.page, result.pageSize),
  )
})

export const getEWayBill = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await ewayBillService.getEWayBill(req, tenantId, String(req.params.id))
  return sendSuccess(res, 'e-way bill fetched', item)
})

export const generateEWayBill = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as GenerateEWayBillInput
  const result = await ewayBillService.generateEWayBill(req, tenantId, body)
  return sendSuccess(res, result.idempotentReplay ? 'e-way bill already generated' : 'e-way bill generated', result, 201)
})

export const cancelEWayBill = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as CancelGstDocumentInput
  const item = await ewayBillService.cancelEWayBill(req, tenantId, String(req.params.id), body)
  return sendSuccess(res, 'e-way bill cancelled', item)
})
