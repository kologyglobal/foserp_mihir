import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import type { ListPeriodAdjustmentsQuery } from './period-adjustment.schemas.js'
import * as service from './period-adjustment.service.js'
import * as posting from './period-adjustment-posting.service.js'

export const listPeriodAdjustments = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPeriodAdjustments(getTenantId(req), req.query as unknown as ListPeriodAdjustmentsQuery)
  return sendPaginated(
    res,
    'period-end adjustments listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const createPeriodAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'period-end adjustment created', await service.createPeriodAdjustment(req, getTenantId(req), req.body)))

export const getPeriodAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'period-end adjustment fetched', await service.getPeriodAdjustment(getTenantId(req), getRouteParam(req, 'id'))))

export const updatePeriodAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'period-end adjustment updated', await service.updatePeriodAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const markPeriodAdjustmentReady = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'period-end adjustment marked ready', await service.markPeriodAdjustmentReady(req, getTenantId(req), getRouteParam(req, 'id'))))

export const revisePeriodAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'period-end adjustment returned to draft', await service.revisePeriodAdjustment(req, getTenantId(req), getRouteParam(req, 'id'))))

export const cancelPeriodAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'period-end adjustment cancelled', await service.cancelPeriodAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const postPeriodAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'period-end adjustment posted', await posting.postPeriodAdjustment(req, getTenantId(req), getRouteParam(req, 'id'))))

export const reversePeriodAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'period-end adjustment reversed', await posting.reversePeriodAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const recognisePrepaidSchedule = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'prepaid schedule recognised',
    await posting.recognisePrepaidSchedule(req, getTenantId(req), getRouteParam(req, 'id'), getRouteParam(req, 'scheduleId')),
  ))

export const getPeriodAdjustmentSummary = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'period adjustment summary fetched', await service.getPeriodAdjustmentSummary(getTenantId(req), getRouteParam(req, 'periodId'))))

export const recogniseDuePrepaidForPeriod = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'due prepaid schedules recognised',
    await posting.recogniseDuePrepaidForPeriod(req, getTenantId(req), getRouteParam(req, 'periodId')),
  ))

export const reverseDueAccrualsForPeriod = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'due accruals reversed',
    await posting.reverseDueAccrualsForPeriod(
      req,
      getTenantId(req),
      getRouteParam(req, 'periodId'),
      (req.body as { reason?: string }).reason ?? 'Period-close auto-reversal',
    ),
  ))
