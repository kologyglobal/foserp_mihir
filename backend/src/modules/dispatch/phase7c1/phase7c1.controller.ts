import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { createDraftFromRequirements } from '../draft/draft-dispatch.service.js'
import * as reqService from '../requirements/dispatch-requirement.service.js'
import { getWorkbenchSummary } from '../workbench/dispatch-workbench.service.js'
import type {
  CreateDraftFromRequirementsInput,
  ListRequirementsQuery,
} from './phase7c1.schemas.js'

function userId(req: Request): string | undefined {
  return req.context?.userId
}

function tabToListFilters(tab: ListRequirementsQuery['tab']): Partial<ListRequirementsQuery> {
  switch (tab) {
    case 'ready':
      return { readinessStatus: ['READY_TO_DISPATCH', 'PARTIALLY_READY'] }
    case 'waiting_production':
      return { readinessStatus: 'WAITING_FOR_PRODUCTION' }
    case 'waiting_quality':
      return { readinessStatus: 'WAITING_FOR_QUALITY' }
    case 'waiting_stock':
      return { readinessStatus: 'WAITING_FOR_STOCK' }
    case 'overdue':
      return { overdueOnly: true }
    case 'blocked':
      return { readinessStatus: ['BLOCKED', 'ON_HOLD', 'RECONCILIATION_REQUIRED'] }
    default:
      return {}
  }
}

export const workbenchSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const refresh = String(req.query.refresh ?? '') === 'true'
  const summary = await getWorkbenchSummary(tenantId, refresh)
  return sendSuccess(res, 'Dispatch workbench summary', summary)
})

export const listRequirements = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListRequirementsQuery
  const tabFilters = tabToListFilters(query.tab)
  const result = await reqService.listRequirements(
    tenantId,
    {
      page: query.page,
      limit: query.limit,
      readinessStatus: query.readinessStatus ?? tabFilters.readinessStatus,
      status: query.status,
      customerId: query.customerId,
      salesOrderId: query.salesOrderId,
      itemId: query.itemId,
      overdueOnly: query.overdueOnly ?? tabFilters.overdueOnly,
      search: query.search,
      refresh: query.refresh,
    },
    userId(req),
  )
  return sendPaginated(
    res,
    'Dispatch requirements listed',
    result.items,
    buildPaginationMeta(result.total, query.page, query.limit),
  )
})

export const synchroniseRequirements = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as { salesOrderId?: string }
  const result = await reqService.synchronise(tenantId, userId(req), body.salesOrderId)
  return sendSuccess(res, 'Dispatch requirements synchronised', result)
})

export const getRequirement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await reqService.getRequirementDetail(tenantId, id)
  return sendSuccess(res, 'Dispatch requirement fetched', row)
})

export const getRequirementReadiness = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await reqService.getRequirementReadiness(tenantId, id)
  return sendSuccess(res, 'Dispatch requirement readiness fetched', row)
})

export const getRequirementFulfilment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await reqService.getRequirementFulfilmentPosition(tenantId, id)
  return sendSuccess(res, 'Dispatch requirement fulfilment position fetched', row)
})

export const holdRequirement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const body = req.body as { reason?: string }
  await reqService.holdRequirement(tenantId, id, body.reason, userId(req))
  const row = await reqService.getRequirementDetail(tenantId, id)
  return sendSuccess(res, 'Dispatch requirement held', row)
})

export const releaseHold = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await reqService.releaseHold(tenantId, id, userId(req))
  return sendSuccess(res, 'Dispatch requirement hold released', row)
})

export const readinessPreview = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as { requirementIds: string[] }
  const row = await reqService.readinessPreview(tenantId, body.requirementIds)
  return sendSuccess(res, 'Dispatch readiness preview', row)
})

export const createDraftOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const row = await createDraftFromRequirements(
    req,
    tenantId,
    req.body as CreateDraftFromRequirementsInput,
  )
  return sendCreated(res, 'Draft dispatch created from requirements', row)
})

export const salesOrderRequirements = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const salesOrderId = getRouteParam(req, 'id')
  const result = await reqService.listForSalesOrder(tenantId, salesOrderId)
  return sendSuccess(res, 'Sales order dispatch requirements', result.items)
})

export const salesOrderDispatchHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const salesOrderId = getRouteParam(req, 'id')
  const row = await reqService.dispatchHistoryForSalesOrder(tenantId, salesOrderId)
  return sendSuccess(res, 'Sales order dispatch history', row)
})

export const salesOrderFulfilmentSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const salesOrderId = getRouteParam(req, 'id')
  const row = await reqService.salesOrderFulfilmentSummary(tenantId, salesOrderId)
  return sendSuccess(res, 'Sales order fulfilment summary', row)
})
