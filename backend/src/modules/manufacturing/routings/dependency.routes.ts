import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './routing.controller.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const dependencyIdParamSchema = z.object({ dependencyId: z.string().uuid() })

router.delete(
  '/:dependencyId',
  validateParams(dependencyIdParamSchema),
  requirePermission('manufacturing.routes.edit'),
  controller.deleteDependency,
)

export default router
