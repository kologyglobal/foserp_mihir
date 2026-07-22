import type { Request, Response } from 'express'
import { permissionSetIncludes } from '../../../constants/permissions.js'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './stock-count.service.js'

const actor = (req: Request) => getContext(req).userId
const reveal = (req: Request) => permissionSetIncludes(getContext(req).permissions, 'inventory.stock_count.reveal_system_quantity')
const present = (req: Request, document: Awaited<ReturnType<typeof service.snapshotStockCount>>) =>
  service.redactSystemQuantity(document, reveal(req))

export const create = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Stock count created', present(req, await service.createStockCount(getTenantId(req), actor(req), req.body)), 201))
export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listStockCounts(getTenantId(req), req.query as never, reveal(req))
  return sendPaginated(res, 'Stock counts retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const get = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Stock count retrieved', await service.findStockCount(getTenantId(req), getRouteParam(req, 'id'), reveal(req))))
export const snapshot = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Stock count snapshot captured', present(req, await service.snapshotStockCount(getTenantId(req), getRouteParam(req, 'id'), actor(req)))))
export const enter = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Counted quantities recorded', present(req, await service.enterCounts(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body))))
export const submit = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Stock count submitted', present(req, await service.submitStockCount(getTenantId(req), getRouteParam(req, 'id'), actor(req)))))
export const approve = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Stock count approved', present(req, await service.approveStockCount(getTenantId(req), getRouteParam(req, 'id'), actor(req)))))
export const post = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Stock count posted', present(req, await service.postStockCount(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body))))
export const reverse = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Stock count reversed', present(req, await service.reverseStockCount(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body))))
