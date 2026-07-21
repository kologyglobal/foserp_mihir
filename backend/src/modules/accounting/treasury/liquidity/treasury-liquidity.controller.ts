import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../../utils/response.js'
import { getCashPosition } from './cash-position.service.js'
import { getClosingControls } from './closing-controls.service.js'
import { getDailyLiquidity } from './daily-liquidity.service.js'
import * as dayClose from './day-close.service.js'
import { getShortTermForecast } from './short-term-forecast.service.js'
import { getTreasuryDashboard } from './treasury-dashboard.service.js'
import type { ForecastQuery, LiquidityQuery, ListDayClosesQuery } from './treasury-liquidity.schemas.js'

export const getCashPositionHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'cash position fetched', await getCashPosition(getTenantId(req), req.query as unknown as LiquidityQuery)))

export const getDailyLiquidityHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'daily liquidity fetched', await getDailyLiquidity(getTenantId(req), req.query as unknown as LiquidityQuery)))

export const getForecastHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'short-term forecast fetched', await getShortTermForecast(getTenantId(req), req.query as unknown as ForecastQuery)))

export const getClosingControlsHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'closing controls fetched', await getClosingControls(getTenantId(req), req.query as unknown as LiquidityQuery)))

export const getDashboardHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury dashboard fetched', await getTreasuryDashboard(getTenantId(req), req.query as unknown as ForecastQuery)))

export const listDayClosesHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'day closes listed', await dayClose.listDayCloses(getTenantId(req), req.query as unknown as ListDayClosesQuery)))

export const getDayCloseHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'day close fetched', await dayClose.getDayClose(getTenantId(req), getRouteParam(req, 'id'))))

export const createDayCloseHandler = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'day close created', await dayClose.createDayClose(req, getTenantId(req), req.body)))

export const reviewDayCloseHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'day close reviewed',
    await dayClose.markDayCloseReviewed(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const closeDayCloseHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'day closed', await dayClose.closeDayClose(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const reopenDayCloseHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'day close reopened', await dayClose.reopenDayClose(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))
