import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './tracking-master.service.js'

const actor = (req: Request) => getContext(req).userId

export const listLots = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listLots(getTenantId(req), req.query as never)
  return sendPaginated(res, 'Inventory lots retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const createLot = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory lot created', await service.createLot(getTenantId(req), actor(req), req.body), 201))
export const getLot = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory lot retrieved', await service.getLot(getTenantId(req), getRouteParam(req, 'id'))))
export const patchLotStatus = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory lot status updated', await service.patchLotStatus(
    getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body.status,
  )))

export const listSerials = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listSerials(getTenantId(req), req.query as never)
  return sendPaginated(res, 'Inventory serials retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const createSerial = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory serial created', await service.createSerial(getTenantId(req), actor(req), req.body), 201))
export const getSerial = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory serial retrieved', await service.getSerial(getTenantId(req), getRouteParam(req, 'id'))))
export const patchSerialStatus = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inventory serial status updated', await service.patchSerialStatus(
    getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body.status,
  )))
