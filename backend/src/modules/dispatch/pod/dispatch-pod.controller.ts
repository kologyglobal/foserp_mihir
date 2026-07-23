import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import type {
  CapturePodInput,
  MarkInTransitInput,
  PodAttachmentInput,
  PodExceptionInput,
} from './dispatch-pod.schemas.js'
import * as podService from './dispatch-pod.service.js'

export const getPod = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  return sendSuccess(res, 'Proof of Delivery', await podService.getPodForOutbound(req, tenantId, id))
})

export const markInTransit = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const body = (req.body ?? {}) as MarkInTransitInput
  return sendSuccess(res, 'POD marked in transit', await podService.markInTransit(req, tenantId, id, body))
})

export const capturePod = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const body = req.body as CapturePodInput
  return sendSuccess(res, 'POD captured', await podService.capturePod(req, tenantId, id, body))
})

export const recordException = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const body = req.body as PodExceptionInput
  return sendSuccess(res, 'POD exception recorded', await podService.recordPodException(req, tenantId, id, body))
})

export const addAttachment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const body = req.body as PodAttachmentInput
  return sendSuccess(res, 'POD attachment added', await podService.addPodAttachment(req, tenantId, id, body), 201)
})
