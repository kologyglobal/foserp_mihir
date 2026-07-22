import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './transfer.service.js'

const actor = (req: Request) => getContext(req).userId

export const create = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory transfer created', await service.createTransfer(getTenantId(req), actor(req), req.body), 201))
export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listTransfers(getTenantId(req), req.query as never)
  return sendPaginated(res, 'Inventory transfers retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const get = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory transfer retrieved', await service.findTransfer(getTenantId(req), getRouteParam(req, 'id'))))
export const submit = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory transfer submitted', await service.submitTransfer(getTenantId(req), getRouteParam(req, 'id'), actor(req))))
export const approve = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory transfer approved', await service.approveTransfer(getTenantId(req), getRouteParam(req, 'id'), actor(req))))
export const dispatch = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory transfer dispatched', await service.dispatchTransfer(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body)))
export const receive = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory transfer receipt recorded', await service.receiveTransfer(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body)))
export const cancel = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory transfer cancelled', await service.cancelTransfer(getTenantId(req), getRouteParam(req, 'id'), actor(req))))
export const reverse = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory transfer reversed', await service.reverseTransfer(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body)))
