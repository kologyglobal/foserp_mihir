import type { Request, Response } from 'express'
import { permissionSetIncludes } from '../../constants/permissions.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { AuthorizationError } from '../../utils/errors.js'
import { sendSuccess } from '../../utils/response.js'
import * as accessReviewService from './access-review.service.js'
import * as effectiveAccessService from './effective-access.service.js'

/**
 * Phase 7 detailed Effective Access explain.
 * Allowed: access.view, user.view, or self (A4 self-service preserved).
 */
export async function getEffectiveAccess(req: Request, res: Response): Promise<void> {
  const ctx = getContext(req)
  const userId = getRouteParam(req, 'userId')
  const isSelf = ctx.userId === userId
  const canView =
    isSelf ||
    permissionSetIncludes(ctx.permissions, 'access.view') ||
    permissionSetIncludes(ctx.permissions, 'user.view')
  if (!canView) {
    throw new AuthorizationError('Missing permission: access.view')
  }

  const report = await effectiveAccessService.getEffectiveAccess(getTenantId(req), userId)
  sendSuccess(res, 'Effective access retrieved', report)
}

export async function getAccessReview(req: Request, res: Response): Promise<void> {
  const report = await accessReviewService.buildAccessReview(getTenantId(req))
  sendSuccess(res, 'Access review retrieved', report)
}
