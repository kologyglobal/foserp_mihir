import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './quality-inspection.service.js'
const actor = (req: Request) => getContext(req).userId
export const listQualityInspections = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listQualityInspections(getTenantId(req), req.query as never)
  sendPaginated(res, 'Quality inspections retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const getQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Quality inspection retrieved', await service.getQualityInspection(getTenantId(req), getRouteParam(req, 'id'))))
export const createQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Quality inspection created', await service.createQualityInspection(getTenantId(req), actor(req), req.body), 201))
export const updateQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Quality inspection updated', await service.updateQualityInspection(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body)))
export const completeQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Quality inspection completed', await service.completeQualityInspection(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body ?? {})))
export const acceptQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Quality inspection accepted', await service.completeQualityInspection(getTenantId(req), getRouteParam(req, 'id'), actor(req), { ...req.body, outcome: 'ACCEPT' })))
export const rejectQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Quality inspection rejected', await service.completeQualityInspection(getTenantId(req), getRouteParam(req, 'id'), actor(req), { ...req.body, outcome: 'REJECT' })))
export const cancelQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Quality inspection cancelled', await service.cancelQualityInspection(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body ?? {})))
