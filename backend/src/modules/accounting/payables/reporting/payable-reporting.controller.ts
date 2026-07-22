import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendSuccess } from '../../../../utils/response.js'
import * as outstandingService from './payable-outstanding.service.js'
import * as overviewService from './payable-overview.service.js'
import * as paymentPlanningService from './payable-payment-planning.service.js'
import * as vendorSummaryService from './vendor-payable-summary.service.js'
import type {
  AgeingQueryInput,
  ListOutstandingQueryInput,
  OverviewQueryInput,
  PaymentPlanningQueryInput,
  VendorSummaryQueryInput,
} from './payable-reporting.schemas.js'

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as OverviewQueryInput
  const data = await overviewService.getPayableOverview(tenantId, query)
  return sendSuccess(res, 'payable overview fetched', data)
})

export const listOutstanding = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListOutstandingQueryInput
  const result = await outstandingService.listOutstanding(tenantId, query)
  return sendSuccess(res, 'outstanding payables listed', {
    reportDate: result.reportDate,
    limitations: result.limitations,
    items: result.items,
  }, 200, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getAgeing = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as AgeingQueryInput
  const data = await outstandingService.getAgeingReport(tenantId, query)
  return sendSuccess(res, 'payable ageing report fetched', data)
})

export const listVendorSummaries = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as VendorSummaryQueryInput
  const result = await vendorSummaryService.listVendorSummaries(tenantId, query)
  return sendSuccess(res, 'vendor payable summaries listed', {
    reportDate: result.reportDate,
    limitations: result.limitations,
    items: result.items,
  }, 200, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getVendorSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const vendorId = getRouteParam(req, 'vendorId')
  const query = req.query as unknown as Omit<VendorSummaryQueryInput, 'search' | 'page' | 'pageSize' | 'sortBy' | 'sortOrder'>
  const data = await vendorSummaryService.getVendorSummary(tenantId, vendorId, query)
  return sendSuccess(res, 'vendor payable summary fetched', data)
})

export const listVendorOpenItems = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const vendorId = getRouteParam(req, 'vendorId')
  const query = req.query as unknown as ListOutstandingQueryInput
  const result = await outstandingService.listVendorOpenItems(tenantId, vendorId, query)
  return sendSuccess(res, 'vendor open payable items listed', {
    reportDate: result.reportDate,
    limitations: result.limitations,
    items: result.items,
  }, 200, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getPaymentPlanning = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as PaymentPlanningQueryInput
  const data = await paymentPlanningService.getPaymentPlanning(tenantId, query)
  return sendSuccess(res, 'payable payment planning fetched', data)
})
