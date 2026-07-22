import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './outbound-dispatch.service.js'
import type {
  CancelOutboundDispatchInput,
  CreateOutboundDispatchInput,
  ListOutboundDispatchesQuery,
  ReverseOutboundDispatchInput,
  UpdateOutboundDispatchInput,
} from './outbound-dispatch.schemas.js'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listOutboundDispatches(
    tenantId,
    req.query as unknown as ListOutboundDispatchesQuery,
  )
  return sendPaginated(
    res,
    'Outbound dispatches listed',
    result.items,
    buildPaginationMeta(
      result.total,
      (req.query as unknown as ListOutboundDispatchesQuery).page,
      (req.query as unknown as ListOutboundDispatchesQuery).limit,
    ),
  )
})

export const get = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.getOutboundDispatch(tenantId, id)
  return sendSuccess(res, 'Outbound dispatch fetched', row)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const row = await service.createOutboundDispatch(req, tenantId, req.body as CreateOutboundDispatchInput)
  return sendCreated(res, 'Outbound dispatch created', row)
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.updateOutboundDispatch(
    req,
    tenantId,
    id,
    req.body as UpdateOutboundDispatchInput,
  )
  return sendSuccess(res, 'Outbound dispatch updated', row)
})

export const confirm = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.confirmOutboundDispatch(req, tenantId, id)
  return sendSuccess(res, 'Outbound dispatch confirmed', row)
})

/** Phase 7C5 hardened post — workbench requires ISSUED Delivery Challan. */
export const post = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.postOutboundDispatch(req, tenantId, id)
  return sendSuccess(res, 'Outbound dispatch posted', row)
})

/** Phase 7C5 reverse — compensating FG_DISPATCH inward, status → REVERSED. */
export const reverse = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.reverseOutboundDispatch(
    req,
    tenantId,
    id,
    req.body as ReverseOutboundDispatchInput,
  )
  return sendSuccess(res, 'Outbound dispatch reversed', row)
})

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.cancelOutboundDispatch(
    req,
    tenantId,
    id,
    req.body as CancelOutboundDispatchInput,
  )
  return sendSuccess(res, 'Outbound dispatch cancelled', row)
})
