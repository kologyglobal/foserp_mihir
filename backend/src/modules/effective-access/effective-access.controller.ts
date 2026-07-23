import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendSuccess } from '../../utils/response.js'
import * as accessReviewService from './access-review.service.js'
import * as effectiveAccessService from './effective-access.service.js'

export async function getEffectiveAccess(req: Request, res: Response): Promise<void> {
  const report = await effectiveAccessService.getEffectiveAccess(
    getTenantId(req),
    getRouteParam(req, 'userId'),
  )
  sendSuccess(res, 'Effective access retrieved', report)
}

export async function getAccessReview(req: Request, res: Response): Promise<void> {
  const report = await accessReviewService.buildAccessReview(getTenantId(req))
  sendSuccess(res, 'Access review retrieved', report)
}
