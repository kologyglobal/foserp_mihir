import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import type { ListFxRatesQuery } from './fx-revaluation.schemas.js'
import * as service from './fx-revaluation.service.js'

export const listFxRates = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listFxRates(getTenantId(req), req.query as unknown as ListFxRatesQuery)
  return sendPaginated(res, 'FX rates listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const upsertFxRate = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'FX rate upserted', await service.upsertFxRate(req, getTenantId(req), req.body)))

export const getFxRunForPeriod = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'FX revaluation run fetched', await service.getFxRunForPeriod(getTenantId(req), getRouteParam(req, 'periodId'))))

export const previewFxRevaluation = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'FX revaluation previewed', await service.previewFxRevaluation(req, getTenantId(req), getRouteParam(req, 'periodId'))))

export const postFxRevaluation = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'FX revaluation posted', await service.postFxRevaluation(req, getTenantId(req), getRouteParam(req, 'id'))))

export const reverseFxRevaluation = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'FX revaluation reversed', await service.reverseFxRevaluation(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))
