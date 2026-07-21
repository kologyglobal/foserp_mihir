import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { AppError } from '../../../utils/errors.js'
import { sendSuccess } from '../../../utils/response.js'
import { isTimelineEntityType, getPurchaseTimeline } from './purchase-timeline.service.js'

export const getTimeline = asyncHandler(async (req: Request, res: Response) => {
  const entityType = getRouteParam(req, 'entityType')
  const entityId = getRouteParam(req, 'entityId')
  if (!isTimelineEntityType(entityType)) {
    throw new AppError(400, `Unsupported timeline entity type: ${entityType}`, 'INVALID_TIMELINE_ENTITY')
  }
  const data = await getPurchaseTimeline(getTenantId(req), entityType, entityId)
  sendSuccess(res, 'Purchase timeline retrieved', data)
})
