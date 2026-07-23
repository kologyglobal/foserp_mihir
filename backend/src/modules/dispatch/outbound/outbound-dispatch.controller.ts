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
  const body = (req.body ?? {}) as { idempotencyKey?: string }
  const row = await service.confirmOutboundDispatch(req, tenantId, id, {
    idempotencyKey: body.idempotencyKey,
  })
  return sendSuccess(res, 'Outbound dispatch confirmed', row)
})

/** Phase 7C5 hardened post — workbench requires ISSUED Delivery Challan when policy requires it. */
export const post = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const body = (req.body ?? {}) as {
    idempotencyKey?: string
    emergency?: boolean
    overrideReason?: string
    emergencyOverride?: {
      businessReason: string
      urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      riskAcknowledged: boolean
      approvedByName?: string
      approvalReference?: string
      expiresAt?: string
      scope?: string
      remarks?: string
      overrideId?: string
    }
  }
  const row = await service.postOutboundDispatch(req, tenantId, id, {
    idempotencyKey: body.idempotencyKey,
    emergency: body.emergency,
    overrideReason: body.overrideReason,
    emergencyOverride: body.emergencyOverride,
  })
  return sendSuccess(
    res,
    body.emergency ? 'Outbound dispatch posted (emergency override)' : 'Outbound dispatch posted',
    row,
  )
})

/** Phase 7C5 reverse — workflow + partial lines via DispatchReversalService. */
export const reverse = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const { DispatchReversalService } = await import('../posting/dispatch-reversal.service.js')
  const result = await DispatchReversalService.reverseOutboundDispatchCanonical(
    req,
    tenantId,
    id,
    req.body as ReverseOutboundDispatchInput,
  )
  if (result && typeof result === 'object' && 'awaitingApproval' in result && result.awaitingApproval) {
    return sendSuccess(res, 'Dispatch reversal submitted for approval', result)
  }
  return sendSuccess(res, 'Outbound dispatch reversed', result)
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
