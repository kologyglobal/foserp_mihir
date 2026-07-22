import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './bom.controller.js'
import { updateBomLineSchema } from './bom.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const lineIdParamSchema = z.object({ lineId: z.string().uuid() })

router.patch(
  '/:lineId',
  validateParams(lineIdParamSchema),
  requirePermission('manufacturing.bom.edit'),
  validateBody(updateBomLineSchema),
  controller.updateBomLine,
)
router.delete(
  '/:lineId',
  validateParams(lineIdParamSchema),
  requirePermission('manufacturing.bom.edit'),
  controller.deleteBomLine,
)

export default router
