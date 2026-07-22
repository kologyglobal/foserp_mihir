import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as manufacturingWorkbench from '../../manufacturing/store-workbench/store-workbench.service.js'
import * as service from './store-workbench.service.js'
import type { NeedsActionDomain } from './store-workbench.mappers.js'

function limitFromQuery(req: Request) {
  const raw = Number(req.query.limit)
  return Number.isFinite(raw) ? raw : undefined
}

export const getSummary = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Inventory store workbench summary',
    await service.getInventoryStoreWorkbenchSummary(getTenantId(req)),
  ),
)

export const listNeedsAction = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Inventory store workbench needs action',
    await service.listNeedsAction(getTenantId(req), { limit: limitFromQuery(req) }),
  ),
)

export const listNeedsActionForDomain = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Inventory store workbench needs action (domain)',
    await service.listNeedsActionForDomain(
      getTenantId(req),
      getRouteParam(req, 'domain') as NeedsActionDomain,
      { limit: limitFromQuery(req) },
    ),
  ),
)

// ── Thin aliases over the manufacturing store-workbench queues ──

export const listReservations = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench reservations',
    await manufacturingWorkbench.listStoreWorkbenchReservations(getTenantId(req), {
      limit: limitFromQuery(req),
    }),
  ),
)

export const listIssues = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench issues',
    await manufacturingWorkbench.listStoreWorkbenchIssues(getTenantId(req), {
      limit: limitFromQuery(req),
    }),
  ),
)

export const listReturns = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench returns',
    await manufacturingWorkbench.listStoreWorkbenchReturns(getTenantId(req), {
      limit: limitFromQuery(req),
    }),
  ),
)

export const listWip = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench WIP',
    await manufacturingWorkbench.listStoreWorkbenchWip(getTenantId(req), {
      limit: limitFromQuery(req),
    }),
  ),
)

export const listFinishedGoods = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench finished goods',
    await manufacturingWorkbench.listStoreWorkbenchFinishedGoods(getTenantId(req), {
      limit: limitFromQuery(req),
    }),
  ),
)

export const listReconciliation = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench reconciliation',
    await manufacturingWorkbench.listStoreWorkbenchReconciliation(getTenantId(req), {
      limit: limitFromQuery(req),
    }),
  ),
)
