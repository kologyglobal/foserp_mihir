import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as responsibilityController from './responsibility.controller.js'
import {
  assignResponsibilitySchema,
  createResponsibilitySchema,
  listResponsibilitiesQuerySchema,
  responsibilityIdParamSchema,
  updateResponsibilitySchema,
  userResponsibilityIdParamSchema,
  userResponsibilityParamSchema,
} from './responsibility.validation.js'

const catalogRouter = Router({ mergeParams: true })

catalogRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

catalogRouter.get(
  '/',
  requirePermission('responsibility.view'),
  validateQuery(listResponsibilitiesQuerySchema),
  asyncHandler(responsibilityController.list),
)

catalogRouter.post(
  '/',
  requirePermission('responsibility.create'),
  validateBody(createResponsibilitySchema),
  asyncHandler(responsibilityController.create),
)

catalogRouter.patch(
  '/:responsibilityId',
  requirePermission('responsibility.update'),
  validateParams(responsibilityIdParamSchema),
  validateBody(updateResponsibilitySchema),
  asyncHandler(responsibilityController.update),
)

catalogRouter.delete(
  '/:responsibilityId',
  requirePermission('responsibility.delete'),
  validateParams(responsibilityIdParamSchema),
  asyncHandler(responsibilityController.remove),
)

const userRouter = Router({ mergeParams: true })

userRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

userRouter.get(
  '/:userId/responsibilities',
  requirePermission('responsibility.view'),
  validateParams(userResponsibilityParamSchema),
  asyncHandler(responsibilityController.listForUser),
)

userRouter.post(
  '/:userId/responsibilities',
  requirePermission('responsibility.update'),
  validateParams(userResponsibilityParamSchema),
  validateBody(assignResponsibilitySchema),
  asyncHandler(responsibilityController.assignToUser),
)

userRouter.delete(
  '/:userId/responsibilities/:assignmentId',
  requirePermission('responsibility.update'),
  validateParams(userResponsibilityIdParamSchema),
  asyncHandler(responsibilityController.removeFromUser),
)

export { catalogRouter as responsibilityRoutes, userRouter as userResponsibilityRoutes }
