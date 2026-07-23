import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as moduleController from './module.controller.js'
import { moduleKeyParamSchema, setModuleFlagSchema } from './module.validation.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

/** Any authenticated tenant user — powers sidebar module gating (fail-open if call fails). */
router.get('/', asyncHandler(moduleController.list))

router.put(
  '/:moduleKey',
  requirePermission('module.manage'),
  validateParams(moduleKeyParamSchema),
  validateBody(setModuleFlagSchema),
  asyncHandler(moduleController.setFlag),
)

export default router
