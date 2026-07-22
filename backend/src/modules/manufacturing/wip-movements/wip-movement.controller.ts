import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import * as service from './wip-movement.service.js'
import type {
  CreateWipMovementInput,
  ListWipMovementsQuery,
  TransferToWorkOrderInput,
} from './wip-movement.schemas.js'

/** Mounted under `/work-orders/:id/wip-movements` — WO id param is `id`. */
function workOrderId(req: Request): string {
  return getRouteParam(req, 'id')
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.list(
    getTenantId(req),
    workOrderId(req),
    req.query as unknown as ListWipMovementsQuery,
  )
  return sendSuccess(res, 'WIP movements listed', { total: result.total, items: result.data })
})

export const get = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'WIP movement fetched',
    await service.get(getTenantId(req), workOrderId(req), getRouteParam(req, 'movementId')),
  ),
)

export const create = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(
    res,
    'WIP movement posted',
    await service.createAndPost(
      req,
      getTenantId(req),
      workOrderId(req),
      req.body as CreateWipMovementInput,
    ),
  ),
)

export const transferTo = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(
    res,
    'Work order transfer posted',
    await service.transferTo(
      req,
      getTenantId(req),
      workOrderId(req),
      getRouteParam(req, 'targetId'),
      req.body as TransferToWorkOrderInput,
    ),
  ),
)
