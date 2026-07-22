import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './manufacturing-settings.controller.js'
import {
  patchManufacturingSettingsSchema,
  putManufacturingSettingsSchema,
} from './manufacturing-settings.validation.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/',
  requirePermission('manufacturing.settings.view'),
  controller.getManufacturingSettings,
)
router.put(
  '/',
  requirePermission('manufacturing.settings.manage'),
  validateBody(putManufacturingSettingsSchema),
  controller.putManufacturingSettings,
)
router.patch(
  '/',
  requirePermission('manufacturing.settings.manage'),
  validateBody(patchManufacturingSettingsSchema),
  controller.patchManufacturingSettings,
)

export default router
