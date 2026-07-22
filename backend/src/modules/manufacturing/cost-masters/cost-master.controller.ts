import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import type {
  CreateLabourRateCardInput,
  CreateOverheadCostPoolInput,
  ListCostMastersQuery,
  UpdateLabourRateCardInput,
  UpdateOverheadCostPoolInput,
} from './cost-master.schemas.js'
import * as service from './cost-master.service.js'

export const listLabourRateCards = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listLabourRateCards(getTenantId(req), req.query as unknown as ListCostMastersQuery)
  return sendPaginated(res, 'Labour rate cards listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const getLabourRateCard = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Labour rate card fetched', await service.getLabourRateCard(getTenantId(req), getRouteParam(req, 'id'))))
export const createLabourRateCard = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'Labour rate card created', await service.createLabourRateCard(req, getTenantId(req), req.body as CreateLabourRateCardInput)))
export const updateLabourRateCard = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Labour rate card updated', await service.updateLabourRateCard(req, getTenantId(req), getRouteParam(req, 'id'), req.body as UpdateLabourRateCardInput)))
export const deleteLabourRateCard = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteLabourRateCard(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Labour rate card deleted', null)
})

export const listOverheadCostPools = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listOverheadCostPools(getTenantId(req), req.query as unknown as ListCostMastersQuery)
  return sendPaginated(res, 'Overhead cost pools listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const getOverheadCostPool = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Overhead cost pool fetched', await service.getOverheadCostPool(getTenantId(req), getRouteParam(req, 'id'))))
export const createOverheadCostPool = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'Overhead cost pool created', await service.createOverheadCostPool(req, getTenantId(req), req.body as CreateOverheadCostPoolInput)))
export const updateOverheadCostPool = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Overhead cost pool updated', await service.updateOverheadCostPool(req, getTenantId(req), getRouteParam(req, 'id'), req.body as UpdateOverheadCostPoolInput)))
export const deleteOverheadCostPool = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteOverheadCostPool(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Overhead cost pool deleted', null)
})
