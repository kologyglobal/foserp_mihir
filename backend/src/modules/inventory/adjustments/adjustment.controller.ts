import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './adjustment.service.js'

const actor = (req: Request) => getContext(req).userId
export const create = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory adjustment created', await service.createAdjustment(getTenantId(req), actor(req), req.body), 201))
export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listAdjustments(getTenantId(req), req.query as never)
  return sendPaginated(res, 'Inventory adjustments retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const get = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory adjustment retrieved', await service.findAdjustment(getTenantId(req), getRouteParam(req, 'id'))))
export const submit = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory adjustment submitted', await service.submitAdjustment(getTenantId(req), getRouteParam(req, 'id'), actor(req))))
export const approve = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory adjustment approved', await service.approveAdjustment(getTenantId(req), getRouteParam(req, 'id'), actor(req))))
export const post = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory adjustment posted', await service.postAdjustment(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body)))
export const reverse = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory adjustment reversed', await service.reverseAdjustment(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body)))
