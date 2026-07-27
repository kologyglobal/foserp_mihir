import { Router } from 'express'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { validateBody } from '../../../middleware/validation.middleware.js'
import * as controller from './dispatch-settings.controller.js'
import { updateDispatchSettingsSchema } from './dispatch-settings.schemas.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requireAnyPermission(
    'dispatch.settings.view',
    'dispatch.settings.manage',
    'dispatch.view',
    'finance.settings.manage',
  ),
  controller.getSettings,
)

router.put(
  '/',
  requireAnyPermission('dispatch.settings.manage', 'finance.settings.manage', 'tenant.manage'),
  validateBody(updateDispatchSettingsSchema),
  controller.putSettings,
)

export default router
