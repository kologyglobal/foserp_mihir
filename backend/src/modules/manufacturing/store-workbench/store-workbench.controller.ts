import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import * as materialService from '../materials/material.service.js'
import type { BulkShortageRequisitionInput } from '../materials/material.schemas.js'
import * as service from './store-workbench.service.js'

function limitFromQuery(req: Request) {
  const raw = Number(req.query.limit)
  return Number.isFinite(raw) ? raw : undefined
}

export const getSummary = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Store workbench summary', await service.getStoreWorkbenchSummary(getTenantId(req))),
)

export const listReservations = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench reservations',
    await service.listStoreWorkbenchReservations(getTenantId(req), { limit: limitFromQuery(req) }),
  ),
)

export const listIssues = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench issues',
    await service.listStoreWorkbenchIssues(getTenantId(req), { limit: limitFromQuery(req) }),
  ),
)

export const createIssuesShortageRequisition = asyncHandler(async (req: Request, res: Response) => {
  const result = await materialService.createBulkShortageRequisition(
    req,
    getTenantId(req),
    req.body as BulkShortageRequisitionInput,
  )
  return sendCreated(res, 'Shortage requisition created', result)
})

export const listReturns = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench returns',
    await service.listStoreWorkbenchReturns(getTenantId(req), { limit: limitFromQuery(req) }),
  ),
)

export const listWip = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench WIP',
    await service.listStoreWorkbenchWip(getTenantId(req), { limit: limitFromQuery(req) }),
  ),
)

export const listFinishedGoods = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench finished goods',
    await service.listStoreWorkbenchFinishedGoods(getTenantId(req), { limit: limitFromQuery(req) }),
  ),
)

export const listReconciliation = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Store workbench reconciliation',
    await service.listStoreWorkbenchReconciliation(getTenantId(req), { limit: limitFromQuery(req) }),
  ),
)
