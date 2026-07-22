import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './routing.controller.js'
import { updateStageGroupSchema } from './routing.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const stageGroupIdParamSchema = z.object({ stageGroupId: z.string().uuid() })

router.patch(
  '/:stageGroupId',
  validateParams(stageGroupIdParamSchema),
  requirePermission('manufacturing.routes.edit'),
  validateBody(updateStageGroupSchema),
  controller.updateStageGroup,
)
router.delete(
  '/:stageGroupId',
  validateParams(stageGroupIdParamSchema),
  requirePermission('manufacturing.routes.edit'),
  controller.deleteStageGroup,
)

export default router
