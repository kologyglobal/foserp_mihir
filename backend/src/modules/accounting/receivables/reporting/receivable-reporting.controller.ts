import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendSuccess } from '../../../../utils/response.js'
import * as customerSummaryService from './customer-receivable-summary.service.js'
import * as outstandingService from './receivable-outstanding.service.js'
import * as overviewService from './receivable-overview.service.js'
import * as reconciliationService from './receivable-reconciliation.service.js'
import type {
  AgeingQueryInput,
  CustomerSummaryQueryInput,
  ListOutstandingQueryInput,
  OverviewQueryInput,
  ReconciliationQueryInput,
} from './receivable-reporting.schemas.js'

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as OverviewQueryInput
  const data = await overviewService.getReceivableOverview(tenantId, query)
  return sendSuccess(res, 'receivable overview fetched', data)
})

export const listOutstanding = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListOutstandingQueryInput
  const result = await outstandingService.listOutstanding(tenantId, query)
  return sendSuccess(res, 'outstanding receivables listed', {
    reportDate: result.reportDate,
    limitations: result.limitations,
    items: result.items,
  }, 200, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getAgeing = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as AgeingQueryInput
  const data = await outstandingService.getAgeingReport(tenantId, query)
  return sendSuccess(res, 'receivable ageing report fetched', data)
})

export const listCustomerSummaries = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as CustomerSummaryQueryInput
  const result = await customerSummaryService.listCustomerSummaries(tenantId, query)
  return sendSuccess(res, 'customer receivable summaries listed', {
    reportDate: result.reportDate,
    limitations: result.limitations,
    items: result.items,
  }, 200, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getCustomerSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const customerId = getRouteParam(req, 'customerId')
  const query = req.query as unknown as Omit<CustomerSummaryQueryInput, 'search' | 'page' | 'pageSize' | 'sortBy' | 'sortOrder'>
  const data = await customerSummaryService.getCustomerSummary(tenantId, customerId, query)
  return sendSuccess(res, 'customer receivable summary fetched', data)
})

export const listCustomerOpenItems = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const customerId = getRouteParam(req, 'customerId')
  const query = req.query as unknown as ListOutstandingQueryInput
  const result = await outstandingService.listCustomerOpenItems(tenantId, customerId, query)
  return sendSuccess(res, 'customer open receivable items listed', {
    reportDate: result.reportDate,
    limitations: result.limitations,
    items: result.items,
  }, 200, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getReconciliation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ReconciliationQueryInput
  const data = await reconciliationService.getReceivableReconciliation(tenantId, query)
  return sendSuccess(res, 'receivable reconciliation fetched', data)
})
