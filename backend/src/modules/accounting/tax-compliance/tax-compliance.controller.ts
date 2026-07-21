import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendSuccess } from '../../../utils/response.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import * as gstExtractService from './gst-extract.service.js'
import type { GstExtractQueryInput, GstSummaryQueryInput } from './tax-compliance.schemas.js'

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
