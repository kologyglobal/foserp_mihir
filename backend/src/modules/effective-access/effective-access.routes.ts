import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateParams } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as controller from './effective-access.controller.js'
import { effectiveAccessUserParamSchema } from './effective-access.validation.js'

/** Mount under `/users` — `GET /:userId/effective-access` */
export const userEffectiveAccessRoutes = Router({ mergeParams: true })

userEffectiveAccessRoutes.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

userEffectiveAccessRoutes.get(
  '/:userId/effective-access',
  requirePermission('access.view'),
  validateParams(effectiveAccessUserParamSchema),
  asyncHandler(controller.getEffectiveAccess),
)

/** Mount under tenant — `GET /access-review` */
export const accessReviewRoutes = Router({ mergeParams: true })

accessReviewRoutes.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

accessReviewRoutes.get(
  '/',
  requirePermission('access.review'),
  asyncHandler(controller.getAccessReview),
)
