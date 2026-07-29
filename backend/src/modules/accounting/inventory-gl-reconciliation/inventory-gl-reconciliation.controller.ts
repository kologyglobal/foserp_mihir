import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendSuccess } from '../../../utils/response.js'
import { listUnifiedFailedAccountingEvents, retryUnifiedFailedAccountingEvent } from './inventory-gl-failed-events.service.js'
import { buildInventoryGlTrialBalance } from './inventory-gl-trial-balance.service.js'
import type {
  InventoryGlTrialBalanceQuery,
  RetryFailedEventBody,
  UnifiedFailedEventsQuery,
} from './inventory-gl-reconciliation.schemas.js'

export const getInventoryGlTrialBalance = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as InventoryGlTrialBalanceQuery
  const result = await buildInventoryGlTrialBalance(getTenantId(req), query)
  return sendSuccess(res, 'Inventory ↔ GL / WIP ↔ GL trial balance', result)
})

export const listFailedAccountingEvents = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as UnifiedFailedEventsQuery
  const result = await listUnifiedFailedAccountingEvents(getTenantId(req), query)
  return sendSuccess(res, 'Unified failed accounting events listed', {
    items: result.data,
    total: result.total,
    page: result.page,
    limit: result.limit,
    forceBalanceAllowed: false,
    meta: buildPaginationMeta(result.total, result.page, result.limit),
  })
})

export const retryFailedAccountingEvent = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RetryFailedEventBody
  const result = await retryUnifiedFailedAccountingEvent(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    body.source,
  )
  return sendSuccess(res, 'Accounting event retry completed', result)
})
