import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './purchase-approval.service.js'

export const listPurchaseApprovals = asyncHandler(async (req: Request, res: Response) => {
  const ctx = getContext(req)
  const result = await service.listPurchaseApprovals(
    getTenantId(req),
    ctx.userId,
    ctx.permissions ?? [],
    req.query as never,
  )
  sendPaginated(
    res,
    'Purchase approvals retrieved',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getPurchaseApproval = asyncHandler(async (req: Request, res: Response) => {
  const ctx = getContext(req)
  const data = await service.getPurchaseApprovalReview(
    getTenantId(req),
    ctx.userId,
    ctx.permissions ?? [],
    getRouteParam(req, 'id'),
  )
  sendSuccess(res, 'Purchase approval retrieved', data)
})

export const delegatePurchaseApproval = asyncHandler(async (req: Request, res: Response) => {
  const ctx = getContext(req)
  const data = await service.delegatePurchaseApproval(
    getTenantId(req),
    ctx.userId,
    ctx.permissions ?? [],
    getRouteParam(req, 'id'),
    req.body,
  )
  sendSuccess(res, 'Purchase approval delegated', data)
})
