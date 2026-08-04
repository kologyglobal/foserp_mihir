import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './device-token.controller.js'
import { registerDeviceTokenSchema, revokeDeviceTokenSchema } from './device-token.validation.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

/** Authenticated tenant user — registers Expo push token for future delivery. */
router.post('/', validateBody(registerDeviceTokenSchema), controller.register)
router.delete('/', validateBody(revokeDeviceTokenSchema), controller.revoke)
router.post('/revoke', validateBody(revokeDeviceTokenSchema), controller.revoke)

export default router
