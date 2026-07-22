import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './routing.controller.js'
import { updateOperationSchema } from './routing.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const operationIdParamSchema = z.object({ operationId: z.string().uuid() })

router.patch(
  '/:operationId',
  validateParams(operationIdParamSchema),
  requirePermission('manufacturing.routes.edit'),
  validateBody(updateOperationSchema),
  controller.updateOperation,
)
router.delete(
  '/:operationId',
  validateParams(operationIdParamSchema),
  requirePermission('manufacturing.routes.edit'),
  controller.deleteOperation,
)

export default router
