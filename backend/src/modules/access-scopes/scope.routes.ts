import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as scopeController from './scope.controller.js'
import { replaceUserScopesSchema, userScopeParamSchema } from './scope.validation.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/:userId/scopes',
  requirePermission('scope.view'),
  validateParams(userScopeParamSchema),
  asyncHandler(scopeController.getUserScopes),
)

router.put(
  '/:userId/scopes',
  requirePermission('scope.manage'),
  validateParams(userScopeParamSchema),
  validateBody(replaceUserScopesSchema),
  asyncHandler(scopeController.replaceUserScopes),
)

export default router
