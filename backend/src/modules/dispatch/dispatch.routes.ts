import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateParams } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import outboundRoutes from './outbound/outbound-dispatch.routes.js'
import phase7c1Routes from './phase7c1/phase7c1.routes.js'
import phase7c2Routes from './phase7c2/phase7c2.routes.js'
import phase7c3Routes from './phase7c3/phase7c3.routes.js'
import phase7c4Routes from './phase7c4/phase7c4.routes.js'
import postingRoutes from './posting/dispatch-posting.routes.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.use('/outbound', outboundRoutes)
router.use('/', postingRoutes)
router.use('/', phase7c1Routes)
router.use('/', phase7c2Routes)
router.use('/', phase7c3Routes)
router.use('/', phase7c4Routes)

export default router

