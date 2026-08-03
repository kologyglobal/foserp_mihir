import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import { calculateSettlement } from './fnf-calc.service.js'
import * as fnf from './fnf.service.js'
import type { ListFnfQuery, PayFnfInput } from './exit.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

function hasPerm(req: Request, name: string): boolean {
  return Boolean(req.context?.permissions?.includes(name))
}

export const listSettlements = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await fnf.listSettlements(getTenantId(req), scope, req.query as unknown as ListFnfQuery)
  return sendPaginated(res, 'Settlements listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getSettlement = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await fnf.getSettlementByExit(getTenantId(req), getRouteParam(req, 'exitId'), scope)
  return sendSuccess(res, 'Settlement fetched', item)
})

export const calculate = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await calculateSettlement(getTenantId(req), getRouteParam(req, 'exitId'), scope, auditMeta(req))
  return sendSuccess(res, 'Settlement calculated', item)
})

export const review = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await fnf.reviewSettlement(getTenantId(req), req.context!.userId, getRouteParam(req, 'exitId'), scope, auditMeta(req))
  return sendSuccess(res, 'Settlement reviewed', item)
})

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await fnf.approveSettlement(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'exitId'),
    scope,
    hasPerm(req, 'hrms.fnf.approve'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Settlement approved', item)
})

export const postSettlement = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await fnf.postSettlement(getTenantId(req), getRouteParam(req, 'exitId'), scope, auditMeta(req))
  return sendSuccess(res, 'Settlement posted', item)
})

export const pay = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await fnf.paySettlement(getTenantId(req), getRouteParam(req, 'exitId'), req.body as PayFnfInput, scope, auditMeta(req))
  return sendSuccess(res, 'Settlement paid', item)
})
