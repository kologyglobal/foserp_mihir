import type { NextFunction, Request, Response } from 'express'
import { AuthorizationError } from '../../../utils/errors.js'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { getLedgerSchemaStatus } from './ledger-schema.service.js'
import * as postingRuleService from './posting-rule.service.js'
import * as postingReadService from '../posting/posting-read.service.js'

function requireFinanceGlView(req: Request, _res: Response, next: NextFunction): void {
  if (!req.context) {
    next(new AuthorizationError())
    return
  }
  const perms = req.context.permissions
  if (perms.includes('tenant.manage') || perms.includes('finance.gl.view') || perms.includes('finance.view')) {
    next()
    return
  }
  next(new AuthorizationError('Missing permission: finance.gl.view or finance.view'))
}

export const getSchemaStatus = [
  requireFinanceGlView,
  asyncHandler(async (_req: Request, res: Response) => {
    const status = getLedgerSchemaStatus()
    return sendSuccess(res, 'ledger schema status', status)
  }),
]

export const getPostingEngineStatus = [
  requireFinanceGlView,
  asyncHandler(async (_req: Request, res: Response) => {
    const status = getLedgerSchemaStatus()
    return sendSuccess(res, 'posting engine status', status)
  }),
]

export const getPostingEvent = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await postingReadService.getPostingEvent(tenantId, id)
  return sendSuccess(res, 'posting event fetched', item)
})

export const getVoucher = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await postingReadService.getVoucher(tenantId, id)
  return sendSuccess(res, 'voucher fetched', item)
})

export const getVoucherLedger = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const items = await postingReadService.getVoucherLedger(tenantId, id)
  return sendSuccess(res, 'voucher ledger fetched', items)
})

export const listPostingRules = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await postingRuleService.listRecords(req, tenantId, req.query as never)
  return sendPaginated(res, 'posting rules listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getPostingRule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await postingRuleService.getRecord(tenantId, id)
  return sendSuccess(res, 'posting rule fetched', item)
})

export const createPostingRule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await postingRuleService.createRecord(req, tenantId, req.body)
  return sendCreated(res, 'posting rule created', item)
})

export const updatePostingRule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await postingRuleService.updateRecord(req, tenantId, id, req.body)
  return sendSuccess(res, 'posting rule updated', item)
})

export const activatePostingRule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await postingRuleService.activateRecord(req, tenantId, id)
  return sendSuccess(res, 'posting rule activated', item)
})

export const deactivatePostingRule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await postingRuleService.deactivateRecord(req, tenantId, id)
  return sendSuccess(res, 'posting rule deactivated', item)
})
