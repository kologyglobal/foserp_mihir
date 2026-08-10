import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as controller from './ui-preference.controller.js'
import { putUiPreferenceSchema, uiPreferenceKeyParamSchema } from './ui-preference.validation.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

// A user always owns their UI preferences — no extra module permission.
router.get('/', controller.list)
router.put(
  '/:prefKey',
  validateParams(uiPreferenceKeyParamSchema),
  validateBody(putUiPreferenceSchema),
  controller.put,
)
router.delete('/:prefKey', validateParams(uiPreferenceKeyParamSchema), controller.remove)

export default router
