import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './budgeting.service.js'
import type {
  BudgetVsActualQuery,
  ListBudgetVersionsQuery,
  OverviewQuery,
} from './budgeting.schemas.js'

export const getOverview = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'budgeting overview', await service.getOverview(getTenantId(req), req.query as unknown as OverviewQuery)))

export const listVersions = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listVersions(getTenantId(req), req.query as unknown as ListBudgetVersionsQuery)
  return sendPaginated(res, 'budget versions listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getVersion = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'budget version fetched', await service.getVersion(getTenantId(req), getRouteParam(req, 'id'))))

export const createVersion = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'budget version created', await service.createVersion(req, getTenantId(req), req.body)))

export const updateVersion = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'budget version updated',
    await service.updateVersion(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const submitVersion = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'budget version submitted',
    await service.submitVersion(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const approveVersion = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'budget version approved',
    await service.approveVersion(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const lockVersion = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'budget version locked',
    await service.lockVersion(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const listLines = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'budget lines listed', await service.listLines(getTenantId(req), getRouteParam(req, 'id'))))

export const createLine = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(
    res,
    'budget line created',
    await service.createLine(req, getTenantId(req), getRouteParam(req, 'id'), req.body),
  ))

export const updateLine = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'budget line updated',
    await service.updateLine(
      req,
      getTenantId(req),
      getRouteParam(req, 'id'),
      getRouteParam(req, 'lineId'),
      req.body,
    ),
  ))

export const deleteLine = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'budget line deleted',
    await service.deleteLine(req, getTenantId(req), getRouteParam(req, 'id'), getRouteParam(req, 'lineId')),
  ))

export const getBudgetVsActual = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'budget vs actual',
    await service.getBudgetVsActual(getTenantId(req), req.query as unknown as BudgetVsActualQuery),
  ))
